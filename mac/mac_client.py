#!/usr/bin/env python3
"""HARDENED LocalBridge client — Mac side.
- Connects ONLY via Tailscale to Windows Tailscale IP.
- Loads secret from ~/.config/localbridge/.env.
- Reconnect with exponential backoff on disconnect.
- No clipboard content in logs.
- Sensitive pattern filtering.
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

try:
    import pyperclip
    import websockets
except ImportError:
    print("Missing packages. Run: pip3 install websockets pyperclip")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARED_PATH = REPO_ROOT / "packages" / "shared"
if SHARED_PATH.exists():
    sys.path.insert(0, str(SHARED_PATH))

from localbridge.config import merged_agent_config
from localbridge.protocol import auth_message, clipboard_message, parse_json, validate_clipboard_message
from localbridge.security import block_sensitive as shared_block_sensitive

# ----------------------------
# Configuration
# ----------------------------
WINDOWS_TAILSCALE_IP = ""
PORT = int(os.getenv("LOCALBRIDGE_PORT", "8765"))

# .env path on Mac, multiple fallbacks
MAC_ENV_PATHS = [
    Path.home() / "Library" / "Application Support" / "localbridge" / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent / ".env",
]
ENV_PATH: Optional[Path] = None
for p in MAC_ENV_PATHS:
    if p.exists():
        ENV_PATH = p
        break

cfg = merged_agent_config(ENV_PATH or MAC_ENV_PATHS[0], role="macos")

WINDOWS_TAILSCALE_IP = cfg.get("windows_tailscale_ip", "")
PORT = int(cfg.get("port", os.getenv("LOCALBRIDGE_PORT", "8765")))
EXPECTED_SECRET = cfg.get("secret", "")
MAX_MESSAGE_BYTES = int(cfg.get("max_clipboard_bytes", "1048576"))
BLOCK_SENSITIVE = bool(cfg.get("block_sensitive", True))

URI = f"ws://{WINDOWS_TAILSCALE_IP}:{PORT}" if WINDOWS_TAILSCALE_IP else ""

# ----------------------------
# Logging
# ----------------------------
LOG_DIR = Path.home() / "Library" / "Logs" / "localbridge"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIR / "client.log"

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
last_clipboard = ""


def secure_compare(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def block_sensitive(text: str) -> bool:
    return shared_block_sensitive(text, MAX_MESSAGE_BYTES, BLOCK_SENSITIVE)


def read_runtime_config() -> dict:
    return merged_agent_config(MAC_ENV_PATHS[0], role="macos")


async def wait_for_pairing() -> dict:
    while True:
        cfg = read_runtime_config()
        if cfg.get("windows_tailscale_ip") and cfg.get("secret"):
            return cfg
        log.info("Waiting for pairing credentials")
        print("LocalBridge is waiting for pairing...")
        await asyncio.sleep(2)


async def connect_with_backoff(uri: str) -> websockets.WebSocketClientProtocol:
    backoff = 1
    max_backoff = 60
    attempt = 0

    while True:
        attempt += 1
        try:
            ws = await asyncio.wait_for(
                websockets.connect(uri, max_size=MAX_MESSAGE_BYTES),
                timeout=10,
            )
            log.info("Connected to Windows (attempt %d)", attempt)
            return ws
        except Exception as exc:
            log.warning("Connection attempt %d failed: %s", attempt, exc)
            backoff = min(backoff * 2, max_backoff)
            await asyncio.sleep(backoff)


async def send(ws, msg: dict) -> None:
    try:
        await ws.send(json.dumps(msg))
    except Exception as exc:
        log.warning("Send error: %s", exc)


async def monitor_mac_clipboard(send_func, max_bytes: int, sensitive_enabled: bool) -> None:
    global last_clipboard
    while True:
        try:
            current = pyperclip.paste()
            if isinstance(current, str) and current != last_clipboard:
                payload = current
                if shared_block_sensitive(payload, max_bytes, sensitive_enabled):
                    log.info("Clipboard item blocked by sensitive-data filter")
                    last_clipboard = payload
                    await asyncio.sleep(0.4)
                    continue
                if len(payload.encode("utf-8")) > max_bytes:
                    log.warning("Clipboard payload too large (%d bytes), skipping", len(payload.encode("utf-8")))
                    last_clipboard = payload
                    await asyncio.sleep(0.4)
                    continue

                last_clipboard = payload
                await send_func({"type": "clipboard", "text": payload})
                log.info("Mac clipboard sent (%d chars)", len(payload))
        except Exception as exc:
            log.error("Clipboard monitor error: %s", exc)
        await asyncio.sleep(0.4)


async def main() -> None:
    global last_clipboard

    log.info("Client starting")

    while True:
        try:
            cfg = await wait_for_pairing()
            windows_host = cfg.get("windows_tailscale_ip", "")
            secret = cfg.get("secret", "")
            port = int(cfg.get("port", os.getenv("LOCALBRIDGE_PORT", "8765")))
            max_bytes = int(cfg.get("max_clipboard_bytes", "1048576"))
            block_sensitive_enabled = bool(cfg.get("block_sensitive", True))
            uri = f"ws://{windows_host}:{port}"

            if not windows_host or not secret:
                await asyncio.sleep(2)
                continue

            ws = await connect_with_backoff(uri)
            await ws.send(auth_message(secret))
            log.info("Authentication sent")

            async def sender(msg):
                await send(ws, msg)

            monitor_task = asyncio.create_task(monitor_mac_clipboard(sender, max_bytes, block_sensitive_enabled))

            try:
                async for raw in ws:
                    try:
                        message = parse_json(raw)
                    except Exception:
                        continue

                    if not message or message.get("type") != "clipboard":
                        continue
                    if not validate_clipboard_message(message, max_bytes).ok:
                        log.warning("Rejected invalid incoming clipboard message")
                        continue

                    text = message.get("text", "")
                    if not isinstance(text, str):
                        continue

                    if shared_block_sensitive(text, max_bytes, block_sensitive_enabled):
                        log.info("Clipboard item blocked by sensitive-data filter")
                        last_clipboard = text
                        continue

                    if len(text.encode("utf-8")) > max_bytes:
                        log.warning("Incoming payload too large, skipping")
                        last_clipboard = text
                        continue

                    last_clipboard = text
                    pyperclip.copy(text)
                    log.info("Mac clipboard received (%d chars)", len(text))
            except websockets.ConnectionClosed:
                log.warning("Disconnected from Windows")
            finally:
                monitor_task.cancel()
                try:
                    await ws.close()
                except Exception:
                    pass

        except KeyboardInterrupt:
            raise
        except Exception as exc:
            log.error("Session error: %s", exc)
            await asyncio.sleep(2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Client stopped")
        print("\nStopped")
    except Exception as exc:
        log.critical("Fatal error: %s", exc)
        sys.exit(1)
