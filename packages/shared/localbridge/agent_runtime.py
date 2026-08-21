import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional

from .config import credentials_path, load_credentials, save_credentials
from .identity import load_or_create_identity
from .pairing_client import post_json, register_device, write_pairing_credentials
from .tailscale import detect_tailscale_ip


def default_backend_base_url() -> str:
    return os.getenv("LOCALBRIDGE_BACKEND_BASE_URL", "http://127.0.0.1:8888")


class AgentRuntime(object):
    def __init__(self, role: str, engine_script: Path, local_port: int = 17833) -> None:
        self.role = role
        self.engine_script = engine_script
        self.local_port = local_port
        self.backend_base_url = default_backend_base_url()
        self.identity = load_or_create_identity()
        self.process: Optional[subprocess.Popen] = None
        self.sync_enabled = True
        self._lock = threading.Lock()

    def direct_ip(self) -> str:
        return detect_tailscale_ip()

    def direct_endpoint(self) -> str:
        ip = self.direct_ip()
        if not ip:
            return ""
        if self.role == "windows":
            return f"{ip}:{self.engine_port()}"
        return ip

    def engine_port(self) -> int:
        credentials = load_credentials()
        transport = credentials.get("transport", {})
        return int(transport.get("port") or os.getenv("LOCALBRIDGE_PORT", "8765"))

    def engine_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def credentials(self) -> dict:
        return load_credentials()

    def state(self) -> str:
        if not self.sync_enabled:
            return "PAUSED"
        if self.credentials().get("shared_secret"):
            return "CONNECTED" if self.engine_running() else "PAIRED"
        return "UNPAIRED"

    def status_payload(self) -> dict:
        credentials = self.credentials()
        paired_device = credentials.get("paired_device", {})
        return {
            "deviceId": self.identity["device_id"],
            "deviceName": self.identity["device_name"],
            "platform": self.identity["platform"],
            "state": self.state(),
            "syncEnabled": self.sync_enabled,
            "engineRunning": self.engine_running(),
            "backendBaseUrl": self.backend_base_url,
            "controlPort": self.local_port,
            "hasCredentials": bool(credentials.get("shared_secret")),
            "pairedDevice": paired_device,
            "directIp": self.direct_ip(),
            "directEndpoint": self.direct_endpoint(),
        }

    def register(self) -> dict:
        result = register_device(self.backend_base_url, direct_endpoint=self.direct_endpoint())
        return result

    def create_session(self, body: dict) -> dict:
        device_id = body.get("deviceId") or self.identity["device_id"]
        result = post_json(self.backend_base_url, "/api/pairing/session", {"deviceId": device_id})
        return result

    def join_session(self, body: dict) -> dict:
        pairing_id = body.get("pairingId", "")
        device_id = body.get("deviceId") or self.identity["device_id"]
        result = post_json(self.backend_base_url, "/api/pairing/join", {"pairingId": pairing_id, "deviceId": device_id})
        return result

    def approve_session(self, body: dict) -> dict:
        pairing_id = body.get("pairingId", "")
        result = post_json(self.backend_base_url, "/api/pairing/approve", {"pairingId": pairing_id})
        payload = result.get("body", {})
        if payload.get("credentials"):
            write_pairing_credentials(result, self.identity["device_id"])
            self.restart_engine()
        return result

    def restart_engine(self) -> dict:
        self.stop_engine()
        self.start_engine()
        return self.status_payload()

    def start_engine(self) -> dict:
        with self._lock:
            if not self.sync_enabled:
                return self.status_payload()
            if self.process is not None and self.process.poll() is None:
                return self.status_payload()
            self.process = subprocess.Popen([sys.executable, str(self.engine_script)], cwd=str(self.engine_script.parent.parent))
            return self.status_payload()

    def stop_engine(self) -> dict:
        with self._lock:
            if self.process is not None and self.process.poll() is None:
                self.process.terminate()
            self.process = None
            return self.status_payload()

    def disconnect(self) -> dict:
        with self._lock:
            self.sync_enabled = False
            self.stop_engine()
            return self.status_payload()

    def reconnect(self) -> dict:
        with self._lock:
            self.sync_enabled = True
            return self.start_engine()

    def remove_pairing(self) -> dict:
        with self._lock:
            self.stop_engine()
            target = credentials_path()
            if target.exists():
                target.unlink()
            return self.status_payload()
