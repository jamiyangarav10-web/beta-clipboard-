#!/usr/bin/env python3
"""
LocalBridge native control agent.

This is the missing piece the website (main.tsx -> http://127.0.0.1:17833)
expects. It exposes a small REST API the site calls, proxies the pairing
flow to the real Netlify pairing backend, and once a pairing is approved it
launches the proven clipboard-sync engine (mac_client.py on macOS,
server.py on Windows) so the two devices actually exchange clipboards.

macOS:  python3 agent.py
Windows: python3 agent.py   (launches windows/server.py for sync)

Config is read from the same .env the sync engine uses
(~/Library/Application Support/localbridge/.env on macOS).
"""
import os
import sys
import json
import time
import base64
import ipaddress
import socket
import subprocess
import threading
import urllib.request
import urllib.error
import uuid
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

if sys.platform == "win32":
    CONFIG_DIR = Path(os.environ.get("LOCALBRIDGE_HOME", os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "LocalBridge")))
    LOG_PATH = os.path.join(CONFIG_DIR, "agent.log")
else:
    CONFIG_DIR = Path(os.path.expanduser("~/Library/Application Support/LocalBridge"))
    LOG_PATH = os.path.expanduser("~/Library/Logs/localbridge/agent.log")
ENV_PATH = CONFIG_DIR / ".env"
IDENTITY_PATH = CONFIG_DIR / "identity.json"
CREDENTIALS_PATH = CONFIG_DIR / "credentials.json"
OUTBOX_DIR = CONFIG_DIR / "outbox"
CONTROL_PORT = int(os.environ.get("CONTROL_PORT", "17833"))
CONTROL_HOST = os.environ.get("CONTROL_HOST", "127.0.0.1")
SYNC_PORT = int(os.environ.get("SYNC_PORT", "8765"))
MAX_TRANSFER_BYTES = int(os.environ.get("LOCALBRIDGE_MAX_TRANSFER_BYTES", str(8 * 1024 * 1024)))
BACKEND = os.environ.get(
    "BACKEND_BASE_URL",
    "https://ai-mongolia.netlify.app/.netlify/functions/pairing",
)

PLATFORM = "macos" if sys.platform == "darwin" else "windows"
DEVICE_NAME = socket.gethostname()


def log(msg):
    try:
        Path(LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(time.strftime("%Y-%m-%dT%H:%M:%S") + " [agent] " + str(msg) + "\n")
    except Exception:
        pass


def load_env():
    env = {}
    try:
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


ENV = load_env()


def load_identity():
    try:
        with open(IDENTITY_PATH) as f:
            identity = json.load(f)
            changed = False
            if not identity.get("control_token"):
                identity["control_token"] = os.urandom(24).hex()
                changed = True
            if changed:
                IDENTITY_PATH.write_text(json.dumps(identity, indent=2), encoding="utf-8")
                IDENTITY_PATH.chmod(0o600)
            return identity
    except Exception:
        identity = {
            "device_id": "lb_" + os.urandom(18).hex(),
            "device_name": DEVICE_NAME,
            "platform": PLATFORM,
            "control_token": os.urandom(24).hex(),
        }
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            IDENTITY_PATH.write_text(json.dumps(identity, indent=2), encoding="utf-8")
            IDENTITY_PATH.chmod(0o600)
        except Exception as exc:
            log("identity save error: " + str(exc))
        return identity


def load_credentials():
    try:
        return json.loads(CREDENTIALS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def safe_filename(name):
    cleaned = "".join(ch for ch in str(name or "") if ch not in '<>:"/\\|?*').strip().strip(".")
    return cleaned[:160] or "localbridge-file"


def queue_outbox_file(payload):
    if not load_credentials().get("shared_secret"):
        raise ValueError("Pair devices before sending files.")
    name = safe_filename(payload.get("name"))
    mime = str(payload.get("mime") or "application/octet-stream")[:120]
    data = payload.get("data")
    if not isinstance(data, str) or not data:
        raise ValueError("File data is missing.")
    try:
        decoded = base64.b64decode(data.encode("ascii"), validate=True)
    except Exception:
        raise ValueError("File data is invalid.")
    if len(decoded) > MAX_TRANSFER_BYTES:
        raise ValueError("File is too large for this beta.")
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    message = {
        "type": "file",
        "name": name,
        "mime": mime,
        "data": base64.b64encode(decoded).decode("ascii"),
        "size": len(decoded),
    }
    target = OUTBOX_DIR / f"{int(time.time())}-{uuid.uuid4().hex}.json"
    target.write_text(json.dumps(message), encoding="utf-8")
    try:
        target.chmod(0o600)
    except Exception:
        pass
    return {"queued": True, "name": name, "size": len(decoded)}


def parse_endpoint_host(endpoint):
    value = (endpoint or "").strip()
    if not value:
        return ""
    parsed = urlparse(value if "://" in value else "//" + value)
    return parsed.hostname or value.split(":", 1)[0]


def parse_endpoint_port(endpoint, default=8765):
    value = (endpoint or "").strip()
    if not value:
        return default
    parsed = urlparse(value if "://" in value else "//" + value)
    return parsed.port or default


def is_tailscale_host(host):
    try:
        return ipaddress.ip_address(str(host or "")) in ipaddress.ip_network("100.64.0.0/10")
    except ValueError:
        return False


def direct_transport_available(credentials):
    paired = credentials.get("paired_device") or {}
    transport = credentials.get("transport") or {}
    platforms = {PLATFORM, paired.get("platform")}
    return (
        platforms == {"macos", "windows"}
        and is_tailscale_host(paired.get("direct_host"))
        and is_tailscale_host(transport.get("listen_host"))
    )


def save_pairing_credentials(raw_credentials):
    devices = raw_credentials.get("devices", [])
    peer = next((device for device in devices if device.get("deviceId") != DEVICE_ID), {})
    mine = next((device for device in devices if device.get("deviceId") == DEVICE_ID), {})
    peer_endpoint = peer.get("directEndpoint", "")
    own_endpoint = mine.get("directEndpoint", MY_ENDPOINT)
    credentials = {
        "shared_secret": raw_credentials.get("sharedSecret", ""),
        "max_clipboard_bytes": raw_credentials.get("maxClipboardBytes", 1048576),
        "paired_device": {
            "device_id": peer.get("deviceId"),
            "device_name": peer.get("deviceName"),
            "platform": peer.get("platform"),
            "direct_host": parse_endpoint_host(peer_endpoint),
        },
        "transport": {
            "kind": raw_credentials.get("transport", "cloud-relay"),
            "listen_host": parse_endpoint_host(own_endpoint),
            "port": parse_endpoint_port(peer_endpoint or own_endpoint, SYNC_PORT),
        },
    }
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CREDENTIALS_PATH.write_text(json.dumps(credentials, indent=2), encoding="utf-8")
    try:
        CREDENTIALS_PATH.chmod(0o600)
    except Exception:
        pass
    ENV_PATH.write_text(
        "\n".join(
            [
                f"SECRET={credentials['shared_secret']}",
                f"WINDOWS_TAILSCALE_IP={credentials['paired_device']['direct_host']}",
                f"ALLOWED_PEER={credentials['paired_device']['direct_host']}",
                f"LISTEN_HOST={credentials['transport']['listen_host']}",
                f"PORT={credentials['transport']['port']}",
                f"MAX_CLIPBOARD_BYTES={credentials['max_clipboard_bytes']}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    try:
        ENV_PATH.chmod(0o600)
    except Exception:
        pass
    return credentials


IDENTITY = load_identity()
DEVICE_ID = os.environ.get("DEVICE_ID") or IDENTITY.get("device_id") or ("lb_" + os.urandom(18).hex())
CONTROL_TOKEN = os.environ.get("CONTROL_TOKEN") or IDENTITY.get("control_token") or os.urandom(24).hex()


def tailscale_ip():
    env_ip = os.environ.get("MY_IP")
    if env_ip:
        return env_ip
    try:
        import re
        if sys.platform == "win32":
            out = subprocess.check_output(["ipconfig"]).decode(errors="ignore")
            for m in re.finditer(r"IPv4 Address[ .]*: (\d+\.\d+\.\d+\.\d+)", out):
                ip = m.group(1)
                parts = ip.split(".")
                if parts[0] == "100" and 64 <= int(parts[1]) <= 127:
                    return ip
        else:
            out = subprocess.check_output(["ifconfig"]).decode(errors="ignore")
            for m in re.finditer(r"inet (\d+\.\d+\.\d+\.\d+)", out):
                ip = m.group(1)
                parts = ip.split(".")
                if parts[0] == "100" and 64 <= int(parts[1]) <= 127:
                    return ip
    except Exception:
        pass
    return "127.0.0.1"


MY_IP = os.environ.get("MY_IP") or tailscale_ip()
MY_ENDPOINT = f"ws://{MY_IP}:{SYNC_PORT}"

state = {
    "deviceId": DEVICE_ID,
    "deviceName": DEVICE_NAME,
    "platform": PLATFORM,
    "state": "UNPAIRED",
    "syncEnabled": False,
    "engineRunning": False,
    "backendBaseUrl": BACKEND,
    "controlHost": CONTROL_HOST,
    "controlPort": CONTROL_PORT,
    "hasCredentials": False,
    "pairedDevice": {},
}
state_lock = threading.Lock()
sync_proc = None
sync_lock = threading.Lock()


LOCAL_DASHBOARD_HTML = b"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LocalBridge Agent</title>
  <style>
    :root { color: #17201b; background: #f6f7f4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; }
    main { max-width: 880px; margin: 0 auto; }
    h1 { font-size: 42px; margin: 0 0 8px; }
    p { color: #526058; line-height: 1.5; }
    .panel { background: white; border: 1px solid #d6ded7; border-radius: 8px; padding: 20px; margin-top: 20px; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-top: 16px; }
    button { min-height: 42px; border: 0; border-radius: 8px; background: #17201b; color: white; font: inherit; font-weight: 700; cursor: pointer; padding: 10px 12px; }
    button.secondary { background: #eef2ef; color: #17201b; }
    input { width: 100%; min-height: 42px; border: 1px solid #ccd5ce; border-radius: 8px; padding: 8px 10px; font: inherit; }
    label { display: grid; gap: 6px; font-weight: 700; color: #425047; }
    pre { overflow: auto; background: #f2f5f7; border-radius: 8px; padding: 12px; }
    .ok { color: #13795b; font-weight: 800; }
    .bad { color: #a33a2f; font-weight: 800; }
  </style>
</head>
<body>
  <main>
    <h1>LocalBridge Agent</h1>
    <p>This local dashboard talks directly to the native agent on this computer.</p>
    <div class="panel">
      <strong id="state">Loading...</strong>
      <p id="message"></p>
      <div class="grid">
        <label>6-digit pairing code <input id="pairingId" inputmode="numeric" maxlength="6" placeholder="123456" /></label>
      </div>
      <div class="grid">
        <button onclick="registerDevice()">Register device</button>
        <button onclick="createSession()">Create session</button>
        <button onclick="joinSession()">Join session</button>
        <button onclick="approveSession()">Finish pairing</button>
        <button class="secondary" onclick="copyPairingId()">Copy ID</button>
        <button class="secondary" onclick="reconnect()">Reconnect</button>
        <button class="secondary" onclick="disconnect()">Disconnect</button>
        <button class="secondary" onclick="removePairing()">Remove</button>
      </div>
    </div>
    <div class="panel">
      <strong>Status</strong>
      <pre id="status"></pre>
    </div>
  </main>
  <script>
    let statusPayload = null;
    const el = (id) => document.getElementById(id);
    async function api(path, body) {
      const options = body === undefined ? {} : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {})
      };
      const response = await fetch(path, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    }
    function setMessage(text, ok = true) {
      el("message").textContent = text;
      el("message").className = ok ? "ok" : "bad";
    }
    async function refresh() {
      try {
        statusPayload = await api("/api/status");
        el("state").textContent = statusPayload.state + " - " + statusPayload.deviceName;
        el("status").textContent = JSON.stringify(statusPayload, null, 2);
        if (!el("message").textContent) setMessage("Agent detected.");
      } catch (error) {
        setMessage(String(error), false);
      }
    }
    async function registerDevice() {
      try { statusPayload = await api("/api/register", {}); setMessage("Device registered."); await refresh(); }
      catch (error) { setMessage(String(error), false); }
    }
    async function createSession() {
      try {
        const data = await api("/api/pairing/session", { deviceId: statusPayload && statusPayload.deviceId });
        el("pairingId").value = data.pairingId;
        setMessage("Pairing session created. Copy the Pairing ID to the other device.");
        await refresh();
      } catch (error) { setMessage(String(error), false); }
    }
    async function joinSession() {
      try { await api("/api/pairing/join", { pairingId: el("pairingId").value, deviceId: statusPayload && statusPayload.deviceId }); setMessage("Joined session. Finish pairing on the first device."); await refresh(); }
      catch (error) { setMessage(String(error), false); }
    }
    async function approveSession() {
      try { statusPayload = await api("/api/pairing/approve", { pairingId: el("pairingId").value }); setMessage("Pairing finished."); await refresh(); }
      catch (error) { setMessage(String(error), false); }
    }
    async function copyPairingId() {
      await navigator.clipboard.writeText(el("pairingId").value);
      setMessage("Pairing ID copied.");
    }
    async function reconnect() { try { await api("/api/reconnect", {}); setMessage("Reconnect requested."); await refresh(); } catch (error) { setMessage(String(error), false); } }
    async function disconnect() { try { await api("/api/disconnect", {}); setMessage("Disconnected."); await refresh(); } catch (error) { setMessage(String(error), false); } }
    async function removePairing() { try { await api("/api/remove", {}); setMessage("Pairing removed."); await refresh(); } catch (error) { setMessage(String(error), false); } }
    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>"""


def backend_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BACKEND + path, data=data, headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def register_with_backend():
    return backend_post("/register", {
        "deviceId": DEVICE_ID,
        "deviceName": DEVICE_NAME,
        "platform": PLATFORM,
        "directEndpoint": MY_ENDPOINT,
        "controlToken": CONTROL_TOKEN,
    })


def poll_backend_once():
    code, resp = backend_post("/device/poll", {"deviceId": DEVICE_ID, "controlToken": CONTROL_TOKEN})
    if code == 404:
        register_with_backend()
        return
    if code != 200:
        return
    credentials_payload = resp.get("credentials")
    if credentials_payload:
        existing = load_credentials()
        if existing.get("shared_secret") != credentials_payload.get("sharedSecret"):
            credentials = save_pairing_credentials(credentials_payload)
            with state_lock:
                state["hasCredentials"] = True
                state["state"] = "PAIRED"
                state["pairedDevice"] = credentials.get("paired_device", {})
            restart_sync()
        elif existing.get("shared_secret"):
            refresh_state_from_disk()
            if not (sync_proc and sync_proc.poll() is None):
                start_sync()


def backend_poll_loop():
    while True:
        try:
            register_with_backend()
            poll_backend_once()
        except Exception as exc:
            log("backend poll error: " + str(exc))
        time.sleep(5)


def sync_command():
    credentials = load_credentials()
    transport = (credentials.get("transport") or {}).get("kind", "cloud-relay")
    relay_script = os.path.join(CONFIG_DIR, "cloud_relay.py")
    if transport == "cloud-relay" and not direct_transport_available(credentials) and os.path.exists(relay_script):
        return [sys.executable, relay_script]
    if PLATFORM == "macos":
        return [sys.executable, os.path.join(CONFIG_DIR, "mac", "sync_client.py")]
    # Windows: launch the proven server.py (handles win32clipboard).
    override = os.environ.get("SYNC_SCRIPT")
    if override:
        return [sys.executable, override]
    return [sys.executable, os.path.join(CONFIG_DIR, "windows", "server.py")]


def sync_environment():
    env = os.environ.copy()
    creds = load_credentials()
    paired = creds.get("paired_device", {})
    transport = creds.get("transport", {})
    env["LOCALBRIDGE_HOME"] = str(CONFIG_DIR)
    env["LOCALBRIDGE_ENV_PATH"] = str(ENV_PATH)
    env["LOCALBRIDGE_CREDENTIALS_PATH"] = str(CREDENTIALS_PATH)
    env["LOCALBRIDGE_BACKEND_BASE_URL"] = BACKEND
    env["LOCALBRIDGE_DEVICE_ID"] = DEVICE_ID
    env["LOCALBRIDGE_CONTROL_TOKEN"] = CONTROL_TOKEN
    if creds.get("shared_secret"):
        env["LOCALBRIDGE_SECRET"] = str(creds["shared_secret"])
    if paired.get("direct_host"):
        env["LOCALBRIDGE_WIN_IP"] = str(paired["direct_host"])
    if transport.get("port"):
        env["LOCALBRIDGE_PORT"] = str(transport["port"])
    return env


def start_sync():
    global sync_proc
    with sync_lock:
        if sync_proc and sync_proc.poll() is None:
            return
        try:
            Path(LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
            sync_proc = subprocess.Popen(
                sync_command(), cwd=CONFIG_DIR,
                stdout=open(LOG_PATH, "a"), stderr=subprocess.STDOUT,
                env=sync_environment(),
            )
            with state_lock:
                state["engineRunning"] = True
                state["syncEnabled"] = True
            log("sync engine started pid=" + str(sync_proc.pid))
        except Exception as e:
            log("start_sync error: " + str(e))


def restart_sync():
    stop_sync()
    time.sleep(0.5)
    start_sync()


def stop_sync():
    global sync_proc
    with sync_lock:
        if sync_proc:
            try:
                sync_proc.terminate()
            except Exception:
                pass
            sync_proc = None
        with state_lock:
            state["engineRunning"] = False
            state["syncEnabled"] = False


def extract_peer(creds):
    for d in creds.get("devices", []):
        if d.get("deviceId") != DEVICE_ID:
            return d
    return None


def refresh_state_from_disk():
    credentials = load_credentials()
    if not credentials.get("shared_secret"):
        return
    with state_lock:
        state["hasCredentials"] = True
        state["state"] = "CONNECTED" if sync_proc and sync_proc.poll() is None else "PAIRED"
        state["engineRunning"] = bool(sync_proc and sync_proc.poll() is None)
        state["syncEnabled"] = state["engineRunning"]
        state["pairedDevice"] = credentials.get("paired_device", {})


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(LOCAL_DASHBOARD_HTML)))
            self.end_headers()
            self.wfile.write(LOCAL_DASHBOARD_HTML)
            return
        if self.path == "/api/status":
            refresh_state_from_disk()
            with state_lock:
                self._send(200, dict(state))
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = {}

        if self.path == "/api/register":
            code, resp = register_with_backend()
            if code == 200:
                with state_lock:
                    state["state"] = "UNPAIRED"
            self._send(code, resp)
            return

        if self.path == "/api/pairing/session":
            code, resp = backend_post("/session", {"deviceId": DEVICE_ID})
            if code == 404 and resp.get("error") == "registered device not found":
                register_with_backend()
                code, resp = backend_post("/session", {"deviceId": DEVICE_ID})
            if code == 201:
                with state_lock:
                    state["state"] = "PAIRING"
            self._send(code, resp)
            return

        if self.path == "/api/pairing/join":
            pid = body.get("pairingId", "")
            code, resp = backend_post("/join", {"pairingId": pid, "deviceId": DEVICE_ID})
            if code == 404 and resp.get("error") == "registered device not found":
                register_with_backend()
                code, resp = backend_post("/join", {"pairingId": pid, "deviceId": DEVICE_ID})
            if code == 200:
                with state_lock:
                    state["state"] = "PAIR_APPROVAL_REQUIRED"
            self._send(code, resp)
            return

        if self.path == "/api/pairing/approve":
            pid = body.get("pairingId", "")
            code, resp = backend_post("/approve", {"pairingId": pid})
            if code == 200 and "credentials" in resp:
                credentials = save_pairing_credentials(resp["credentials"])
                with state_lock:
                    state["hasCredentials"] = True
                    state["state"] = "PAIRED"
                    state["pairedDevice"] = credentials.get("paired_device", {})
                restart_sync()
            self._send(code, resp)
            return

        if self.path == "/api/reconnect":
            if state.get("hasCredentials"):
                start_sync()
            with state_lock:
                self._send(200, dict(state))
            return

        if self.path == "/api/disconnect":
            stop_sync()
            with state_lock:
                state["state"] = "DISCONNECTED"
                self._send(200, dict(state))
            return

        if self.path == "/api/remove":
            stop_sync()
            for target in (CREDENTIALS_PATH, ENV_PATH):
                try:
                    if target.exists():
                        target.unlink()
                except Exception as exc:
                    log("remove pairing file error: " + str(exc))
            with state_lock:
                state["hasCredentials"] = False
                state["state"] = "UNPAIRED"
                state["pairedDevice"] = {}
            self._send(200, dict(state))
            return

        if self.path == "/api/send-file":
            try:
                result = queue_outbox_file(body)
                start_sync()
                self._send(200, result)
            except Exception as exc:
                self._send(400, {"error": str(exc)})
            return

        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if load_credentials().get("shared_secret"):
        refresh_state_from_disk()
        start_sync()
    threading.Thread(target=backend_poll_loop, daemon=True).start()
    server = ThreadingHTTPServer((CONTROL_HOST, CONTROL_PORT), Handler)
    log(f"control agent listening on {CONTROL_HOST}:{CONTROL_PORT} device={DEVICE_ID} platform={PLATFORM}")
    server.serve_forever()


if __name__ == "__main__":
    main()
