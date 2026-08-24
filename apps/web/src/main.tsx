import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Github,
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
  state?: PairingState;
  currentPairingId?: string | null;
};

type Language = "en" | "mn";

const LOCAL_AGENT_URLS = ["http://localhost:17833", "http://127.0.0.1:17833"];

type AgentStatus = {
  deviceId: string;
  deviceName: string;
  platform: string;
  state: PairingState;
  hasCredentials: boolean;
  pairedDevice?: {
    device_id?: string;
    device_name?: string;
    platform?: string;
    direct_host?: string;
  };
};

const COPY = {
  en: {
    navConnect: "Connector",
    navDownloads: "Downloads",
    navPrivacy: "Privacy",
    navFaq: "FAQ",
    beta: "Beta",
    language: "Language",
    eyebrow: "Native clipboard sync for your own devices",
    heroTitle: "Copy on one device. Paste on another.",
    heroText: "LocalBridge keeps your clipboard in sync across your devices without making you configure IP addresses, ports, secrets, or terminal commands.",
    connectCta: "Connect my devices",
    downloadCta: "Download LocalBridge",
    installStart: "Install and start LocalBridge on each computer.",
    chooseDevice: "Choose this computer, then create or join a pairing code.",
    startAgent: "Start the LocalBridge app on each computer.",
    backendError: "Could not reach the pairing backend.",
    startThisComputer: "Start the LocalBridge app on this computer first.",
    codeCreated: "Enter this 6-digit code on the other computer.",
    codeCreateError: "Could not create pairing code.",
    enterCode: "Enter the 6-digit pairing code first.",
    joined: "Joined. Finish pairing from the computer that created the code.",
    joinError: "Could not join that pairing code.",
    createOrEnter: "Create or enter a pairing code first.",
    pairedDone: "Connected. Clipboard sync will run through the native agents.",
    finishError: "Could not finish pairing.",
    copied: "Pairing code copied.",
    reconnectAuto: "LocalBridge reconnects automatically after pairing.",
    pauseNative: "Use the LocalBridge app on the computer to pause syncing.",
    cleared: "Pairing code cleared on this page.",
    connectedTitle: "Connection successful",
    connectedBody: "Clipboard sync is active between these devices.",
    connectedTo: "Connected to",
    waitingPeer: "No paired device yet",
    pairedDevice: "Paired device",
    agentOnline: "Agent online",
    waitingAgent: "Waiting for agent",
    thisComputer: "This computer",
    backend: "Backend",
    chooseAgent: "Choose the LocalBridge agent running on this computer.",
    startNative: "Start the native app to bring a device online.",
    pairingCode: "6-digit pairing code",
    noOnline: "No online device",
    createCode: "Create code",
    joinCode: "Join code",
    finishPairing: "Finish pairing",
    copyCode: "Copy code",
    reconnect: "Reconnect",
    disconnect: "Disconnect",
    remove: "Remove",
    noCode: "No pairing code yet",
    codeSummary: "Enter this code on the other computer, then finish pairing here.",
    noCodeSummary: "Create a code on one device to start pairing.",
    credentialsAuto: "Credentials are delivered to the native agents automatically.",
    connectDevices: "Connect your devices",
    sectionTitle: "Install once, connect once, forget it exists.",
    stepInstall: "Install",
    stepInstallBody: "Download the small native agent on each computer.",
    stepPair: "Pair",
    stepPairBody: "Choose each online device on this website and pair with a 6-digit code.",
    stepCopy: "Copy & paste",
    stepCopyBody: "After pairing, the native agents sync clipboard text directly.",
    chooseDeviceTitle: "Choose your device",
    downloadsText: "Download the beta installer on each computer, run setup, then return here to pair your devices.",
    privacy: "Privacy and security",
    privacyTitle: "The website pairs devices. It does not sync clipboard contents.",
    securityShort: "Short-lived pairing",
    securityShortBody: "Pairing sessions expire and are single-use.",
    securityNative: "Native-only clipboard access",
    securityNativeBody: "Clipboard reads and writes happen in the Windows and macOS agents, not browser JavaScript.",
    securityDirect: "Direct sync path",
    securityDirectBody: "After pairing, agents use the authenticated WebSocket clipboard engine.",
    dashboard: "Dashboard",
    online: "online",
    noAgent: "No agent online",
    onlineStatus: "Online",
    lastConnection: "Last connection",
    waiting: "Waiting",
    pairingFinished: "Pairing finished",
    faqTitle: "Good things to know",
    faqBrowser: "Can the website sync my clipboard by itself?",
    faqBrowserBody: "No. Browsers cannot silently read and write your operating-system clipboard across two computers.",
    faqCloud: "Does LocalBridge store clipboard history in the cloud?",
    faqCloudBody: "No. The Netlify layer is for short-lived pairing and control metadata only.",
    faqSetup: "What still needs setup during beta?",
    faqSetupBody: "Unsigned beta downloads may need operating-system approval. Keep the LocalBridge app running on both computers."
  },
  mn: {
    navConnect: "Холбогч",
    navDownloads: "Татах",
    navPrivacy: "Нууцлал",
    navFaq: "Асуулт",
    beta: "Бета",
    language: "Хэл",
    eyebrow: "Өөрийн төхөөрөмжүүдийн native clipboard sync",
    heroTitle: "Нэг дээр copy. Нөгөө дээр paste.",
    heroText: "LocalBridge нь IP, port, secret, terminal command тохируулахгүйгээр таны төхөөрөмжүүдийн clipboard-ийг sync хийнэ.",
    connectCta: "Төхөөрөмж холбох",
    downloadCta: "LocalBridge татах",
    installStart: "Төхөөрөмж бүр дээр LocalBridge суулгаж асаана уу.",
    chooseDevice: "Энэ компьютерыг сонгоод pairing code үүсгэх эсвэл оруулна уу.",
    startAgent: "Төхөөрөмж бүр дээр LocalBridge app-аа асаана уу.",
    backendError: "Pairing backend-тэй холбогдож чадсангүй.",
    startThisComputer: "Эхлээд энэ компьютер дээр LocalBridge app-аа асаана уу.",
    codeCreated: "Энэ 6 оронтой кодыг нөгөө компьютер дээр оруулна уу.",
    codeCreateError: "Pairing code үүсгэж чадсангүй.",
    enterCode: "Эхлээд 6 оронтой pairing code оруулна уу.",
    joined: "Нэгдлээ. Код үүсгэсэн компьютер дээр Finish pairing дарна уу.",
    joinError: "Энэ pairing code-д нэгдэж чадсангүй.",
    createOrEnter: "Эхлээд pairing code үүсгэх эсвэл оруулна уу.",
    pairedDone: "Амжилттай холбогдлоо. Clipboard sync native agent-уудаар ажиллана.",
    finishError: "Pairing дуусгаж чадсангүй.",
    copied: "Pairing code хуулагдлаа.",
    reconnectAuto: "Pair хийсний дараа LocalBridge автоматаар дахин холбогдоно.",
    pauseNative: "Sync түр зогсоох бол тухайн компьютер дээрх LocalBridge app-г ашиглана уу.",
    cleared: "Энэ хуудсан дээрх pairing code цэвэрлэгдлээ.",
    connectedTitle: "Холболт амжилттай",
    connectedBody: "Эдгээр төхөөрөмжийн хооронд clipboard sync идэвхтэй байна.",
    connectedTo: "Холбогдсон төхөөрөмж",
    waitingPeer: "Холбогдсон төхөөрөмж алга",
    pairedDevice: "Холбогдсон төхөөрөмж",
    agentOnline: "Agent online",
    waitingAgent: "Agent хүлээж байна",
    thisComputer: "Энэ компьютер",
    backend: "Backend",
    chooseAgent: "Энэ компьютер дээр ажиллаж буй LocalBridge agent-ийг сонгоно уу.",
    startNative: "Device online болгохын тулд native app-аа асаана уу.",
    pairingCode: "6 оронтой pairing code",
    noOnline: "Online device алга",
    createCode: "Code үүсгэх",
    joinCode: "Code оруулах",
    finishPairing: "Pair дуусгах",
    copyCode: "Code хуулах",
    reconnect: "Дахин холбох",
    disconnect: "Салгах",
    remove: "Цэвэрлэх",
    noCode: "Pairing code алга",
    codeSummary: "Энэ code-г нөгөө компьютер дээр оруулаад энд pairing-г дуусгана.",
    noCodeSummary: "Pair эхлүүлэхийн тулд нэг төхөөрөмж дээр code үүсгэнэ.",
    credentialsAuto: "Credentials native agent-уудад автоматаар очно.",
    connectDevices: "Төхөөрөмжүүдээ холбо",
    sectionTitle: "Нэг удаа суулга, нэг удаа холбо, дараа нь март.",
    stepInstall: "Суулгах",
    stepInstallBody: "Компьютер бүр дээр жижиг native agent татаж суулгана.",
    stepPair: "Pair хийх",
    stepPairBody: "Online device-үүдээ сонгоод 6 оронтой code-оор холбоно.",
    stepCopy: "Copy & paste",
    stepCopyBody: "Pair хийсний дараа native agent-ууд clipboard text-ийг шууд sync хийнэ.",
    chooseDeviceTitle: "Төхөөрөмжөө сонго",
    downloadsText: "Компьютер бүр дээр beta installer татаж setup ажиллуулаад, дараа нь энд буцаж pair хийнэ.",
    privacy: "Нууцлал ба аюулгүй байдал",
    privacyTitle: "Website зөвхөн төхөөрөмж pair хийнэ. Clipboard content sync хийхгүй.",
    securityShort: "Богино хугацааны pairing",
    securityShortBody: "Pairing session хугацаатай бөгөөд нэг удаа ашиглагдана.",
    securityNative: "Clipboard access зөвхөн native",
    securityNativeBody: "Clipboard унших/бичих үйлдэл browser биш Windows/macOS agent дээр хийгдэнэ.",
    securityDirect: "Шууд sync зам",
    securityDirectBody: "Pair хийсний дараа agent-ууд authenticated WebSocket engine ашиглана.",
    dashboard: "Самбар",
    online: "online",
    noAgent: "Online agent алга",
    onlineStatus: "Online",
    lastConnection: "Сүүлийн холболт",
    waiting: "Хүлээж байна",
    pairingFinished: "Pairing дууссан",
    faqTitle: "Мэдэхэд илүүдэхгүй",
    faqBrowser: "Website өөрөө clipboard sync хийж чадах уу?",
    faqBrowserBody: "Үгүй. Browser хоёр компьютерийн operating-system clipboard-ийг чимээгүй уншиж/бичиж чаддаггүй.",
    faqCloud: "LocalBridge clipboard history-г cloud дээр хадгалах уу?",
    faqCloudBody: "Үгүй. Netlify layer зөвхөн богино хугацааны pairing болон control metadata-д ашиглагдана.",
    faqSetup: "Beta үед юу анхаарах вэ?",
    faqSetupBody: "Unsigned beta download тул operating system approve шаардаж магадгүй. Хоёр компьютер дээр LocalBridge app асаалттай байх хэрэгтэй."
  }
} satisfies Record<Language, Record<string, string>>;

function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("localbridge-language") as Language) || "en");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [pairingId, setPairingId] = useState("");
  const [joinPairingId, setJoinPairingId] = useState("");
  const [state, setState] = useState<PairingState>("UNPAIRED");
  const [agentBaseUrl, setAgentBaseUrl] = useState(LOCAL_AGENT_URLS[0]);
  const t = COPY[language];
  const [message, setMessage] = useState(t.installStart);
  const [busy, setBusy] = useState(false);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );
  const pairedDevice = useMemo(() => {
    if (devices.length === 2 && selectedDevice) {
      return devices.find((device) => device.deviceId !== selectedDevice.deviceId) || null;
    }
    if (!selectedDevice?.currentPairingId) return null;
    return devices.find(
      (device) => device.deviceId !== selectedDevice.deviceId && device.currentPairingId === selectedDevice.currentPairingId
    ) || null;
  }, [devices, selectedDevice]);
  const effectiveState = selectedDevice?.state === "PAIRED" || selectedDevice?.state === "CONNECTED" ? "CONNECTED" : state;
  const connectionReady = Boolean(pairedDevice && (effectiveState === "PAIRED" || effectiveState === "CONNECTED"));
  const peerName = pairedDevice?.deviceName || (connectionReady ? t.pairedDevice : t.waitingPeer);

  useEffect(() => {
    localStorage.setItem("localbridge-language", language);
    setMessage((current) => (current === COPY.en.installStart || current === COPY.mn.installStart ? t.installStart : current));
  }, [language, t]);

  useEffect(() => {
    let mounted = true;
    const refreshDevices = async () => {
      try {
        const { data, baseUrl } = await fetchLocalAgentStatus();
        if (!mounted) return;
        setAgentBaseUrl(baseUrl);
        const localDevice: Device = {
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          platform: data.platform,
          state: data.state,
        };
        const onlineDevices = [localDevice];
        if (data.pairedDevice?.device_id) {
          onlineDevices.push({
            deviceId: data.pairedDevice.device_id,
            deviceName: data.pairedDevice.device_name || t.pairedDevice,
            platform: data.pairedDevice.platform || "device",
            directEndpoint: data.pairedDevice.direct_host ? `ws://${data.pairedDevice.direct_host}` : "",
            state: data.state,
          });
        }
        setDevices(onlineDevices);
        setSelectedDeviceId(data.deviceId);
        if (data.state === "PAIRED" || data.state === "CONNECTED") {
          setState("CONNECTED");
          setMessage(t.pairedDone);
        } else {
          setState(data.state || "UNPAIRED");
          setMessage(t.chooseDevice);
        }
      } catch {
        if (!mounted) return;
        setDevices([]);
        setSelectedDeviceId("");
        setState("UNPAIRED");
        setMessage(t.startAgent);
      }
    };

    refreshDevices();
    const interval = window.setInterval(refreshDevices, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [t]);

  const callAgent = async <T,>(path: string, body?: unknown) => {
    setBusy(true);
    try {
      let lastError: unknown = null;
      for (const baseUrl of [agentBaseUrl, ...LOCAL_AGENT_URLS.filter((url) => url !== agentBaseUrl)]) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: body ? JSON.stringify(body) : "{}",
          });
          const data = (await response.json()) as T & { error?: string };
          if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
          setAgentBaseUrl(baseUrl);
          return data as T;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error(t.startAgent);
    } finally {
      setBusy(false);
    }
  };

  const requireDevice = () => {
    if (!selectedDeviceId) {
      setMessage(t.startThisComputer);
      return false;
    }
    return true;
  };

  const createSession = async () => {
    if (!requireDevice()) return;
    try {
      const data = await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/session");
      setPairingId(data.pairingId);
      setJoinPairingId(data.pairingId);
      setState(data.state);
      setMessage(t.codeCreated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.codeCreateError);
    }
  };

  const joinSession = async () => {
    if (!requireDevice()) return;
    if (!joinPairingId) {
      setMessage(t.enterCode);
      return;
    }
    try {
      const data = await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/join", {
        pairingId: joinPairingId,
      });
      setPairingId(data.pairingId);
      setState(data.state);
      setMessage(t.joined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.joinError);
    }
  };

  const approveSession = async () => {
    const code = pairingId || joinPairingId;
    if (!code) {
      setMessage(t.createOrEnter);
      return;
    }
    try {
      const data = await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/approve", {
        pairingId: code,
      });
      setPairingId(data.pairingId);
      setState(data.state);
      setMessage(t.pairedDone);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.finishError);
    }
  };

  const copyPairingId = async () => {
    if (!pairingId) return;
    await navigator.clipboard.writeText(pairingId);
    setMessage(t.copied);
  };

  const reconnect = async () => {
    try {
      await callAgent("/api/reconnect");
      setMessage(t.reconnectAuto);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.startAgent);
    }
  };
  const disconnect = async () => setMessage(t.pauseNative);
  const removePairing = async () => {
    try {
      await callAgent("/api/remove");
    } catch {
      // The user may be viewing the site before installing the native agent.
    }
    setPairingId("");
    setJoinPairingId("");
    setState("UNPAIRED");
    setMessage(t.cleared);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LocalBridge home">
          <img className="brand-logo" src="/brand/automation-mongolia-logo.jpg" alt="Automation Mongolia" />
          <span>LocalBridge</span>
          <span className="badge">{t.beta}</span>
        </a>
        <nav>
          <a href="#connect">{t.navConnect}</a>
          <a href="#downloads">{t.navDownloads}</a>
          <a href="#privacy">{t.navPrivacy}</a>
          <a href="#faq">{t.navFaq}</a>
          <label className="language-select">
            <span>{t.language}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="en">EN</option>
              <option value="mn">MN</option>
            </select>
          </label>
          <a className="icon-link" href="https://github.com/jamiyangarav10-web/beta-clipboard-" aria-label="GitHub">
            <Github size={18} />
          </a>
        </nav>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <ShieldCheck size={16} /> {t.eyebrow}
          </p>
          <h1>{t.heroTitle}</h1>
          <p className="subtext">{t.heroText}</p>
          <div className="hero-actions">
            <a className="button primary" href="#connect">
              <Power size={18} /> {t.connectCta}
            </a>
            <a className="button secondary" href="#downloads">
              <Download size={18} /> {t.downloadCta}
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
          state={effectiveState}
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
          connectionReady={connectionReady}
          pairedDevice={pairedDevice}
          agentBaseUrl={agentBaseUrl}
          t={t}
        />
      </section>

      <section id="connect" className="band">
        <div className="section-heading">
          <span className="kicker">{t.connectDevices}</span>
          <h2>{t.sectionTitle}</h2>
        </div>
        <div className="steps">
          <Step icon={<Download />} title={t.stepInstall} body={t.stepInstallBody} />
          <Step icon={<Link2 />} title={t.stepPair} body={t.stepPairBody} />
          <Step icon={<Clipboard />} title={t.stepCopy} body={t.stepCopyBody} />
        </div>
      </section>

      <section id="downloads" className="downloads">
        <div>
          <span className="kicker">{t.navDownloads}</span>
          <h2>{t.chooseDeviceTitle}</h2>
          <p>{t.downloadsText}</p>
        </div>
        <div className="download-grid">
          <a className="download-card" href="/downloads/LocalBridge-Windows.zip">
            <PlatformIcon platform="windows" size={26} />
            <strong>Windows</strong>
            <span>LocalBridge-Windows.zip</span>
          </a>
          <a className="download-card" href="/downloads/LocalBridge-Mac.zip">
            <PlatformIcon platform="macos" size={26} />
            <strong>macOS</strong>
            <span>LocalBridge-Mac.zip</span>
          </a>
        </div>
      </section>

      <section id="privacy" className="security">
        <div className="section-heading">
          <span className="kicker">{t.privacy}</span>
          <h2>{t.privacyTitle}</h2>
        </div>
        <div className="security-grid">
          <SecurityItem icon={<Lock />} title={t.securityShort} body={t.securityShortBody} />
          <SecurityItem icon={<ShieldCheck />} title={t.securityNative} body={t.securityNativeBody} />
          <SecurityItem icon={<RefreshCw />} title={t.securityDirect} body={t.securityDirectBody} />
        </div>
      </section>

      <section className="dashboard">
        <div className="dashboard-shell">
          <div className="dashboard-header">
            <div>
              <span className="kicker">{t.dashboard}</span>
              <h2>LocalBridge</h2>
            </div>
            <div className="dashboard-status">
              <span>{devices.length ? `${devices.length} ${t.online}` : t.noAgent}</span>
              <span>{effectiveState}</span>
            </div>
          </div>
          <div className="device-list">
            {devices.map((device) => (
              <div className="device-row" key={device.deviceId}>
                <PlatformIcon platform={device.platform} size={22} />
                <div>
                  <strong>{device.deviceName}</strong>
                  <span>{device.platform}</span>
                </div>
                <span className="status">
                  <i />
                  {t.onlineStatus}
                </span>
              </div>
            ))}
          </div>
          <p className="last-connection">{t.lastConnection}: {connectionReady ? `${selectedDevice?.deviceName} -> ${pairedDevice?.deviceName}` : t.waiting}</p>
        </div>
      </section>

      <section id="faq" className="faq">
        <span className="kicker">{t.navFaq}</span>
        <h2>{t.faqTitle}</h2>
        <details>
          <summary>{t.faqBrowser}</summary>
          <p>{t.faqBrowserBody}</p>
        </details>
        <details>
          <summary>{t.faqCloud}</summary>
          <p>{t.faqCloudBody}</p>
        </details>
        <details>
          <summary>{t.faqSetup}</summary>
          <p>{t.faqSetupBody}</p>
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
  connectionReady,
  pairedDevice,
  agentBaseUrl,
  t,
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
  connectionReady: boolean;
  pairedDevice: Device | null;
  agentBaseUrl: string;
  t: (typeof COPY)[Language];
}) {
  return (
    <aside className="panel connector-panel" aria-label="LocalBridge connector">
      <div className="panel-title">
        <span>
          <Smartphone size={18} /> {devices.length ? t.agentOnline : t.waitingAgent}
        </span>
        <CheckCircle2 size={18} />
      </div>
      {connectionReady && (
        <div className="connected-banner">
          <CheckCircle2 size={20} />
          <div>
            <strong>{t.connectedTitle}</strong>
            <span>{t.connectedTo}: {pairedDevice?.deviceName} ({pairedDevice?.platform})</span>
            <span>{t.connectedBody}</span>
          </div>
        </div>
      )}
      <div className="connection-map">
        <div>
          <PlatformIcon platform={selectedDevice?.platform} size={24} />
          <span>{selectedDevice?.deviceName || t.thisComputer}</span>
        </div>
        <ArrowRight size={18} />
        <div>
          <PlatformIcon platform={pairedDevice?.platform} size={24} />
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
        <p>{devices.length ? t.chooseAgent : t.startNative}</p>
        <p>{t.backend}: {agentBaseUrl}</p>
      </div>
      <div className="pairing-fields">
        <label>
          {t.thisComputer}
          <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
            <option value="">{t.noOnline}</option>
            {devices.map((device) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.deviceName} ({device.platform})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.pairingCode}
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
          <Link2 size={16} /> {t.createCode}
        </button>
        <button type="button" onClick={joinSession} disabled={busy || !selectedDeviceId}>
          <Clipboard size={16} /> {t.joinCode}
        </button>
        <button type="button" onClick={approveSession} disabled={busy}>
          <CheckCircle2 size={16} /> {t.finishPairing}
        </button>
        <button type="button" onClick={copyPairingId} disabled={!pairingId}>
          <Copy size={16} /> {t.copyCode}
        </button>
        <button type="button" onClick={reconnect} disabled={busy}>
          <RefreshCw size={16} /> {t.reconnect}
        </button>
        <button type="button" onClick={disconnect} disabled={busy}>
          <Unlink size={16} /> {t.disconnect}
        </button>
        <button type="button" onClick={removePairing} disabled={busy}>
          <Link2 size={16} /> {t.remove}
        </button>
      </div>
      <div className="session-summary">
        <strong>{pairingId ? `Code ${pairingId}` : t.noCode}</strong>
        <span>{pairingId ? t.codeSummary : t.noCodeSummary}</span>
        <span>{t.credentialsAuto}</span>
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

async function fetchLocalAgentStatus() {
  let lastError: unknown = null;
  for (const baseUrl of LOCAL_AGENT_URLS) {
    try {
      const response = await fetch(`${baseUrl}/api/status`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Agent status failed (${response.status})`);
      return { data: (await response.json()) as AgentStatus, baseUrl };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LocalBridge agent not found");
}

function PlatformIcon({ platform, size = 22 }: { platform?: string; size?: number }) {
  const normalized = (platform || "").toLowerCase();
  if (normalized.includes("mac") || normalized.includes("darwin")) {
    return (
      <svg className="apple-logo" width={size} height={size} viewBox="-2 0 28 28" aria-label="Apple" role="img">
        <path d="M16.37 1.63c.08 1.08-.31 2.13-1.05 2.94-.79.88-2.07 1.55-3.19 1.46-.1-1.04.33-2.16 1.04-2.93.8-.87 2.17-1.54 3.2-1.47Zm3.52 16.69c-.67 1.48-.99 2.14-1.85 3.45-1.2 1.82-2.89 4.09-4.98 4.11-1.86.02-2.34-1.19-4.86-1.18-2.52.01-3.05 1.2-4.91 1.18-2.09-.02-3.68-2.07-4.88-3.89-3.35-5.1-3.7-11.09-1.64-14.28 1.46-2.27 3.77-3.6 5.95-3.6 2.22 0 3.62 1.21 5.46 1.21 1.78 0 2.87-1.22 5.44-1.22 1.94 0 4 1.06 5.45 2.88-4.79 2.63-4.02 9.48.82 11.34Z" />
      </svg>
    );
  }
  if (normalized.includes("win")) {
    return (
      <span
        className="windows-logo"
        style={{ height: size, width: size }}
        aria-label="Windows"
        role="img"
      >
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }
  return <Monitor size={size} aria-label="Device" />;
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
