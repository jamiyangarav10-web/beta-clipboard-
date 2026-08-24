import React, { useEffect, useState } from "react";
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

type AgentStatus = {
  deviceId: string;
  deviceName: string;
  platform: string;
  state: PairingState;
  syncEnabled: boolean;
  engineRunning: boolean;
  backendBaseUrl: string;
  controlPort: number;
  hasCredentials: boolean;
  pairedDevice: {
    device_id?: string;
    device_name?: string;
    platform?: string;
    direct_host?: string;
  };
};

type ApiResponse<T> = {
  status: number;
  body: T;
};

const CONTROL_URL = "http://127.0.0.1:17833";

function App() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [pairingId, setPairingId] = useState("");
  const [joinPairingId, setJoinPairingId] = useState("");
  const [message, setMessage] = useState("Connect a native agent to start.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const response = await fetch(`${CONTROL_URL}/api/status`);
        if (!response.ok) {
          throw new Error("agent unavailable");
        }
        const data = (await response.json()) as AgentStatus;
        if (mounted) {
          setStatus(data);
          setMessage(data.hasCredentials ? "Agent connected" : "Agent detected");
        }
      } catch {
        if (mounted) {
          setStatus(null);
          setMessage("Open the LocalBridge agent on this computer.");
        }
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 2000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const callAgent = async <T,>(path: string, body?: unknown) => {
    setBusy(true);
    try {
      const response = await fetch(`${CONTROL_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await response.json()) as T;
      return { status: response.status, body: data } as ApiResponse<T>;
    } finally {
      setBusy(false);
    }
  };

  const registerDevice = async () => {
    const result = await callAgent<AgentStatus>("/api/register");
    if (result.status >= 200 && result.status < 300) {
      setStatus(result.body);
      setMessage("Device registered with the agent.");
    } else {
      setMessage("Could not register device.");
    }
  };

  const createSession = async () => {
    const currentDeviceId = status?.deviceId;
    const result = await callAgent<{ pairingId: string }>("/api/pairing/session", {
      deviceId: currentDeviceId,
    });
    if (result.status >= 200 && result.status < 300) {
      setPairingId(result.body.pairingId);
      setJoinPairingId(result.body.pairingId);
      setMessage("Pairing code created. Enter it on your other device.");
    } else {
      setMessage("Could not create pairing session.");
    }
  };

  const joinSession = async () => {
    if (!joinPairingId) {
      setMessage("Paste a pairing ID first.");
      return;
    }
    const result = await callAgent<{ pairingId: string }>("/api/pairing/join", {
      pairingId: joinPairingId,
      deviceId: status?.deviceId,
    });
    if (result.status >= 200 && result.status < 300) {
      setPairingId(result.body.pairingId);
      setMessage("This device joined the pairing session.");
    } else {
      setMessage("Could not join that pairing session.");
    }
  };

  const approveSession = async () => {
    if (!pairingId) {
      setMessage("Create a pairing code first.");
      return;
    }
    const result = await callAgent<AgentStatus>("/api/pairing/approve", {
      pairingId,
    });
    if (result.status >= 200 && result.status < 300) {
      setStatus(result.body);
      setMessage("Pairing finished and credentials stored locally.");
    } else {
      setMessage("Approval failed.");
    }
  };

  const reconnect = async () => {
    const result = await callAgent<AgentStatus>("/api/reconnect");
    if (result.status >= 200 && result.status < 300) {
      setStatus(result.body);
      setMessage("Clipboard sync restarted.");
    }
  };

  const disconnect = async () => {
    const result = await callAgent<AgentStatus>("/api/disconnect");
    if (result.status >= 200 && result.status < 300) {
      setStatus(result.body);
      setMessage("Clipboard sync paused.");
    }
  };

  const removePairing = async () => {
    const result = await callAgent<AgentStatus>("/api/remove");
    if (result.status >= 200 && result.status < 300) {
      setStatus(result.body);
      setPairingId("");
      setJoinPairingId("");
      setMessage("Local pairing removed.");
    }
  };

  const copyPairingId = async () => {
    if (!pairingId) return;
    await navigator.clipboard.writeText(pairingId);
    setMessage("Pairing ID copied.");
  };

  const pairedName = status?.pairedDevice?.device_name || "No paired device yet";

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
          <a className="icon-link" href="https://github.com/YOUR_USERNAME/LocalBridge" aria-label="GitHub">
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
            <a className="button primary" href={CONTROL_URL}>
              <Power size={18} /> Open LocalBridge
            </a>
            <a className="button secondary" href="#downloads">
              <Download size={18} /> Download LocalBridge
            </a>
          </div>
          <p className="connector-note">{message}</p>
        </div>
        <ConnectorPanel
          agentOnline={Boolean(status)}
          busy={busy}
          status={status}
          pairingId={pairingId}
          joinPairingId={joinPairingId}
          setJoinPairingId={setJoinPairingId}
          setPairingId={setPairingId}
          registerDevice={registerDevice}
          createSession={createSession}
          joinSession={joinSession}
          approveSession={approveSession}
          reconnect={reconnect}
          disconnect={disconnect}
          removePairing={removePairing}
          copyPairingId={copyPairingId}
        />
      </section>

      <section id="connect" className="band">
        <div className="section-heading">
          <span className="kicker">Connect your devices</span>
          <h2>Install once, connect once, forget it exists.</h2>
        </div>
        <div className="steps">
          <Step icon={<Download />} title="Install" body="Download the small native agent on each computer." />
          <Step icon={<Link2 />} title="Pair" body="The website talks to the local agent, which registers and pairs with the backend." />
          <Step icon={<Clipboard />} title="Copy & paste" body="After pairing, clipboard text moves directly between your paired agents." />
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
          <SecurityItem
            icon={<Lock />}
            title="Short-lived pairing"
            body="Pairing sessions expire, are single-use, and require explicit device approval."
          />
          <SecurityItem
            icon={<ShieldCheck />}
            title="Native-only clipboard access"
            body="Clipboard reads and writes happen in the Windows and macOS agents, not browser JavaScript."
          />
          <SecurityItem
            icon={<RefreshCw />}
            title="Direct sync path"
            body="After pairing, agents use the existing authenticated WebSocket clipboard engine."
          />
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
              <span>{status ? `${status.platform} agent` : "No agent detected"}</span>
              <span>{status ? status.state : "Install and launch the native app"}</span>
            </div>
          </div>
          <div className="device-list">
            <div className="device-row">
              <div>
                <strong>{status?.deviceName || "This device"}</strong>
                <span>{status?.platform || "Not connected yet"}</span>
              </div>
              <span className="status">
                <i />
                {status?.state || "Offline"}
              </span>
            </div>
            <div className="device-row">
              <div>
                <strong>{pairedName}</strong>
                <span>Paired peer</span>
              </div>
              <span className="status">
                <i />
                {status?.hasCredentials ? "Paired" : "Waiting"}
              </span>
            </div>
          </div>
          <div className="dashboard-actions">
            <button type="button" onClick={reconnect}>
              <RefreshCw size={16} /> Reconnect
            </button>
            <button type="button" onClick={disconnect}>
              <Unlink size={16} /> Disconnect device
            </button>
            <button type="button" onClick={removePairing}>
              <Link2 size={16} /> Remove paired device
            </button>
          </div>
          <p className="last-connection">
            Last connection: {status?.engineRunning ? "Live now" : "Waiting"}
          </p>
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
          <p>Unsigned beta downloads may need operating-system approval. Pair both devices within five minutes so the short-lived session does not expire.</p>
        </details>
      </section>
    </main>
  );
}

function ConnectorPanel({
  agentOnline,
  busy,
  status,
  pairingId,
  joinPairingId,
  setJoinPairingId,
  setPairingId,
  registerDevice,
  createSession,
  joinSession,
  approveSession,
  reconnect,
  disconnect,
  removePairing,
  copyPairingId,
}: {
  agentOnline: boolean;
  busy: boolean;
  status: AgentStatus | null;
  pairingId: string;
  joinPairingId: string;
  setJoinPairingId: (value: string) => void;
  setPairingId: (value: string) => void;
  registerDevice: () => Promise<void>;
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  approveSession: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  removePairing: () => Promise<void>;
  copyPairingId: () => Promise<void>;
}) {
  const statusLabel = status?.state || (agentOnline ? "Agent detected" : "Waiting for agent");
  const peerName = status?.pairedDevice?.device_name || "No paired device yet";

  return (
    <aside className="panel connector-panel" aria-label="LocalBridge connector">
      <div className="panel-title">
        <span>
          <Smartphone size={18} /> {statusLabel}
        </span>
        <CheckCircle2 size={18} />
      </div>
      <div className="connection-map">
        <div>
          <Laptop size={22} />
          <span>{status?.deviceName || "This device"}</span>
        </div>
        <ArrowRight size={18} />
        <div>
          <Monitor size={22} />
          <span>{peerName}</span>
        </div>
      </div>
      <div className="state-list">
        {["UNPAIRED", "PAIRING", "PAIR_APPROVAL_REQUIRED", "PAIRED", "CONNECTED", "DISCONNECTED", "RECONNECTING"].map((state, index) => (
          <span className={index === statusIndex(status?.state) ? "active-state" : ""} key={state}>
            {state}
          </span>
        ))}
      </div>
      <div className="connector-meta">
        <p>{agentOnline ? "Local agent connected on this machine." : "Start the native app to bring the connector online."}</p>
        <p>{status?.backendBaseUrl ? `Backend: ${status.backendBaseUrl}` : "Backend not configured yet."}</p>
      </div>
      {!agentOnline ? (
        <a className="button primary local-dashboard-link" href={CONTROL_URL}>
          <Power size={16} /> Open LocalBridge
        </a>
      ) : null}
      <div className="pairing-fields">
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
        <button type="button" onClick={registerDevice} disabled={busy || !agentOnline}>
          <ShieldCheck size={16} /> Register device
        </button>
        <button type="button" onClick={createSession} disabled={busy || !agentOnline}>
          <Link2 size={16} /> Create session
        </button>
        <button type="button" onClick={joinSession} disabled={busy || !agentOnline}>
          <Clipboard size={16} /> Join session
        </button>
        <button type="button" onClick={approveSession} disabled={busy || !agentOnline}>
          <CheckCircle2 size={16} /> Finish pairing
        </button>
        <button type="button" onClick={copyPairingId} disabled={!pairingId || !agentOnline}>
          <Copy size={16} /> Copy ID
        </button>
        <button type="button" onClick={reconnect} disabled={busy || !agentOnline}>
          <RefreshCw size={16} /> Reconnect
        </button>
        <button type="button" onClick={disconnect} disabled={busy || !agentOnline}>
          <Unlink size={16} /> Disconnect
        </button>
        <button type="button" onClick={removePairing} disabled={busy || !agentOnline}>
          <Link2 size={16} /> Remove
        </button>
      </div>
      <div className="session-summary">
        <strong>{pairingId ? `Code ${pairingId}` : "No pairing code yet"}</strong>
        <span>{pairingId ? "Enter this 6-digit code on the other device, then finish pairing here." : "Create a code on one device to start pairing."}</span>
        <span>{status?.hasCredentials ? "Credentials stored locally." : "Credentials will be stored locally after pairing."}</span>
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
