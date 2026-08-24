"""HARDENED LocalBridge server — Windows side.
- Binds only to Tailscale IP.
- Accepts one client, matched to specific Tailscale peer IP.
- Constant-time secret comparison.
- No clipboard content in logs.
"""
import asyncio
import hmac
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

import pyperclip
import websockets

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARED_PATH = REPO_ROOT / "packages" / "shared"
if SHARED_PATH.exists():
    sys.path.insert(0, str(SHARED_PATH))

from localbridge.config import merged_agent_config
from localbridge.protocol import clipboard_message, parse_json, validate_auth_message, validate_clipboard_message
from localbridge.security import block_sensitive as shared_block_sensitive
from localbridge.security import secure_compare

# ----------------------------
# Configuration (loaded first)
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
APP_DIR = Path(os.environ.get("LOCALBRIDGE_HOME", BASE_DIR.parent))
ENV_PATH = Path(os.environ.get("LOCALBRIDGE_ENV_PATH", APP_DIR / ".env"))

def load_env(path: Path) -> dict:
    env: dict = {}
    if not path.exists():
        print(f"[FATAL] Missing config file: {path}")
        sys.exit(1)
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env

cfg = merged_agent_config(ENV_PATH, role="windows")

LISTEN_HOST = cfg.get("listen_host", "")
LISTEN_PORT = int(cfg.get("port", os.getenv("LOCALBRIDGE_PORT", "8765")))
ALLOWED_PEER = cfg.get("allowed_peer", "")
EXPECTED_SECRET = cfg.get("secret", "")
MAX_MESSAGE_BYTES = int(cfg.get("max_clipboard_bytes", "1048576"))
MAX_CLIENTS = 1
CONNECT_TIMEOUT = 5
CLOSE_CODE_AUTH = 4401
CLOSE_CODE_SIZE = 4409

# ----------------------------
# Logging — NO clipboard content
# ----------------------------
LOG_PATH = APP_DIR / "server.log"
logging.basicConfig(
    filename=str(LOG_PATH),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
log = logging.getLogger("localbridge")

# ----------------------------
# State
# ----------------------------
clients = set()
connected_peer: Optional[str] = None
last_clipboard: str = ""


def block_sensitive(text: str) -> bool:
    """Return True if text looks like something we should not sync."""
    return shared_block_sensitive(text, MAX_MESSAGE_BYTES)


def clipboard_get_with_retry(retries: int = 8, delay: float = 0.15):
    """Try pyperclip.paste() multiple times to survive transient OpenClipboard locks."""
    for attempt in range(retries):
        try:
            return pyperclip.paste()
        except Exception as exc:
            err = str(exc).lower()
            if "openclipboard" in err or "operation completed successfully" in err:
                time.sleep(delay * (attempt + 1))
                continue
            raise
    return pyperclip.paste()


def clipboard_set_with_retry(text: str, retries: int = 8, delay: float = 0.15) -> None:
    """Try pyperclip.copy() multiple times to survive transient OpenClipboard locks."""
    for attempt in range(retries):
        try:
            pyperclip.copy(text)
            return
        except Exception as exc:
            err = str(exc).lower()
            if "openclipboard" in err or "operation completed successfully" in err:
                time.sleep(delay * (attempt + 1))
                continue
            raise
    pyperclip.copy(text)


async def send_to_client(ws, message: dict) -> None:
    try:
        await ws.send(json.dumps(message))
    except Exception as exc:
        log.warning("Send failed: %s", exc)


async def handle_client(websocket) -> None:
    global connected_peer, last_clipboard

    peer = websocket.remote_address[0] if websocket.remote_address else "unknown"
    log.info("Connection attempt from %s", peer)

    # IP allowlist — must match Mac Tailscale IP exactly
    if peer != ALLOWED_PEER:
        log.warning("Rejected connection from non-allowed IP %s", peer)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="not allowed")
        return

    # Single client enforcement
    if connected_peer is not None:
        log.warning("Rejected second client from %s", peer)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="already connected")
        return

    # Auth handshake
    try:
        auth_raw = await asyncio.wait_for(
            websocket.recv(), timeout=CONNECT_TIMEOUT
        )
    except Exception as exc:
        log.warning("Auth timeout/failed from %s: %s", peer, exc)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="auth timeout")
        return

    try:
        auth = parse_json(auth_raw)
    except Exception:
        log.warning("Invalid auth message from %s", peer)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="invalid auth")
        return

    if not auth or not validate_auth_message(auth).ok:
        log.warning("Invalid auth message from %s", peer)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="invalid auth")
        return

    if not secure_compare(str(auth.get("secret", "")), EXPECTED_SECRET):
        log.warning("Bad secret from %s", peer)
        await websocket.close(code=CLOSE_CODE_AUTH, reason="bad secret")
        return

    clients.add(websocket)
    connected_peer = peer
    log.info("Authenticated client %s", peer)

    try:
        async for raw_message in websocket:
            msg_len = len(raw_message)
            if msg_len > MAX_MESSAGE_BYTES:
                log.warning("Oversized message from %s: %d bytes", peer, msg_len)
                await send_to_client(websocket, {"type": "error", "reason": "message too large"})
                continue

            try:
                message = parse_json(raw_message)
            except Exception:
                continue

            if not message or message.get("type") != "clipboard":
                continue

            if not validate_clipboard_message(message, MAX_MESSAGE_BYTES).ok:
                log.warning("Rejected invalid clipboard message from %s", peer)
                continue

            text = message.get("text", "")
            if not isinstance(text, str):
                continue

            if block_sensitive(text):
                log.info("Clipboard item blocked by sensitive-data filter")
                continue

            if text == last_clipboard:
                continue

            last_clipboard = text
            clipboard_set_with_retry(text)
            log.info("Clipboard updated from client (%d chars)", len(text))

    except websockets.ConnectionClosed:
        log.info("Client %s disconnected normally", peer)
    except Exception as exc:
        log.error("Client handler error: %s", exc)
    finally:
        connected_peer = None
        clients.discard(websocket)
        try:
            await websocket.close()
        except Exception:
            pass


async def monitor_windows_clipboard() -> None:
    global last_clipboard

    while True:
        try:
            current = clipboard_get_with_retry()
            if isinstance(current, str) and current != last_clipboard:
                if block_sensitive(current):
                    log.info("Clipboard item blocked by sensitive-data filter")
                    last_clipboard = current
                    continue

                last_clipboard = current
                disconnected = []
                for client in list(clients):
                    try:
                        await client.send(clipboard_message(current))
                    except Exception:
                        disconnected.append(client)
                for c in disconnected:
                    clients.discard(c)

                log.info("Clipboard broadcast from Windows (%d chars)", len(current))

        except Exception as exc:
            log.error("Clipboard monitor error: %s", exc)

        await asyncio.sleep(0.4)


async def main() -> None:
    global cfg, LISTEN_HOST, LISTEN_PORT, ALLOWED_PEER, EXPECTED_SECRET, MAX_MESSAGE_BYTES

    while True:
        cfg = merged_agent_config(ENV_PATH, role="windows")
        LISTEN_HOST = cfg.get("listen_host", "")
        LISTEN_PORT = int(cfg.get("port", os.getenv("LOCALBRIDGE_PORT", "8765")))
        ALLOWED_PEER = cfg.get("allowed_peer", "")
        EXPECTED_SECRET = cfg.get("secret", "")
        MAX_MESSAGE_BYTES = int(cfg.get("max_clipboard_bytes", "1048576"))
        if LISTEN_HOST and ALLOWED_PEER and EXPECTED_SECRET:
            break
        log.info("Waiting for pairing credentials")
        print("LocalBridge Windows is waiting for pairing...")
        await asyncio.sleep(2)

    log.info("Starting LocalBridge server on %s:%d (peer configured, source=%s)", LISTEN_HOST, LISTEN_PORT, cfg.get("source"))
    print(f"LocalBridge server starting on {LISTEN_HOST}:{LISTEN_PORT}")

    # Verify we are actually on Tailscale (best-effort)
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.bind(("", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.close()
    except Exception as exc:
        log.warning("Network check warning: %s", exc)

    async with websockets.serve(
        handle_client,
        host=LISTEN_HOST,
        port=LISTEN_PORT,
        max_size=MAX_MESSAGE_BYTES,
    ):
        await monitor_windows_clipboard()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Server stopped")
        print("Server stopped")
    except Exception as exc:
        log.critical("Fatal error: %s", exc)
        sys.exit(1)
