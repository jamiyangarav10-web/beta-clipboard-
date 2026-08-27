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
  state?: PairingState;
  currentPairingId?: string | null;
  hasCredentials?: boolean;
  syncEnabled?: boolean;
  engineRunning?: boolean;
};

type Language = "en" | "mn";

const LOCAL_AGENT_URLS = ["http://localhost:17833", "http://127.0.0.1:17833"];
const MAX_CLOUD_FILE_BYTES = 3 * 1024 * 1024;

type AgentStatus = {
  deviceId: string;
  deviceName: string;
  platform: string;
  state: PairingState;
  hasCredentials: boolean;
  syncEnabled: boolean;
  engineRunning: boolean;
  pairedDevice?: {
    device_id?: string;
    device_name?: string;
    platform?: string;
    direct_host?: string;
  };
};

type AgentClaim = {
  deviceId: string;
  controlToken: string;
};

type CloudAgentPoll = {
  device: Device;
  sessions: PairingSession[];
  credentials?: {
    devices?: Device[];
  } | null;
};

type PairingSession = {
  pairingId: string;
  state: PairingState;
  requesterDeviceId: string;
  responderDeviceId?: string | null;
  requesterDevice?: Device | null;
  responderDevice?: Device | null;
  used?: boolean;
  expiresAt?: number;
};

type WebIdentity = {
  deviceId: string;
  controlToken: string;
  deviceName: string;
  platform: "windows" | "macos";
};

type RelayItem = {
  id: string;
  fromDeviceId: string;
  message: {
    type: "clipboard" | "file";
    text?: string;
    name?: string;
    mime?: string;
    data?: string;
    size?: number;
  };
  createdAt: number;
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
    heroDesktopLine: "Copy on one device.",
    heroLaptopLine: "Paste on",
    heroMobileLine: "another.",
    syncedLabel: "Synced",
    allDevicesLabel: "All devices",
    heroText: "LocalBridge keeps your clipboard in sync across your devices without IP addresses, ports, Tailscale setup, secrets, or terminal commands.",
    connectCta: "Connect my devices",
    downloadCta: "Download LocalBridge",
    webMode: "No-install web mode",
    webModeText: "Use this when antivirus blocks the beta agent. It works in the browser for manual text and file transfer.",
    webCreateRoom: "Create web room",
    webJoinRoom: "Join web room",
    webFinishRoom: "Finish web pairing",
    webSendText: "Send text",
    webCopyText: "Copy text",
    webIncoming: "Incoming",
    webTextPlaceholder: "Paste text here to send to the other device.",
    webRoomCreated: "Web room created. Enter this code on the other device.",
    webRoomJoined: "Joined. Finish pairing on the device that created the code.",
    webRoomReady: "Web devices connected. You can send text and files in the browser.",
    webTextSent: "Text sent.",
    webFileSent: "File sent.",
    webNoPeer: "Connect a web room first.",
    simpleInstall: "Simple terminal install",
    simpleInstallText: "Paste one command in Terminal or PowerShell. Windows includes its own Python runtime, so no Python install, PATH change, or App Execution Alias change is needed.",
    copyCommand: "Copy command",
    macCommandCopied: "Mac install command copied.",
    windowsCommandCopied: "Windows install command copied.",
    installStart: "Install and start LocalBridge on each computer.",
    chooseDevice: "Choose this computer, then create or join a pairing code.",
    startAgent: "Start the LocalBridge app on each computer.",
    browserBlocked: "The agent may be running, but this browser cannot reach localhost. Open the local agent page to continue.",
    openLocalAgent: "Open LocalBridge Agent",
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
    agentConnected: "Agent connected",
    agentOffline: "Agent offline",
    agentOfflineBody: "Install or restart LocalBridge, then return to this page.",
    installAgent: "Install agent",
    waitingAgent: "Waiting for agent",
    progressTitle: "Connection progress",
    progressThisDevice: "This device is ready",
    progressCodeReady: "6-digit code is ready",
    progressWaitingJoin: "Waiting for the other device",
    progressJoined: "Other device joined",
    progressWaitingFinish: "Waiting for Finish pairing",
    progressConnected: "Devices paired",
    syncStarting: "Starting clipboard sync",
    syncActive: "Sync active",
    syncWaiting: "Waiting for sync",
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
    sendFile: "Send file",
    chooseFile: "Choose file",
    fileQueued: "File queued. It will be saved on the paired device.",
    fileTooLarge: "This beta supports files and images up to 3 MB.",
    fileSendError: "Could not send that file.",
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
    stepCopyBody: "After pairing, native agents sync clipboard text and can send small files or images.",
    chooseDeviceTitle: "Choose your device",
    downloadsText: "Download the beta installer on each computer, run setup, then return here to pair your devices.",
    privacy: "Privacy and security",
    privacyTitle: "The website pairs devices and sends files only through your local agent.",
    securityShort: "Short-lived pairing",
    securityShortBody: "Pairing sessions expire and are single-use.",
    securityNative: "Native-only clipboard access",
    securityNativeBody: "Clipboard reads and writes happen in the Windows and macOS agents, not browser JavaScript.",
    securityDirect: "No network setup",
    securityDirectBody: "After pairing, agents use an authenticated cloud relay for clipboard text and file transfer. Direct LAN mode can come later.",
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
    heroDesktopLine: "Нэг төхөөрөмж дээр хуул.",
    heroLaptopLine: "Нөгөө дээр",
    heroMobileLine: "буулга.",
    syncedLabel: "Синк хийсэн",
    allDevicesLabel: "Бүх төхөөрөмж",
    heroText: "LocalBridge нь IP, port, Tailscale, secret, terminal command тохируулахгүйгээр таны төхөөрөмжүүдийн clipboard-ийг sync хийнэ.",
    connectCta: "Төхөөрөмж холбох",
    downloadCta: "LocalBridge татах",
    webMode: "Суулгахгүй web mode",
    webModeText: "Antivirus beta agent-ийг хаавал үүнийг ашигла. Browser дотор text болон файл гараар дамжуулна.",
    webCreateRoom: "Web room үүсгэх",
    webJoinRoom: "Web room-д орох",
    webFinishRoom: "Web pairing дуусгах",
    webSendText: "Text явуулах",
    webCopyText: "Text хуулах",
    webIncoming: "Ирсэн зүйлс",
    webTextPlaceholder: "Нөгөө төхөөрөмж рүү явуулах text-ээ энд paste хийнэ.",
    webRoomCreated: "Web room үүслээ. Энэ code-г нөгөө төхөөрөмж дээр оруул.",
    webRoomJoined: "Нэгдлээ. Code үүсгэсэн төхөөрөмж дээр pairing-г дуусга.",
    webRoomReady: "Web төхөөрөмжүүд холбогдлоо. Browser-аар text/file явуулж болно.",
    webTextSent: "Text явууллаа.",
    webFileSent: "Файл явууллаа.",
    webNoPeer: "Эхлээд web room холбоно уу.",
    simpleInstall: "Terminal-аар энгийн суулгах",
    simpleInstallText: "Terminal эсвэл PowerShell дээр нэг command paste хийнэ. Windows багц Python-оо дотроо агуулдаг тул Python суулгах, PATH эсвэл App Execution Alias өөрчлөх шаардлагагүй.",
    copyCommand: "Command хуулах",
    macCommandCopied: "Mac install command хуулагдлаа.",
    windowsCommandCopied: "Windows install command хуулагдлаа.",
    installStart: "Төхөөрөмж бүр дээр LocalBridge суулгаж асаана уу.",
    chooseDevice: "Энэ компьютерыг сонгоод pairing code үүсгэх эсвэл оруулна уу.",
    startAgent: "Төхөөрөмж бүр дээр LocalBridge app-аа асаана уу.",
    browserBlocked: "Agent ажиллаж байж магадгүй ч энэ browser localhost руу холбогдож чадсангүй. LocalBridge Agent хуудсыг нээгээд үргэлжлүүлнэ үү.",
    openLocalAgent: "LocalBridge Agent нээх",
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
    agentConnected: "Agent холбогдлоо",
    agentOffline: "Agent offline байна",
    agentOfflineBody: "LocalBridge-ийг суулгах эсвэл дахин асаагаад энэ хуудсанд буцаж ирнэ үү.",
    installAgent: "Agent суулгах",
    waitingAgent: "Agent хүлээж байна",
    progressTitle: "Холболтын явц",
    progressThisDevice: "Энэ төхөөрөмж бэлэн",
    progressCodeReady: "6 оронтой code бэлэн",
    progressWaitingJoin: "Нөгөө төхөөрөмжийг хүлээж байна",
    progressJoined: "Нөгөө төхөөрөмж нэгдсэн",
    progressWaitingFinish: "Finish pairing хүлээж байна",
    progressConnected: "Төхөөрөмжүүд pair боллоо",
    syncStarting: "Clipboard sync асааж байна",
    syncActive: "Sync идэвхтэй",
    syncWaiting: "Sync хүлээж байна",
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
    sendFile: "Файл явуулах",
    chooseFile: "Файл сонгох",
    fileQueued: "Файл queue-д орлоо. Нөгөө төхөөрөмж дээр хадгалагдана.",
    fileTooLarge: "Энэ beta дээр 3 MB хүртэл файл болон зураг дэмжинэ.",
    fileSendError: "Энэ файлыг явуулж чадсангүй.",
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
    stepCopyBody: "Pair хийсний дараа native agent-ууд clipboard text sync хийж, жижиг файл/зураг явуулна.",
    chooseDeviceTitle: "Төхөөрөмжөө сонго",
    downloadsText: "Компьютер бүр дээр beta installer татаж setup ажиллуулаад, дараа нь энд буцаж pair хийнэ.",
    privacy: "Нууцлал ба аюулгүй байдал",
    privacyTitle: "Website төхөөрөмж pair хийж, файлыг зөвхөн таны local agent-аар дамжуулна.",
    securityShort: "Богино хугацааны pairing",
    securityShortBody: "Pairing session хугацаатай бөгөөд нэг удаа ашиглагдана.",
    securityNative: "Clipboard access зөвхөн native",
    securityNativeBody: "Clipboard унших/бичих үйлдэл browser биш Windows/macOS agent дээр хийгдэнэ.",
    securityDirect: "Network тохиргоо хэрэггүй",
    securityDirectBody: "Pair хийсний дараа agent-ууд clipboard text болон file transfer-д authenticated cloud relay ашиглана. Direct LAN mode дараа нь нэмэгдэнэ.",
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
  const [agentClaim] = useState<AgentClaim | null>(() => loadAgentClaim());
  const [webIdentity] = useState<WebIdentity>(() => loadWebIdentity());
  const [webPairingId, setWebPairingId] = useState("");
  const [webJoinPairingId, setWebJoinPairingId] = useState("");
  const [webSession, setWebSession] = useState<PairingSession | null>(null);
  const [webText, setWebText] = useState("");
  const [webInbox, setWebInbox] = useState<RelayItem[]>([]);
  const [webBusy, setWebBusy] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [pairingId, setPairingId] = useState("");
  const [session, setSession] = useState<PairingSession | null>(null);
  const [joinPairingId, setJoinPairingId] = useState("");
  const [state, setState] = useState<PairingState>("UNPAIRED");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentBaseUrl, setAgentBaseUrl] = useState(LOCAL_AGENT_URLS[0]);
  const [agentTransport, setAgentTransport] = useState<"local" | "cloud" | "offline">("offline");
  const t = COPY[language];
  const [message, setMessage] = useState(t.installStart);
  const [busy, setBusy] = useState(false);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );
  const pairedDevice = useMemo(() => {
    const sessionPeer = selectedDevice?.deviceId === session?.requesterDeviceId ? session?.responderDevice : session?.requesterDevice;
    if (sessionPeer) return sessionPeer;
    if (devices.length === 2 && selectedDevice) {
      return devices.find((device) => device.deviceId !== selectedDevice.deviceId) || null;
    }
    if (!selectedDevice?.currentPairingId) return null;
    return devices.find(
      (device) => device.deviceId !== selectedDevice.deviceId && device.currentPairingId === selectedDevice.currentPairingId
    ) || null;
  }, [devices, selectedDevice, session]);
  const syncActive = Boolean(agentStatus?.syncEnabled && agentStatus?.engineRunning && agentStatus?.state === "CONNECTED");
  const localPaired = Boolean(agentStatus?.hasCredentials || agentStatus?.pairedDevice?.device_id);
  const effectiveState: PairingState = syncActive ? "CONNECTED" : localPaired ? "PAIRED" : state;
  const connectionReady = Boolean(pairedDevice && (localPaired || syncActive || session?.used));
  const peerName = pairedDevice?.deviceName || (connectionReady ? t.pairedDevice : t.waitingPeer);
  const webPaired = Boolean(webSession?.used);
  const webPeer = webIdentity.deviceId === webSession?.requesterDeviceId ? webSession?.responderDevice : webSession?.requesterDevice;

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
        setAgentTransport("local");
        setAgentStatus(data);
        const localDevice: Device = {
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          platform: data.platform,
          state: data.state,
          hasCredentials: data.hasCredentials,
          syncEnabled: data.syncEnabled,
          engineRunning: data.engineRunning,
        };
        const onlineDevices = [localDevice];
        if (data.pairedDevice?.device_id) {
          onlineDevices.push({
            deviceId: data.pairedDevice.device_id,
            deviceName: data.pairedDevice.device_name || t.pairedDevice,
            platform: data.pairedDevice.platform || "device",
            directEndpoint: data.pairedDevice.direct_host ? `ws://${data.pairedDevice.direct_host}` : "",
            state: data.state,
            hasCredentials: data.hasCredentials,
            syncEnabled: data.syncEnabled,
            engineRunning: data.engineRunning,
          });
        }
        setDevices(onlineDevices);
        setSelectedDeviceId(data.deviceId);
        if (data.syncEnabled && data.engineRunning && data.state === "CONNECTED") {
          setState("CONNECTED");
          setMessage(t.pairedDone);
        } else if (data.hasCredentials || data.pairedDevice?.device_id || data.state === "PAIRED") {
          setState("PAIRED");
          setMessage(t.syncStarting);
        } else {
          setState(data.state || "UNPAIRED");
          setMessage(t.chooseDevice);
        }
      } catch {
        if (!mounted) return;
        if (agentClaim) {
          try {
            const cloud = await backendJson<CloudAgentPoll>("/device/poll", agentClaim);
            if (!mounted) return;
            const activeSession = [...(cloud.sessions || [])].sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0))[0] || null;
            const peer = cloud.credentials?.devices?.find((device) => device.deviceId !== cloud.device.deviceId) || null;
            const cloudState: PairingState = cloud.credentials ? "CONNECTED" : activeSession?.state || cloud.device.state || "UNPAIRED";
            const cloudStatus: AgentStatus = {
              deviceId: cloud.device.deviceId,
              deviceName: cloud.device.deviceName,
              platform: cloud.device.platform,
              state: cloudState,
              hasCredentials: Boolean(cloud.credentials),
              syncEnabled: Boolean(cloud.credentials),
              engineRunning: Boolean(cloud.credentials),
              pairedDevice: peer ? {
                device_id: peer.deviceId,
                device_name: peer.deviceName,
                platform: peer.platform,
              } : {},
            };
            setAgentTransport("cloud");
            setAgentStatus(cloudStatus);
            setDevices(peer ? [cloud.device, peer] : [cloud.device]);
            setSelectedDeviceId(cloud.device.deviceId);
            setState(cloudState);
            if (activeSession) {
              setPairingId(activeSession.pairingId);
              setJoinPairingId(activeSession.pairingId);
              setSession(activeSession);
            }
            setMessage(cloud.credentials ? t.pairedDone : t.chooseDevice);
            return;
          } catch {
            // The saved claim may refer to an agent that is no longer online.
          }
        }
        setDevices([]);
        setSelectedDeviceId("");
        setAgentStatus(null);
        setAgentTransport("offline");
        setState("UNPAIRED");
        setMessage(t.agentOfflineBody);
      }
    };

    refreshDevices();
    const interval = window.setInterval(refreshDevices, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [agentClaim, t]);

  useEffect(() => {
    if (!pairingId) {
      setSession(null);
      return;
    }
    let mounted = true;
    const refreshSession = async () => {
      try {
        const response = await fetch(`/.netlify/functions/pairing/session/${encodeURIComponent(pairingId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as PairingSession;
        if (!mounted) return;
        setSession(data);
        setState((current) => (current === "CONNECTED" || current === "PAIRED" ? current : data.state));
      } catch {
        // Local agent status remains the source of truth if session polling is blocked.
      }
    };
    refreshSession();
    const interval = window.setInterval(refreshSession, 2000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [pairingId]);

  useEffect(() => {
    if (!webPairingId) return;
    let mounted = true;
    const refreshWebSession = async () => {
      try {
        const data = await backendJson<PairingSession>(`/session/${encodeURIComponent(webPairingId)}`);
        if (mounted) setWebSession(data);
      } catch {
        // Short-lived beta rooms may expire while a user is testing.
      }
    };
    refreshWebSession();
    const interval = window.setInterval(refreshWebSession, 2000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [webPairingId]);

  useEffect(() => {
    if (!webPaired) return;
    let mounted = true;
    const poll = async () => {
      try {
        const data = await backendJson<{ messages: RelayItem[] }>("/relay/poll", {
          deviceId: webIdentity.deviceId,
          controlToken: webIdentity.controlToken,
        });
        if (mounted && data.messages.length) {
          setWebInbox((current) => [...data.messages, ...current].slice(0, 20));
        }
      } catch {
        // Keep the web fallback quiet if the temporary relay is unavailable.
      }
    };
    poll();
    const interval = window.setInterval(poll, 2500);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [webIdentity, webPaired]);

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
      const data = agentTransport === "cloud" && agentClaim
        ? await backendJson<{ pairingId: string; state: PairingState }>("/session", { deviceId: agentClaim.deviceId })
        : await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/session");
      setPairingId(data.pairingId);
      setJoinPairingId(data.pairingId);
      setState(data.state);
      setSession({ pairingId: data.pairingId, state: data.state, requesterDeviceId: selectedDeviceId });
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
      const data = agentTransport === "cloud" && agentClaim
        ? await backendJson<{ pairingId: string; state: PairingState; requesterDeviceId?: string }>("/join", {
            pairingId: joinPairingId,
            deviceId: agentClaim.deviceId,
          })
        : await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/join", {
            pairingId: joinPairingId,
          });
      setPairingId(data.pairingId);
      setState(data.state);
      setSession((current) => ({
        ...(current || { requesterDeviceId: "", pairingId: data.pairingId }),
        pairingId: data.pairingId,
        state: data.state,
        responderDeviceId: selectedDeviceId,
      }));
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
      const data = agentTransport === "cloud" && agentClaim
        ? await backendJson<{ pairingId: string; state: PairingState }>("/approve", { pairingId: code })
        : await callAgent<{ pairingId: string; state: PairingState }>("/api/pairing/approve", {
            pairingId: code,
          });
      setPairingId(data.pairingId);
      setState(data.state);
      setSession((current) => current ? { ...current, state: data.state, used: true } : current);
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

  const copyInstallCommand = async (platform: "mac" | "windows") => {
    const command = platform === "mac"
      ? "curl -fsSL https://ai-mongolia.netlify.app/install/mac.sh | bash"
      : "powershell -NoProfile -ExecutionPolicy Bypass -Command \"iwr https://ai-mongolia.netlify.app/install/windows.ps1 -UseBasicParsing | iex\"";
    await navigator.clipboard.writeText(command);
    setMessage(platform === "mac" ? t.macCommandCopied : t.windowsCommandCopied);
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
    setSession(null);
    setJoinPairingId("");
    setState("UNPAIRED");
    setMessage(t.cleared);
  };

  const sendFile = async (file: File | null) => {
    if (!file) return;
    if (!connectionReady) {
      setMessage(t.startThisComputer);
      return;
    }
    if (file.size > MAX_CLOUD_FILE_BYTES) {
      setMessage(t.fileTooLarge);
      return;
    }
    try {
      const data = await fileToBase64(file);
      const messageBody = {
        type: "file" as const,
        name: file.name,
        mime: file.type || "application/octet-stream",
        data,
        size: file.size,
      };
      if (agentTransport === "cloud" && agentClaim && pairedDevice?.deviceId) {
        await backendJson("/relay/send", {
          deviceId: agentClaim.deviceId,
          controlToken: agentClaim.controlToken,
          toDeviceId: pairedDevice.deviceId,
          message: messageBody,
        });
      } else {
        await callAgent("/api/send-file", messageBody);
      }
      setMessage(t.fileQueued);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.fileSendError);
    }
  };

  const registerWebDevice = async () => {
    await backendJson("/register", {
      deviceId: webIdentity.deviceId,
      deviceName: webIdentity.deviceName,
      platform: webIdentity.platform,
      directEndpoint: "",
      controlToken: webIdentity.controlToken,
    });
  };

  const createWebRoom = async () => {
    setWebBusy(true);
    try {
      await registerWebDevice();
      const data = await backendJson<{ pairingId: string; state: PairingState }>("/session", { deviceId: webIdentity.deviceId });
      setWebPairingId(data.pairingId);
      setWebJoinPairingId(data.pairingId);
      setWebSession({ pairingId: data.pairingId, state: data.state, requesterDeviceId: webIdentity.deviceId });
      setMessage(t.webRoomCreated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.codeCreateError);
    } finally {
      setWebBusy(false);
    }
  };

  const joinWebRoom = async () => {
    if (!webJoinPairingId) {
      setMessage(t.enterCode);
      return;
    }
    setWebBusy(true);
    try {
      await registerWebDevice();
      const data = await backendJson<{ pairingId: string; state: PairingState; requesterDeviceId: string }>("/join", {
        pairingId: webJoinPairingId,
        deviceId: webIdentity.deviceId,
      });
      setWebPairingId(data.pairingId);
      setWebSession({ pairingId: data.pairingId, state: data.state, requesterDeviceId: data.requesterDeviceId, responderDeviceId: webIdentity.deviceId });
      setMessage(t.webRoomJoined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.joinError);
    } finally {
      setWebBusy(false);
    }
  };

  const finishWebRoom = async () => {
    const code = webPairingId || webJoinPairingId;
    if (!code) {
      setMessage(t.createOrEnter);
      return;
    }
    setWebBusy(true);
    try {
      const data = await backendJson<{ pairingId: string; state: PairingState }>("/approve", { pairingId: code });
      setWebPairingId(data.pairingId);
      const fresh = await backendJson<PairingSession>(`/session/${encodeURIComponent(data.pairingId)}`);
      setWebSession(fresh);
      setMessage(t.webRoomReady);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.finishError);
    } finally {
      setWebBusy(false);
    }
  };

  const sendWebRelay = async (messageBody: RelayItem["message"]) => {
    if (!webPaired || !webPeer?.deviceId) {
      setMessage(t.webNoPeer);
      return;
    }
    setWebBusy(true);
    try {
      await backendJson("/relay/send", {
        deviceId: webIdentity.deviceId,
        controlToken: webIdentity.controlToken,
        toDeviceId: webPeer.deviceId,
        message: messageBody,
      });
      setMessage(messageBody.type === "file" ? t.webFileSent : t.webTextSent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.fileSendError);
    } finally {
      setWebBusy(false);
    }
  };

  const sendWebText = async () => {
    const text = webText.trim();
    if (!text) return;
    await sendWebRelay({ type: "clipboard", text });
    setWebText("");
  };

  const sendWebFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CLOUD_FILE_BYTES) {
      setMessage(t.fileTooLarge);
      return;
    }
    const data = await fileToBase64(file);
    await sendWebRelay({ type: "file", name: file.name, mime: file.type || "application/octet-stream", data, size: file.size });
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LocalBridge home">
          <span className="brand-logo-crop">
            <img src="/brand/automation-mongolia-logo.jpg" alt="Automation Mongolia" />
          </span>
          <span className="brand-copy">
            <strong>LocalBridge</strong>
            <small>Automation Mongolia</small>
          </span>
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
          <h1 className="device-headline" aria-label={t.heroTitle}>
            <img className="devices-render" src="/brand/localbridge-devices-v3.jpg" alt="" />
            <span className="headline-synced" aria-hidden="true">
              <CheckCircle2 size={18} />
              <span>
                <strong>{t.syncedLabel}</strong>
                <small>{t.allDevicesLabel}</small>
              </span>
            </span>
            <span className="headline-copy headline-copy-desktop" aria-hidden="true">
              <strong>{t.heroDesktopLine}</strong>
            </span>
            <span className="headline-copy headline-copy-laptop" aria-hidden="true">
              <strong>{t.heroLaptopLine}</strong>
            </span>
            <span className="headline-copy headline-copy-phone" aria-hidden="true">
              <strong>{t.heroMobileLine}</strong>
            </span>
          </h1>
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
          <div className="hero-platforms" aria-label="Supported desktop platforms">
            <span><PlatformIcon platform="macos" size={19} /> macOS</span>
            <span><PlatformIcon platform="windows" size={19} /> Windows</span>
            <span><ShieldCheck size={19} /> Private pairing</span>
          </div>
        </div>
        <ConnectorPanel
          devices={devices}
          selectedDevice={selectedDevice}
          selectedDeviceId={selectedDeviceId}
          busy={busy}
          state={effectiveState}
          session={session}
          pairingId={pairingId}
          joinPairingId={joinPairingId}
          setJoinPairingId={setJoinPairingId}
          createSession={createSession}
          joinSession={joinSession}
          approveSession={approveSession}
          reconnect={reconnect}
          disconnect={disconnect}
          removePairing={removePairing}
          sendFile={sendFile}
          copyPairingId={copyPairingId}
          peerName={peerName}
          connectionReady={connectionReady}
          syncActive={syncActive}
          localPaired={localPaired}
          pairedDevice={pairedDevice}
          agentTransport={agentTransport}
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
        <div className="install-commands">
          <div>
            <span className="kicker">{t.simpleInstall}</span>
            <p>{t.simpleInstallText}</p>
          </div>
          <div className="command-grid">
            <CommandBox
              platform="macos"
              title="macOS"
              command="curl -fsSL https://ai-mongolia.netlify.app/install/mac.sh | bash"
              copyLabel={t.copyCommand}
              onCopy={() => copyInstallCommand("mac")}
            />
            <CommandBox
              platform="windows"
              title="Windows"
              command={'powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr https://ai-mongolia.netlify.app/install/windows.ps1 -UseBasicParsing | iex"'}
              copyLabel={t.copyCommand}
              onCopy={() => copyInstallCommand("windows")}
            />
          </div>
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
          <p className="last-connection">{t.lastConnection}: {connectionReady ? `${selectedDevice?.deviceName} -> ${pairedDevice?.deviceName} (${effectiveState})` : t.waiting}</p>
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

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top">
          <span className="brand-logo-crop">
            <img src="/brand/automation-mongolia-logo.jpg" alt="Automation Mongolia" />
          </span>
          <span className="brand-copy">
            <strong>LocalBridge</strong>
            <small>Automation Mongolia</small>
          </span>
        </a>
        <span>Beta · macOS + Windows</span>
        <a href="https://github.com/jamiyangarav10-web/beta-clipboard-" aria-label="LocalBridge on GitHub">
          <Github size={19} />
        </a>
      </footer>
    </main>
  );
}

function ConnectorPanel({
  devices,
  selectedDevice,
  selectedDeviceId,
  busy,
  state,
  session,
  pairingId,
  joinPairingId,
  setJoinPairingId,
  createSession,
  joinSession,
  approveSession,
  reconnect,
  disconnect,
  removePairing,
  sendFile,
  copyPairingId,
  peerName,
  connectionReady,
  syncActive,
  localPaired,
  pairedDevice,
  agentTransport,
  t,
}: {
  devices: Device[];
  selectedDevice: Device | null;
  selectedDeviceId: string;
  busy: boolean;
  state: PairingState;
  session: PairingSession | null;
  pairingId: string;
  joinPairingId: string;
  setJoinPairingId: (value: string) => void;
  createSession: () => Promise<void>;
  joinSession: () => Promise<void>;
  approveSession: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  removePairing: () => Promise<void>;
  sendFile: (file: File | null) => Promise<void>;
  copyPairingId: () => Promise<void>;
  peerName: string;
  connectionReady: boolean;
  syncActive: boolean;
  localPaired: boolean;
  pairedDevice: Device | null;
  agentTransport: "local" | "cloud" | "offline";
  t: (typeof COPY)[Language];
}) {
  return (
    <aside className="panel connector-panel" aria-label="LocalBridge connector">
      <div className="panel-title">
        <span>
          <Smartphone size={18} /> {devices.length ? t.agentConnected : t.agentOffline}
        </span>
        {devices.length ? <CheckCircle2 size={18} /> : <Power size={18} />}
      </div>
      <div className={`agent-status-banner ${devices.length ? "online" : "offline"}`}>
        <PlatformIcon platform={selectedDevice?.platform} size={22} />
        <div>
          <strong>{devices.length ? `${t.agentConnected}: ${selectedDevice?.deviceName}` : t.agentOffline}</strong>
          <span>{devices.length ? `${selectedDevice?.platform} · ${agentTransport === "cloud" ? "Cloud" : "Local"}` : t.agentOfflineBody}</span>
        </div>
        {!devices.length && <a href="#downloads">{t.installAgent}</a>}
      </div>
      {connectionReady && (
        <div className="connected-banner">
          <CheckCircle2 size={20} />
          <div>
            <strong>{t.connectedTitle}</strong>
            <span>{t.connectedTo}: {pairedDevice?.deviceName} ({pairedDevice?.platform})</span>
            <span>{syncActive ? t.connectedBody : t.syncWaiting}</span>
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
      <PairingProgress
        session={session}
        state={state}
        selectedDevice={selectedDevice}
        pairedDevice={pairedDevice}
        pairingId={pairingId}
        syncActive={syncActive}
        localPaired={localPaired}
        t={t}
      />
      <div className="connector-meta">
        <p>{devices.length ? t.chooseAgent : t.startNative}</p>
      </div>
      <div className="pairing-fields">
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
        <button type="button" onClick={joinSession} disabled={busy || !selectedDeviceId || joinPairingId.length !== 6}>
          <Clipboard size={16} /> {t.joinCode}
        </button>
        <button type="button" onClick={approveSession} disabled={busy || !selectedDeviceId || !(pairingId || joinPairingId)}>
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
      <label className="file-send">
        <span>{t.sendFile}</span>
        <input
          type="file"
          disabled={busy || !connectionReady}
          onChange={(event) => {
            void sendFile(event.currentTarget.files?.[0] || null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="session-summary">
        <strong>{pairingId ? `Code ${pairingId}` : t.noCode}</strong>
        <span>{pairingId ? t.codeSummary : t.noCodeSummary}</span>
        <span>{t.credentialsAuto}</span>
      </div>
    </aside>
  );
}

function WebFallbackPanel({
  t,
  identity,
  pairingId,
  joinPairingId,
  setJoinPairingId,
  session,
  peer,
  text,
  setText,
  inbox,
  busy,
  createRoom,
  joinRoom,
  finishRoom,
  sendText,
  sendFile,
}: {
  t: (typeof COPY)[Language];
  identity: WebIdentity;
  pairingId: string;
  joinPairingId: string;
  setJoinPairingId: (value: string) => void;
  session: PairingSession | null;
  peer: Device | null;
  text: string;
  setText: (value: string) => void;
  inbox: RelayItem[];
  busy: boolean;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  finishRoom: () => Promise<void>;
  sendText: () => Promise<void>;
  sendFile: (file: File | null) => Promise<void>;
}) {
  const connected = Boolean(session?.used && peer);
  return (
    <div className="web-fallback">
      <div className="section-heading">
        <span className="kicker">{t.webMode}</span>
        <h2>{t.webMode}</h2>
        <p>{t.webModeText}</p>
      </div>
      <div className="web-grid">
        <section className="web-tool">
          <div className="connection-map">
            <div>
              <PlatformIcon platform={identity.platform} size={24} />
              <span>{identity.deviceName}</span>
            </div>
            <ArrowRight size={18} />
            <div>
              <PlatformIcon platform={peer?.platform} size={24} />
              <span>{peer?.deviceName || t.waitingPeer}</span>
            </div>
          </div>
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
          <div className="demo-actions">
            <button type="button" onClick={createRoom} disabled={busy}>
              <Link2 size={16} /> {t.webCreateRoom}
            </button>
            <button type="button" onClick={joinRoom} disabled={busy}>
              <Clipboard size={16} /> {t.webJoinRoom}
            </button>
            <button type="button" onClick={finishRoom} disabled={busy || !(pairingId || joinPairingId)}>
              <CheckCircle2 size={16} /> {t.webFinishRoom}
            </button>
            <button type="button" onClick={() => navigator.clipboard.writeText(pairingId)} disabled={!pairingId}>
              <Copy size={16} /> {t.copyCode}
            </button>
          </div>
          <div className="session-summary">
            <strong>{pairingId ? `Code ${pairingId}` : t.noCode}</strong>
            <span>{connected ? t.webRoomReady : t.noCodeSummary}</span>
          </div>
        </section>
        <section className="web-tool">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t.webTextPlaceholder}
            disabled={!connected || busy}
          />
          <div className="demo-actions">
            <button type="button" onClick={sendText} disabled={!connected || busy || !text.trim()}>
              <Clipboard size={16} /> {t.webSendText}
            </button>
          </div>
          <label className="file-send">
            <span>{t.sendFile}</span>
            <input
              type="file"
              disabled={!connected || busy}
              onChange={(event) => {
                void sendFile(event.currentTarget.files?.[0] || null);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </section>
        <section className="web-tool web-inbox">
          <strong>{t.webIncoming}</strong>
          {inbox.length ? inbox.map((item) => (
            <article key={item.id}>
              {item.message.type === "file" ? (
                <>
                  <span>{item.message.name}</span>
                  <a
                    className="button secondary"
                    href={`data:${item.message.mime || "application/octet-stream"};base64,${item.message.data}`}
                    download={item.message.name || "localbridge-file"}
                  >
                    <Download size={16} /> {t.downloadCta}
                  </a>
                </>
              ) : (
                <>
                  <p>{item.message.text}</p>
                  <button type="button" onClick={() => navigator.clipboard.writeText(item.message.text || "")}>
                    <Copy size={16} /> {t.webCopyText}
                  </button>
                </>
              )}
            </article>
          )) : <p>{t.waiting}</p>}
        </section>
      </div>
    </div>
  );
}

function PairingProgress({
  session,
  state,
  selectedDevice,
  pairedDevice,
  pairingId,
  syncActive,
  localPaired,
  t,
}: {
  session: PairingSession | null;
  state: PairingState;
  selectedDevice: Device | null;
  pairedDevice: Device | null;
  pairingId: string;
  syncActive: boolean;
  localPaired: boolean;
  t: (typeof COPY)[Language];
}) {
  const hasCode = Boolean(pairingId || session?.pairingId || localPaired || syncActive);
  const hasJoined = Boolean(session?.responderDeviceId || pairedDevice || localPaired || syncActive);
  const isPaired = localPaired || state === "PAIRED" || state === "CONNECTED" || Boolean(session?.used);
  const steps = [
    {
      label: t.progressThisDevice,
      detail: selectedDevice ? `${selectedDevice.deviceName} (${selectedDevice.platform})` : t.waitingAgent,
      done: Boolean(selectedDevice),
    },
    {
      label: t.progressCodeReady,
      detail: hasCode ? `Code ${pairingId || session?.pairingId}` : t.noCode,
      done: hasCode,
    },
    {
      label: hasJoined ? t.progressJoined : t.progressWaitingJoin,
      detail: pairedDevice ? `${pairedDevice.deviceName} (${pairedDevice.platform})` : t.waitingPeer,
      done: hasJoined,
    },
    {
      label: isPaired ? t.progressConnected : t.progressWaitingFinish,
      detail: isPaired ? t.connectedBody : t.codeSummary,
      done: isPaired,
    },
    {
      label: syncActive ? t.syncActive : t.syncStarting,
      detail: syncActive ? t.connectedBody : t.syncWaiting,
      done: syncActive,
    },
  ];

  return (
    <div className="pairing-progress">
      <strong>{t.progressTitle}</strong>
      <div>
        {steps.map((step) => (
          <span className={step.done ? "done" : ""} key={step.label}>
            <i />
            <em>
              {step.label}
              <small>{step.detail}</small>
            </em>
          </span>
        ))}
      </div>
    </div>
  );
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

function loadAgentClaim(): AgentClaim | null {
  const storageKey = "localbridge-agent-claim";
  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) {
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    const deviceId = params.get("device") || "";
    const controlToken = params.get("token") || "";
    if (deviceId.startsWith("lb_") && controlToken.length >= 32) {
      const claim = { deviceId, controlToken };
      localStorage.setItem(storageKey, JSON.stringify(claim));
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#connect`);
      return claim;
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as AgentClaim | null;
    return saved?.deviceId && saved?.controlToken ? saved : null;
  } catch {
    return null;
  }
}

async function backendJson<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/.netlify/functions/pairing${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

function loadWebIdentity(): WebIdentity {
  const key = "localbridge-web-identity";
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "null") as WebIdentity | null;
    if (existing?.deviceId && existing?.controlToken) return existing;
  } catch {
    // Create a fresh browser identity below.
  }
  const platform = detectWebPlatform();
  const identity: WebIdentity = {
    deviceId: `web_${randomHex(16)}`,
    controlToken: randomHex(32),
    deviceName: `${platform === "windows" ? "Windows" : "Mac"} browser`,
    platform,
  };
  localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

function randomHex(byteLength: number) {
  const values = new Uint8Array(byteLength);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function detectWebPlatform(): "windows" | "macos" {
  const value = `${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  return value.includes("win") ? "windows" : "macos";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.readAsDataURL(file);
  });
}

function PlatformIcon({ platform, size = 22 }: { platform?: string; size?: number }) {
  const normalized = (platform || "").toLowerCase();
  if (normalized.includes("mac") || normalized.includes("darwin")) {
    return (
      <svg className="apple-logo" width={size} height={size} viewBox="0 0 384 512" aria-label="Apple" role="img">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C83.7 140.9 43.1 168.5 43.1 224.7c0 22.2 4.1 44.9 12.3 68.2 10.9 31.2 50.2 107.6 91.2 106.4 21.4-.5 36.5-15.2 64.4-15.2 27.1 0 41.1 15.2 64.9 15.2 41.4-.6 77-70.1 87.4-101.4-55.5-26.1-44.6-77.8-44.6-79.2Zm-23.2-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 67.5-34.3Z" />
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

function CommandBox({
  platform,
  title,
  command,
  copyLabel,
  onCopy,
}: {
  platform: string;
  title: string;
  command: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <article className="command-card">
      <div>
        <PlatformIcon platform={platform} size={24} />
        <strong>{title}</strong>
      </div>
      <code>{command}</code>
      <button type="button" onClick={onCopy}>
        <Copy size={16} /> {copyLabel}
      </button>
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
