import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable


def create_control_handler(runtime):
    class ControlHandler(BaseHTTPRequestHandler):
        def _send_json(self, status_code: int, payload: dict) -> None:
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status_code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.send_header("access-control-allow-origin", "*")
            self.send_header("access-control-allow-headers", "content-type")
            self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("access-control-allow-origin", "*")
            self.send_header("access-control-allow-headers", "content-type")
            self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
            self.end_headers()

        def do_GET(self):
            if self.path == "/api/status":
                self._send_json(200, runtime.status_payload())
                return
            if self.path == "/api/health":
                self._send_json(200, {"ok": True})
                return
            self._send_json(404, {"error": "not found"})

        def do_POST(self):
            length = int(self.headers.get("content-length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception:
                body = {}

            if self.path == "/api/register":
                self._send_json(*unwrap(runtime.register()))
                return
            if self.path == "/api/pairing/session":
                self._send_json(*unwrap(runtime.create_session(body)))
                return
            if self.path == "/api/pairing/join":
                self._send_json(*unwrap(runtime.join_session(body)))
                return
            if self.path == "/api/pairing/approve":
                self._send_json(*unwrap(runtime.approve_session(body)))
                return
            if self.path == "/api/reconnect":
                self._send_json(200, runtime.reconnect())
                return
            if self.path == "/api/disconnect":
                self._send_json(200, runtime.disconnect())
                return
            if self.path == "/api/remove":
                self._send_json(200, runtime.remove_pairing())
                return
            self._send_json(404, {"error": "not found"})

        def log_message(self, format, *args):  # noqa: A003
            return

    return ControlHandler


def unwrap(result):
    if isinstance(result, tuple) and len(result) == 2:
        return result
    if isinstance(result, dict) and "status" in result and "body" in result:
        return result["status"], result["body"]
    return 200, result


def start_control_server(runtime, host: str = "127.0.0.1", port: int = 17833) -> ThreadingHTTPServer:
    handler = create_control_handler(runtime)
    server = ThreadingHTTPServer((host, port), handler)
    return server
