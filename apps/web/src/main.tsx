import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Github,
  Laptop,
  Link2,
  Lock,
  Monitor,
  Power,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unlink
} from "lucide-react";
import "./styles.css";

type PairingState =
  | "UNPAIRED"
  | "PAIRING"
  | "PAIR_APPROVAL_REQUIRED"
  | "PAIRED"
  | "CONNECTED"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "PAUSED";

type Device = {
  deviceId: string;
  deviceName: string;
  platform: string;
  directEndpoint?: string;
};

const BACKEND_URL = "/.netlify/functions/pairing";

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [pairingId, setPairingId] = useState("");
  const [joinPairingId, setJoinPairingId] = useState("");
  const [state, setState] = useState<PairingState>("UNPAIRED");
  const [message, setMessage] = useState("Install and start LocalBridge on each computer.");
  const [busy, setBusy] = useState(false);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );
  const peerName = state === "PAIRED" || state === "CONNECTED" ? "Paired device" : "No paired device yet";

  useEffect(() => {
    let mounted = true;
    const refreshDevices = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/devices`, { cache: "no-store" });
        const data = (await response.json()) as { devices: Device[] };
        if (!mounted) return;
        const onlineDevices = data.devices || [];
        setDevices(onlineDevices);
        setSelectedDeviceId((current) => {
          if (current && onlineDevices.some((device) => device.deviceId === current)) return current;
          return onlineDevices[0]?.deviceId || "";
        });
        setMessage(onlineDevices.length ? "Choose this computer, then create or join a pairing code." : "Start the LocalBridge app on each computer.");
      } catch {
        if (mounted) setMessage("Could not reach the pairing backend.");
      }
    };

    refreshDevices();
    const interval = window.setInterval(refreshDevices, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const callBackend = async <T,>(path: string, body?: unknown) => {
    setBusy(true);
    try {
      const response = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await response.json()) as T & { error?: string };
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      return data as T;
    } finally {
      setBusy(false);
    }
  };

  const requireDevice = () => {
    if (!selectedDeviceId) {
      setMessage("Start the LocalBridge app on this computer first.");
      return false;
    }
    return true;
  };

  const createSession = async () => {
    if (!requireDevice()) return;
    try {
      const data = await callBackend<{ pairingId: string; state: PairingState }>("/session", {
        deviceId: selectedDeviceId,
      });
      setPairingId(data.pairingId);
      setJoinPairingId(data.pairingId);
      setState(data.state);
      setMessage("Enter this 6-digit code on the other computer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create pairing code.");
    }
  };

  const joinSession = async () => {
    if (!requireDevice()) return;
    if (!joinPairingId) {
      setMessage("Enter the 6-digit pairing code first.");
      return;
    }
    try {
      const data = await callBackend<{ pairingId: string; state: PairingState }>("/join", {
        pairingId: joinPairingId,
        deviceId: selectedDeviceId,
      });
      setPairingId(data.pairingId);
      setState(data.state);
      setMessage("Joined. Finish pairing from the computer that created the code.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join that pairing code.");
    }
  };

  const approveSession = async () => {
    const code = pairingId || joinPairingId;
    if (!code) {
      setMessage("Create or enter a pairing code first.");
      return;
    }
    try {
      const data = await callBackend<{ pairingId: string; state: PairingState }>("/approve", {
        pairingId: code,
      });
      setPairingId(data.pairingId);
      setState(data.state);
      setMessage("Pairing finished. LocalBridge agents will connect automatically.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not finish pairing.");
    }
  };

  const copyPairingId = async () => {
    if (!pairingId) return;
    await navigator.clipboard.writeText(pairingId);
    setMessage("Pairing code copied.");
  };

  const reconnect = async () => setMessage("LocalBridge reconnects automatically after pairing.");
  const disconnect = async () => setMessage("Use the LocalBridge app on the computer to pause syncing.");
  const removePairing = async () => {
    setPairingId("");
    setJoinPairingId("");
    setState("UNPAIRED");
    setMessage("Pairing code cleared on this page.");
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LocalBridge home">
          <span className="brand-mark">
            <Clipboard size={18} />
          </span>
          <span>LocalBridge</span>
          <span className="badge">Beta</span>
        </a>
        <nav>
          <a href="#connect">Connector</a>
          <a href="#downloads">Downloads</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
          <a className="icon-link" href="https://github.com/jamiyangarav10-web/beta-clipboard-" aria-label="GitHub">
            <Github size={18} />
          </a>
        </nav>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <ShieldCheck size={16} /> Native clipboard sync for your own devices
          </p>
          <h1>Copy on one device. Paste on another.</h1>
          <p className="subtext">
            LocalBridge keeps your clipboard in sync across your devices without making you configure IP addresses,
            ports, secrets, or terminal commands.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#connect">
              <Power size={18} /> Connect my devices
            </a>
            <a className="button secondary" href="#downloads">
              <Download size={18} /> Download LocalBridge
            </a>
          </div>
          <p className="connector-note">{message}</p>
        </div>
        <ConnectorPanel
          devices={devices}
          selectedDevice={selectedDevice}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          busy={busy}
          state={state}
          pairingId={pairingId}
          joinPairingId={joinPairingId}
          setJoinPairingId={setJoinPairingId}
          createSession={createSession}
          joinSession={joinSession}
          approveSession={approveSession}
          reconnect={reconnect}
          disconnect={disconnect}
          removePairing={removePairing}
          copyPairingId={copyPairingId}
          peerName={peerName}
        />
      </section>

      <section id="connect" className="band">
        <div className="section-heading">
          <span className="kicker">Connect your devices</span>
          <h2>Install once, connect once, forget it exists.</h2>
        </div>
        <div className="steps">
          <Step icon={<Download />} title="Install" body="Download the small native agent on each computer." />
          <Step icon={<Link2 />} title="Pair" body="Choose each online device on this website and pair with a 6-digit code." />
          <Step icon={<Clipboard />} title="Copy & paste" body="After pairing, the native agents sync clipboard text directly." />
        </div>
      </section>

      <section id="downloads" className="downloads">
        <div>
          <span className="kicker">Downloads</span>
          <h2>Choose your device</h2>
          <p>Download the beta installer on each computer, run setup, then return here to pair your devices.</p>
        </div>
        <div className="download-grid">
          <a className="download-card" href="/downloads/LocalBridge-Windows.zip">
            <Monitor size={24} />
            <strong>Windows</strong>
            <span>LocalBridge-Windows.zip</span>
          </a>
          <a className="download-card" href="/downloads/LocalBridge-Mac.zip">
            <Laptop size={24} />
            <strong>macOS</strong>
            <span>LocalBridge-Mac.zip</span>
          </a>
        </div>
      </section>

      <section id="privacy" className="security">
        <div className="section-heading">
          <span className="kicker">Privacy and security</span>
          <h2>The website pairs devices. It does not sync clipboard contents.</h2>
        </div>
        <div className="security-grid">
          <SecurityItem icon={<Lock />} title="Short-lived pairing" body="Pairing sessions expire and are single-use." />
          <SecurityItem icon={<ShieldCheck />} title="Native-only clipboard access" body="Clipboard reads and writes happen in the Windows and macOS agents, not browser JavaScript." />
          <SecurityItem icon={<RefreshCw />} title="Direct sync path" body="After pairing, agents use the authenticated WebSocket clipboard engine." />
        </div>
      </section>

      <section className="dashboard">
        <div className="dashboard-shell">
          <div className="dashboard-header">
            <div>
              <span className="kicker">Dashboard</span>
              <h2>LocalBridge</h2>
            </div>
            <div className="dashboard-status">
              <span>{devices.length ? `${devices.length} online` : "No agent online"}</span>
              <span>{state}</span>
            </div>
          </div>
          <div className="device-list">
            {devices.map((device) => (
              <div className="device-row" key={device.deviceId}>
                <div>
                  <strong>{device.deviceName}</strong>
                  <span>{device.platform}</span>
                </div>
                <span className="status">
                  <i />
                  Online
                </span>
              </div>
            ))}
          </div>
          <p className="last-connection">Last connection: {state === "PAIRED" ? "Pairing finished" : "Waiting"}</p>
        </div>
      </section>

      <section id="faq" className="faq">
        <span className="kicker">FAQ</span>
        <h2>Good things to know</h2>
        <details>
          <summary>Can the website sync my clipboard by itself?</summary>
          <p>No. Browsers cannot silently read and write your operating-system clipboard across two computers.</p>
        </details>
        <details>
          <summary>Does LocalBridge store clipboard history in the cloud?</summary>
          <p>No. The Netlify layer is for short-lived pairing and control metadata only.</p>
        </details>
        <details>
          <summary>What still needs setup during beta?</summary>
          <p>Unsigned beta downloads may need operating-system approval. Keep the LocalBridge app running on both computers.</p>
        </details>
      </section>
    </main>
  );
}

function ConnectorPanel({
  devices,
  selectedDevice,
  selectedDeviceId,
  setSelectedDeviceId,
  busy,
  state,
  pairingId,
  joinPairingId,
  setJoinPairingId,
  createSession,
  joinSession,
  approveSession,
  reconnect,
  disconnect,
  removePairing,
  copyPairingId,
  peerName,
}: {
  devices: Device[];
  selectedDevice: Device | null;
  selectedDeviceId: string;
  setSelectedDeviceId: (value: string) => void;
  busy: boolean;
  state: PairingState;
  pairingId: string;
  joinPairingId: string;
  setJoinPairingId: (value: string) => void;
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  approveSession: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  removePairing: () => Promise<void>;
  copyPairingId: () => Promise<void>;
  peerName: string;
}) {
  return (
    <aside className="panel connector-panel" aria-label="LocalBridge connector">
      <div className="panel-title">
        <span>
          <Smartphone size={18} /> {devices.length ? "Agent online" : "Waiting for agent"}
        </span>
        <CheckCircle2 size={18} />
      </div>
      <div className="connection-map">
        <div>
          <Laptop size={22} />
          <span>{selectedDevice?.deviceName || "This device"}</span>
        </div>
        <ArrowRight size={18} />
        <div>
          <Monitor size={22} />
          <span>{peerName}</span>
        </div>
      </div>
      <div className="state-list">
        {["UNPAIRED", "PAIRING", "PAIR_APPROVAL_REQUIRED", "PAIRED", "CONNECTED", "DISCONNECTED", "RECONNECTING"].map((item, index) => (
          <span className={index === statusIndex(state) ? "active-state" : ""} key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className="connector-meta">
        <p>{devices.length ? "Choose the LocalBridge agent running on this computer." : "Start the native app to bring a device online."}</p>
        <p>Backend: {BACKEND_URL}</p>
      </div>
      <div className="pairing-fields">
        <label>
          This computer
          <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
            <option value="">No online device</option>
            {devices.map((device) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.deviceName} ({device.platform})
              </option>
            ))}
          </select>
        </label>
        <label>
          6-digit pairing code
          <input
            value={joinPairingId}
            onChange={(event) => setJoinPairingId(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
          />
        </label>
      </div>
      <div className="demo-actions">
        <button type="button" onClick={createSession} disabled={busy || !selectedDeviceId}>
          <Link2 size={16} /> Create code
        </button>
        <button type="button" onClick={joinSession} disabled={busy || !selectedDeviceId}>
          <Clipboard size={16} /> Join code
        </button>
        <button type="button" onClick={approveSession} disabled={busy}>
          <CheckCircle2 size={16} /> Finish pairing
        </button>
        <button type="button" onClick={copyPairingId} disabled={!pairingId}>
          <Copy size={16} /> Copy code
        </button>
        <button type="button" onClick={reconnect} disabled={busy}>
          <RefreshCw size={16} /> Reconnect
        </button>
        <button type="button" onClick={disconnect} disabled={busy}>
          <Unlink size={16} /> Disconnect
        </button>
        <button type="button" onClick={removePairing} disabled={busy}>
          <Link2 size={16} /> Remove
        </button>
      </div>
      <div className="session-summary">
        <strong>{pairingId ? `Code ${pairingId}` : "No pairing code yet"}</strong>
        <span>{pairingId ? "Enter this code on the other computer, then finish pairing here." : "Create a code on one device to start pairing."}</span>
        <span>Credentials are delivered to the native agents automatically.</span>
      </div>
    </aside>
  );
}

function statusIndex(state: PairingState | undefined) {
  switch (state) {
    case "PAIRING":
      return 1;
    case "PAIR_APPROVAL_REQUIRED":
      return 2;
    case "PAIRED":
      return 3;
    case "CONNECTED":
      return 4;
    case "DISCONNECTED":
      return 5;
    case "RECONNECTING":
      return 6;
    default:
      return 0;
  }
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="step">
      {icon}
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function SecurityItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="security-item">
      {icon}
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
