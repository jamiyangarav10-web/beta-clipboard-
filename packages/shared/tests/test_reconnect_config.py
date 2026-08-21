from pathlib import Path

from localbridge.config import load_env
from localbridge.state import PairingState


def test_legacy_env_loading_keeps_reconnect_clients_configurable(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("PORT=8765\nSECRET=abc\n", encoding="utf-8")
    assert load_env(env_file)["PORT"] == "8765"
    assert PairingState.RECONNECTING == "RECONNECTING"
