#!/usr/bin/env python3
"""LocalBridge cloud relay sync engine.

This public-beta engine avoids LAN/Tailscale setup. Both native agents poll the
pairing backend for relay messages, so new users only need the website pairing
code and the local agent.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("LOCALBRIDGE_HOME", Path.home() / "Library/Application Support/LocalBridge"))
ENV_PATH = Path(os.environ.get("LOCALBRIDGE_ENV_PATH", CONFIG_DIR / ".env"))
CREDENTIALS_PATH = Path(os.environ.get("LOCALBRIDGE_CREDENTIALS_PATH", CONFIG_DIR / "credentials.json"))
BACKEND = os.environ.get("LOCALBRIDGE_BACKEND_BASE_URL", "https://ai-mongolia.netlify.app/.netlify/functions/pairing")
DEVICE_ID = os.environ.get("LOCALBRIDGE_DEVICE_ID", "")
CONTROL_TOKEN = os.environ.get("LOCALBRIDGE_CONTROL_TOKEN", "")
MAX_TRANSFER_BYTES = int(os.environ.get("LOCALBRIDGE_MAX_TRANSFER_BYTES", str(8 * 1024 * 1024)))
OUTBOX_DIR = CONFIG_DIR / "outbox"
DOWNLOAD_DIR = Path.home() / "Downloads" / "LocalBridge"
IS_WINDOWS = sys.platform == "win32"
POLL_SECONDS = 0.35


def log(message):
    print(str(message), file=sys.stderr, flush=True)


def post_json(path, payload, timeout=12):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BACKEND.rstrip("/") + path,
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read().decode("utf-8"))
        except Exception:
            return error.code, {"error": str(error)}
    except Exception as error:
        return 0, {"error": str(error)}


def load_credentials():
    try:
        return json.loads(CREDENTIALS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def peer_device_id():
    return (load_credentials().get("paired_device") or {}).get("device_id", "")


def clipboard_get():
    if IS_WINDOWS:
        import pyperclip
        last_error = None
        for attempt in range(6):
            try:
                return pyperclip.paste()
            except Exception as error:
                last_error = error
                time.sleep(0.05 * (attempt + 1))
        raise last_error
    proc = subprocess.run(["pbpaste"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    return proc.stdout.decode("utf-8", "ignore")


def clipboard_set(text):
    if IS_WINDOWS:
        import pyperclip
        last_error = None
        for attempt in range(6):
            try:
                pyperclip.copy(text)
                return
            except Exception as error:
                last_error = error
                time.sleep(0.05 * (attempt + 1))
        raise last_error

    value = str(text)
    payload = value.encode("utf-8", "ignore")
    for attempt in range(3):
        proc = subprocess.run(["pbcopy"], input=payload, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
        if proc.returncode == 0:
            time.sleep(0.05)
            if clipboard_get() == value:
                return

        fallback = subprocess.run(
            [
                "osascript",
                "-e", "on run argv",
                "-e", "set the clipboard to item 1 of argv",
                "-e", "end run",
                value,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=False,
        )
        if fallback.returncode == 0:
            time.sleep(0.05)
            if clipboard_get() == value:
                return
        time.sleep(0.1 * (attempt + 1))
    raise RuntimeError("macOS clipboard write could not be verified")


def safe_filename(name):
    cleaned = "".join(ch for ch in str(name or "") if ch not in '<>:"/\\|?*').strip().strip(".")
    return cleaned[:160] or "localbridge-file"


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


def validate_file_message(message):
    if message.get("type") != "file":
        return False
    if not isinstance(message.get("name"), str) or not message["name"].strip():
        return False
    if not isinstance(message.get("data"), str) or not message["data"]:
        return False
    try:
        decoded = base64.b64decode(message["data"].encode("ascii"), validate=True)
    except Exception:
        return False
    return len(decoded) <= MAX_TRANSFER_BYTES


def save_received_file(message):
    if not validate_file_message(message):
        return None
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    target = unique_path(DOWNLOAD_DIR, message.get("name", "localbridge-file"))
    target.write_bytes(base64.b64decode(message["data"].encode("ascii"), validate=True))
    return target


def relay_send(message):
    peer = peer_device_id()
    if not peer:
        return False
    status, body = post_json("/relay/send", {
        "deviceId": DEVICE_ID,
        "controlToken": CONTROL_TOKEN,
        "toDeviceId": peer,
        "message": message,
    })
    if status != 200:
        log(f"Relay send failed: {status} {body.get('error')}")
        return False
    return True


def relay_poll():
    status, body = post_json("/relay/poll", {
        "deviceId": DEVICE_ID,
        "controlToken": CONTROL_TOKEN,
    })
    if status != 200:
        return []
    return body.get("messages", [])


def flush_outbox():
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(OUTBOX_DIR.glob("*.json")):
        try:
            message = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            path.unlink(missing_ok=True)
            continue
        if message.get("type") != "file" or not validate_file_message(message):
            path.unlink(missing_ok=True)
            continue
        if relay_send(message):
            log(f"File queued to relay: {message.get('name')} ({message.get('size', 0)} bytes)")
            path.unlink(missing_ok=True)


def main():
    if not DEVICE_ID or not CONTROL_TOKEN:
        log("Missing relay identity")
        return 1
    try:
        last_local = clipboard_get()
    except Exception:
        last_local = None
    last_received = None
    log("LocalBridge cloud relay started")
    while True:
        try:
            flush_outbox()
            for item in relay_poll():
                message = item.get("message") or {}
                if message.get("type") == "clipboard":
                    text = str(message.get("text", ""))
                    clipboard_set(text)
                    last_received = text
                    last_local = text
                    log(f"Clipboard received through relay ({len(text)} chars)")
                elif message.get("type") == "file":
                    target = save_received_file(message)
                    if target:
                        log(f"File received through relay: {target}")

            current = clipboard_get()
            if isinstance(current, str) and current != last_local and current != last_received:
                if relay_send({"type": "clipboard", "text": current}):
                    last_local = current
                    log(f"Clipboard sent through relay ({len(current)} chars)")
        except Exception as error:
            log(f"Relay loop error: {error}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
