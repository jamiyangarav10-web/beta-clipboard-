import json
import urllib.error
import urllib.request

from .config import save_credentials
from .identity import load_or_create_identity


def post_json(base_url: str, path: str, payload: dict, timeout: float = 10) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                "status": response.status,
                "body": json.loads(response.read().decode("utf-8")),
            }
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8") if error.fp else "{}"
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"error": body or error.reason}
        return {"status": error.code, "body": parsed}
    except Exception as error:
        return {"status": 503, "body": {"error": str(error)}}


def register_device(base_url: str, direct_endpoint: str = "") -> dict:
    identity = load_or_create_identity()
    return post_json(base_url, "/api/pairing/register", {
        "deviceId": identity["device_id"],
        "deviceName": identity["device_name"],
        "platform": identity["platform"],
        "directEndpoint": direct_endpoint,
    })


def write_pairing_credentials(pairing_result: dict, local_device_id: str) -> None:
    credentials = pairing_result.get("body", pairing_result)["credentials"]
    devices = credentials["devices"]
    peer = next(device for device in devices if device["deviceId"] != local_device_id)
    direct_host = peer.get("directEndpoint", "").split(":", 1)[0]
    port = int(peer.get("directEndpoint", ":8765").split(":")[-1] or "8765")
    save_credentials({
        "shared_secret": credentials["sharedSecret"],
        "max_clipboard_bytes": credentials["maxClipboardBytes"],
        "paired_device": {
            "device_id": peer["deviceId"],
            "device_name": peer["deviceName"],
            "platform": peer["platform"],
            "direct_host": direct_host,
        },
        "transport": {
            "kind": credentials["transport"],
            "port": port,
        },
    })
