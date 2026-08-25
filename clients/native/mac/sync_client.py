#!/usr/bin/env python3
"""
LocalBridge Mac sync client (self-contained).
Connects to the Windows sync server over Tailscale, authenticates with the
shared secret, and relays the macOS clipboard both ways using pbcopy/pbpaste
(no pyperclip / localbridge package required).

Config (same .env the rest of LocalBridge uses):
  windows_tailscale_ip / WINDOWS_TAILSCALE_IP  -> Windows peer IP
  secret                                      -> shared secret
  port (optional)                             -> default 8765

Env overrides for testing:
  LOCALBRIDGE_WIN_IP, LOCALBRIDGE_SECRET, LOCALBRIDGE_PORT
"""
import asyncio
import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("LOCALBRIDGE_HOME", Path.home() / "Library/Application Support/LocalBridge"))
ENV_PATH = Path(os.environ.get("LOCALBRIDGE_ENV_PATH", CONFIG_DIR / ".env"))
PORT = int(os.environ.get("LOCALBRIDGE_PORT", os.environ.get("PORT", "8765")))
MAX_TRANSFER_BYTES = int(os.environ.get("LOCALBRIDGE_MAX_TRANSFER_BYTES", str(8 * 1024 * 1024)))
MAX_WIRE_BYTES = (MAX_TRANSFER_BYTES * 2) + 4096
OUTBOX_DIR = CONFIG_DIR / "outbox"
DOWNLOAD_DIR = Path.home() / "Downloads" / "LocalBridge"


def load_env():
    env = {}
    try:
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return env


cfg = load_env()
WINDOWS_IP = (
    os.environ.get("LOCALBRIDGE_WIN_IP")
    or cfg.get("windows_tailscale_ip")
    or cfg.get("WINDOWS_TAILSCALE_IP")
    or ""
)
SECRET = os.environ.get("LOCALBRIDGE_SECRET") or cfg.get("SECRET") or cfg.get("secret") or ""
URI = f"ws://{WINDOWS_IP}:{PORT}" if WINDOWS_IP else ""


async def pbpaste():
    try:
        p = await asyncio.create_subprocess_exec(
            "pbpaste", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        out, _ = await p.communicate()
        return out.decode("utf-8", "ignore")
    except Exception:
        return None


async def pbcopy(text):
    try:
        p = await asyncio.create_subprocess_exec(
            "pbcopy", stdin=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        await p.communicate(text.encode("utf-8", "ignore"))
    except Exception:
        pass


def safe_filename(name):
    cleaned = "".join(ch for ch in name if ch not in '<>:"/\\|?*').strip().strip(".")
    return (cleaned[:160] or "localbridge-file")


def unique_path(directory, name):
    base = safe_filename(name)
    target = directory / base
    if not target.exists():
        return target
    stem = target.stem
    suffix = target.suffix
    for index in range(1, 1000):
        candidate = directory / f"{stem}-{index}{suffix}"
        if not candidate.exists():
            return candidate
    return directory / f"{stem}-{int(time.time())}{suffix}"


def validate_file_message(msg):
    if msg.get("type") != "file":
        return False
    if not isinstance(msg.get("name"), str) or not msg["name"].strip():
        return False
    if not isinstance(msg.get("data"), str) or not msg["data"]:
        return False
    try:
        decoded = base64.b64decode(msg["data"].encode("ascii"), validate=True)
    except Exception:
        return False
    return len(decoded) <= MAX_TRANSFER_BYTES


def save_received_file(msg):
    if not validate_file_message(msg):
        return None
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    target = unique_path(DOWNLOAD_DIR, msg.get("name", "localbridge-file"))
    target.write_bytes(base64.b64decode(msg["data"].encode("ascii"), validate=True))
    return target


async def send_outbox(ws):
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(OUTBOX_DIR.glob("*.json")):
        try:
            msg = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            try:
                path.unlink()
            except Exception:
                pass
            continue
        if not validate_file_message(msg):
            try:
                path.unlink()
            except Exception:
                pass
            continue
        await ws.send(json.dumps(msg))
        try:
            path.unlink()
        except Exception:
            pass
        print(f"Mac -> Windows file ({msg.get('name')}, {msg.get('size', 0)} bytes)", file=sys.stderr)


async def main():
    import websockets

    if not URI:
        print("Missing windows Tailscale IP in .env (windows_tailscale_ip)", file=sys.stderr)
        sys.exit(1)

    last_local = None
    last_received = None
    backoff = 1

    while True:
        try:
            async with websockets.connect(URI, max_size=MAX_WIRE_BYTES) as ws:
                await ws.send(json.dumps({"type": "auth", "secret": SECRET}))
                print(f"Connected to Windows sync server at {URI}", file=sys.stderr)
                backoff = 1

                async def monitor():
                    nonlocal last_local, last_received
                    while True:
                        try:
                            await send_outbox(ws)
                            cur = await pbpaste()
                            if cur is not None and cur != last_local and cur != last_received:
                                last_local = cur
                                await ws.send(json.dumps({"type": "clipboard", "text": cur}))
                                print(f"Mac -> Windows ({len(cur)} chars)", file=sys.stderr)
                        except Exception:
                            pass
                        await asyncio.sleep(0.4)

                async def receiver():
                    nonlocal last_local, last_received
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                        except Exception:
                            continue
                        if msg.get("type") == "clipboard":
                            text = msg.get("text", "")
                            await pbcopy(text)
                            last_received = text
                            last_local = text
                            print(f"Windows -> Mac ({len(text)} chars)", file=sys.stderr)
                        elif msg.get("type") == "file":
                            target = save_received_file(msg)
                            if target:
                                print(f"Windows -> Mac file saved: {target}", file=sys.stderr)

                await asyncio.gather(monitor(), receiver())
        except Exception as exc:
            print(f"Sync disconnected, retrying in {backoff}s: {exc}", file=sys.stderr)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(f"Sync client fatal: {exc}", file=sys.stderr)
        sys.exit(1)
