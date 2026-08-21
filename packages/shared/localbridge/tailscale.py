import subprocess


def detect_tailscale_ip() -> str:
    try:
        completed = subprocess.run(
            ["tailscale", "ip", "-4"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
    except Exception:
        return ""

    if completed.returncode != 0:
        return ""

    for line in completed.stdout.splitlines():
        value = line.strip()
        if value:
            return value
    return ""
