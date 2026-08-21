import json
import os
from pathlib import Path
from typing import Optional

from .identity import app_support_dir


def load_env(path: Path) -> dict:
    env: dict = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def credentials_path() -> Path:
    return app_support_dir() / "credentials.json"


def load_credentials(path: Optional[Path] = None) -> dict:
    target = path or credentials_path()
    if not target.exists():
        return {}
    return json.loads(target.read_text(encoding="utf-8"))


def save_credentials(credentials: dict, path: Optional[Path] = None) -> Path:
    target = path or credentials_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(credentials, indent=2), encoding="utf-8")
    try:
        target.chmod(0o600)
    except Exception:
        pass
    return target


def merged_agent_config(env_path: Path, role: str) -> dict:
    env = load_env(env_path)
    credentials = load_credentials()
    paired = credentials.get("paired_device", {})
    transport = credentials.get("transport", {})
    return {
        "listen_host": transport.get("listen_host") or env.get("LISTEN_HOST", ""),
        "allowed_peer": paired.get("direct_host") or env.get("ALLOWED_PEER", ""),
        "windows_tailscale_ip": paired.get("direct_host") or env.get("WINDOWS_TAILSCALE_IP", ""),
        "port": int(transport.get("port") or env.get("PORT", os.getenv("LOCALBRIDGE_PORT", "8765"))),
        "secret": credentials.get("shared_secret") or env.get("SECRET", ""),
        "max_clipboard_bytes": int(credentials.get("max_clipboard_bytes") or env.get("MAX_CLIPBOARD_BYTES", "1048576")),
        "block_sensitive": env.get("BLOCK_SENSITIVE_PATTERNS", "true").lower() != "false",
        "role": role,
        "source": "credentials" if credentials.get("shared_secret") else "env",
    }
