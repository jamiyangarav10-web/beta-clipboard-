#!/usr/bin/env python3
"""Minimal LocalBridge Windows agent shell with local control API."""
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
SHARED_PATH = ROOT / "packages" / "shared"
if SHARED_PATH.exists():
    sys.path.insert(0, str(SHARED_PATH))

from localbridge.agent_runtime import AgentRuntime
from localbridge.control_server import start_control_server

SERVER = ROOT / "windows" / "server.py"
RUNTIME = AgentRuntime("windows", SERVER)


class AgentWindow:
    def __init__(self) -> None:
        self.server = start_control_server(RUNTIME)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

        self.root = tk.Tk()
        self.root.title("LocalBridge")
        self.root.geometry("360x300")
        self.root.resizable(False, False)
        self.sync_enabled = tk.BooleanVar(value=True)
        self.build()
        self.root.protocol("WM_DELETE_WINDOW", self.hide)
        self.root.after(1500, self.refresh_state)

    def build(self) -> None:
        frame = tk.Frame(self.root, padx=24, pady=20)
        frame.pack(fill="both", expand=True)
        tk.Label(frame, text="LocalBridge", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        self.status_label = tk.Label(frame, text="Ready", fg="#13795b", font=("Segoe UI", 11, "bold"))
        self.status_label.pack(anchor="w", pady=(4, 20))
        tk.Label(frame, text="Devices", font=("Segoe UI", 10, "bold")).pack(anchor="w")
        self.device_label = tk.Label(frame, text="Paired device appears after website pairing", fg="#425047")
        self.device_label.pack(anchor="w", pady=(3, 16))
        tk.Checkbutton(frame, text="Clipboard Sync", variable=self.sync_enabled, command=self.toggle_sync).pack(anchor="w", pady=(0, 14))
        tk.Button(frame, text="Reconnect", command=self.reconnect).pack(fill="x", pady=3)
        tk.Button(frame, text="Disconnect device", command=self.disconnect).pack(fill="x", pady=3)
        tk.Button(frame, text="Remove paired device", command=self.remove_pairing).pack(fill="x", pady=3)

    def start(self) -> None:
        self.reconnect()
        self.root.mainloop()

    def refresh_state(self) -> None:
        payload = RUNTIME.status_payload()
        state = payload.get("state", "UNPAIRED")
        self.status_label.configure(
            text=state if state not in {"UNPAIRED", "PAIRED"} else "Waiting for pairing",
        )
        paired = payload.get("pairedDevice") or {}
        if paired.get("device_name"):
            self.device_label.configure(text=paired["device_name"])
        elif state in {"UNPAIRED", "PAIRED"}:
            self.device_label.configure(text="Paired device appears after website pairing")
        elif state == "CONNECTED":
            self.device_label.configure(text="Connected")
        elif state == "PAUSED":
            self.device_label.configure(text="Clipboard sync paused")
        if self.sync_enabled.get() and state in {"UNPAIRED", "PAIRED"} and not RUNTIME.engine_running():
            RUNTIME.reconnect()
        self.root.after(1500, self.refresh_state)

    def reconnect(self) -> None:
        if not self.sync_enabled.get():
            RUNTIME.disconnect()
            self.status_label.configure(text="Paused")
            return
        RUNTIME.reconnect()
        self.status_label.configure(text="Waiting for pairing" if not RUNTIME.credentials().get("shared_secret") else "Connected")

    def toggle_sync(self) -> None:
        if self.sync_enabled.get():
            self.reconnect()
        else:
            RUNTIME.disconnect()
            self.status_label.configure(text="Paused")

    def disconnect(self) -> None:
        RUNTIME.disconnect()
        self.status_label.configure(text="Disconnected")

    def remove_pairing(self) -> None:
        RUNTIME.remove_pairing()
        self.status_label.configure(text="Unpaired")
        messagebox.showinfo("LocalBridge", "Paired device removed.")

    def hide(self) -> None:
        self.root.withdraw()


if __name__ == "__main__":
    AgentWindow().start()
