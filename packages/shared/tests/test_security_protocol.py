import json

from localbridge.protocol import parse_json, validate_auth_message, validate_clipboard_message, validate_file_message
from localbridge.security import block_sensitive, payload_too_large, secure_compare


def test_sensitive_data_filter_blocks_expected_tokens():
    assert block_sensitive("Bearer abcdef0123456789abcdef")
    assert block_sensitive("-----BEGIN PRIVATE KEY-----\nabc")
    assert not block_sensitive("normal clipboard text")


def test_clipboard_payload_limit_uses_utf8_bytes():
    assert payload_too_large("🙂" * 3, 8)
    assert validate_clipboard_message({"type": "clipboard", "text": "abcdef"}, 5).ok is False


def test_file_payload_validation_uses_decoded_bytes():
    assert validate_file_message({"type": "file", "name": "note.txt", "data": "YWJjZGVm", "size": 6}, 6).ok
    assert not validate_file_message({"type": "file", "name": "note.txt", "data": "YWJjZGVm", "size": 6}, 5).ok
    assert not validate_file_message({"type": "file", "name": "note.txt", "data": "not base64", "size": 6}).ok


def test_auth_validation_and_constant_time_compare():
    secret = "x" * 40
    assert validate_auth_message({"type": "auth", "secret": secret}).ok
    assert not validate_auth_message({"type": "auth", "secret": "short"}).ok
    assert secure_compare(secret, secret)
    assert not secure_compare(secret, "y" * 40)


def test_json_parser_rejects_non_objects():
    assert parse_json(json.dumps(["bad"])) is None
    assert parse_json("{") is None
