import json
import base64
from dataclasses import dataclass
from typing import Optional

from .security import DEFAULT_MAX_CLIPBOARD_BYTES, payload_too_large

AUTH = "auth"
CLIPBOARD = "clipboard"
FILE = "file"


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    reason: str = ""


def parse_json(raw: str) -> Optional[dict]:
    try:
        value = json.loads(raw)
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def validate_auth_message(message: dict) -> ValidationResult:
    if message.get("type") != AUTH:
        return ValidationResult(False, "unsupported message type")
    if not isinstance(message.get("secret"), str) or len(message["secret"]) < 32:
        return ValidationResult(False, "secret is missing or too short")
    return ValidationResult(True)


def validate_clipboard_message(message: dict, max_bytes: int = DEFAULT_MAX_CLIPBOARD_BYTES) -> ValidationResult:
    if message.get("type") != CLIPBOARD:
        return ValidationResult(False, "unsupported message type")
    text = message.get("text")
    if not isinstance(text, str):
        return ValidationResult(False, "clipboard text must be a string")
    if payload_too_large(text, max_bytes):
        return ValidationResult(False, "clipboard payload too large")
    return ValidationResult(True)


def validate_file_message(message: dict, max_bytes: int = 8 * 1024 * 1024) -> ValidationResult:
    if message.get("type") != FILE:
        return ValidationResult(False, "unsupported message type")
    name = message.get("name")
    data = message.get("data")
    if not isinstance(name, str) or not name.strip():
        return ValidationResult(False, "file name is missing")
    if not isinstance(data, str) or not data:
        return ValidationResult(False, "file data is missing")
    try:
        decoded = base64.b64decode(data.encode("ascii"), validate=True)
    except Exception:
        return ValidationResult(False, "file data is not valid base64")
    if len(decoded) > max_bytes:
        return ValidationResult(False, "file payload too large")
    return ValidationResult(True)


def clipboard_message(text: str) -> str:
    return json.dumps({"type": CLIPBOARD, "text": text})


def file_message(name: str, mime: str, data: str, size: int) -> str:
    return json.dumps({"type": FILE, "name": name, "mime": mime, "data": data, "size": size})


def auth_message(secret: str) -> str:
    return json.dumps({"type": AUTH, "secret": secret})
