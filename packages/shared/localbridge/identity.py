import json
import os
import platform
import secrets
from pathlib import Path
from typing import Optional


def app_support_dir() -> Path:
    if os.name == "nt":
        root = os.getenv("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(root) / "LocalBridge"
    if sys_platform() == "darwin":
        return Path.home() / "Library" / "Application Support" / "LocalBridge"
    return Path(os.getenv("XDG_CONFIG_HOME", Path.home() / ".config")) / "localbridge"


def sys_platform() -> str:
    return platform.system().lower()


def identity_path() -> Path:
    return app_support_dir() / "identity.json"


def load_or_create_identity(path: Optional[Path] = None) -> dict:
    target = path or identity_path()
    if target.exists():
        return json.loads(target.read_text(encoding="utf-8"))
    target.parent.mkdir(parents=True, exist_ok=True)
    identity = {
        "device_id": f"lb_{secrets.token_urlsafe(18)}",
        "device_secret": secrets.token_urlsafe(48),
        "device_name": platform.node() or "LocalBridge Device",
        "platform": "windows" if os.name == "nt" else ("macos" if sys_platform() == "darwin" else sys_platform()),
    }
    target.write_text(json.dumps(identity, indent=2), encoding="utf-8")
    try:
        target.chmod(0o600)
    except Exception:
        pass
    return identity
