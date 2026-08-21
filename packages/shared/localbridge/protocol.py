import json
from dataclasses import dataclass
from typing import Optional

from .security import DEFAULT_MAX_CLIPBOARD_BYTES, payload_too_large

AUTH = "auth"
CLIPBOARD = "clipboard"


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


def clipboard_message(text: str) -> str:
    return json.dumps({"type": CLIPBOARD, "text": text})


def auth_message(secret: str) -> str:
    return json.dumps({"type": AUTH, "secret": secret})
