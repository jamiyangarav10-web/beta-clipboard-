import hmac
import re

DEFAULT_MAX_CLIPBOARD_BYTES = 1024 * 1024

SENSITIVE_PATTERNS = [
    r"-----BEGIN (RSA )?PRIVATE KEY-----",
    r"sk-[A-Za-z0-9]{20,}",
    r"Bearer\s+[A-Za-z0-9\-._~+/]+=*",
    r"^(word|mnemonic|seed)[^\n]{8,}$",
    r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
]


def secure_compare(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def payload_too_large(text: str, max_bytes: int = DEFAULT_MAX_CLIPBOARD_BYTES) -> bool:
    return len(text.encode("utf-8")) > max_bytes


def block_sensitive(text: str, max_bytes: int = DEFAULT_MAX_CLIPBOARD_BYTES, enabled: bool = True) -> bool:
    if not enabled or not text:
        return False
    if payload_too_large(text, max_bytes):
        return False
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False
