import crypto from "node:crypto";
import { randomSharedSecret } from "../../../packages/crypto/src/index.mjs";
import { validatePairingRegistration } from "../../../packages/protocol/src/index.mjs";

export const PAIRING_TTL_MS = 5 * 60 * 1000;
export const DEVICE_TTL_MS = 10 * 60 * 1000;

function nowMs(clock) {
  return typeof clock === "function" ? clock() : Date.now();
}

function sessionKey(id) {
  return `session:${id}`;
}

function deviceKey(id) {
  return `device:${id}`;
}

function deviceIndexKey() {
  return "devices:index";
}

function sessionIndexKey() {
  return "sessions:index";
}

function randomPairingCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export class PairingService {
  constructor(store, clock = Date.now) {
    this.store = store;
    this.clock = clock;
  }

  async registerDevice(body) {
    const valid = validatePairingRegistration(body);
    if (!valid.ok) return { status: 400, body: { error: valid.reason } };
    const existing = await this.store.get(deviceKey(body.deviceId));

    const device = {
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      publicKey: body.publicKey || "",
      directEndpoint: body.directEndpoint || "",
      controlTokenHash: body.controlToken ? hashToken(body.controlToken) : "",
      approvedPairings: existing?.approvedPairings || [],
      currentPairingId: existing?.currentPairingId || null,
      state: existing?.currentPairingId ? "PAIRED" : "UNPAIRED",
      expiresAt: nowMs(this.clock) + DEVICE_TTL_MS,
      updatedAt: nowMs(this.clock)
    };
    await this.store.set(deviceKey(device.deviceId), device);
    await this.addToIndex(deviceIndexKey(), device.deviceId);
    return { status: 200, body: { deviceId: device.deviceId, state: device.state, expiresAt: device.expiresAt } };
  }

  async listDevices() {
    const ids = await this.store.get(deviceIndexKey()) || [];
    const devices = [];
    for (const id of ids) {
      const device = await this.store.get(deviceKey(id));
      if (device && device.expiresAt > nowMs(this.clock)) {
        devices.push(publicDevice(device));
      }
    }
    return { status: 200, body: { devices } };
  }

  async createSession(body) {
    if (!body || typeof body.deviceId !== "string") {
      return { status: 400, body: { error: "deviceId required" } };
    }
    const device = await this.store.get(deviceKey(body.deviceId));
    if (!device || device.expiresAt <= nowMs(this.clock)) {
      return { status: 404, body: { error: "registered device not found" } };
    }
    let pairingId = randomPairingCode();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const existing = await this.store.get(sessionKey(pairingId));
      if (!existing || existing.expiresAt <= nowMs(this.clock)) break;
      pairingId = randomPairingCode();
    }
    const session = {
      pairingId,
      requesterDeviceId: body.deviceId,
      responderDeviceId: null,
      state: "PAIRING",
      used: false,
      expiresAt: nowMs(this.clock) + PAIRING_TTL_MS,
      createdAt: nowMs(this.clock)
    };
    await this.store.set(sessionKey(pairingId), session);
    await this.addToIndex(sessionIndexKey(), pairingId);
    return {
      status: 201,
      body: {
        pairingId,
        expiresAt: session.expiresAt,
        state: session.state
      }
    };
  }

  async joinSession(body) {
    if (!body || typeof body.pairingId !== "string" || typeof body.deviceId !== "string") {
      return { status: 400, body: { error: "pairingId and deviceId required" } };
    }
    const session = await this.store.get(sessionKey(body.pairingId));
    const device = await this.store.get(deviceKey(body.deviceId));
    if (!session || session.expiresAt <= nowMs(this.clock)) return { status: 410, body: { error: "pairing session expired" } };
    if (!device || device.expiresAt <= nowMs(this.clock)) return { status: 404, body: { error: "registered device not found" } };
    if (session.used) return { status: 409, body: { error: "pairing session already used" } };
    if (session.requesterDeviceId === body.deviceId) return { status: 400, body: { error: "cannot pair device with itself" } };

    session.responderDeviceId = body.deviceId;
    session.state = "PAIR_APPROVAL_REQUIRED";
    await this.store.set(sessionKey(session.pairingId), session);
    return { status: 200, body: { pairingId: session.pairingId, state: session.state, requesterDeviceId: session.requesterDeviceId } };
  }

  async approveSession(body) {
    if (!body || typeof body.pairingId !== "string") {
      return { status: 400, body: { error: "pairingId required" } };
    }
    const session = await this.store.get(sessionKey(body.pairingId));
    if (!session || session.expiresAt <= nowMs(this.clock)) return { status: 410, body: { error: "pairing session expired" } };
    if (session.used) return { status: 409, body: { error: "pairing session already used" } };
    if (!session.responderDeviceId) return { status: 409, body: { error: "no second device joined" } };

    const requester = await this.store.get(deviceKey(session.requesterDeviceId));
    const responder = await this.store.get(deviceKey(session.responderDeviceId));
    if (!requester || !responder) return { status: 404, body: { error: "device missing" } };

    const sharedSecret = randomSharedSecret();
    const credentials = {
      sharedSecret,
      transport: "direct-websocket",
      maxClipboardBytes: 1048576,
      devices: [
        publicDevice(requester),
        publicDevice(responder)
      ]
    };

    session.used = true;
    session.state = "PAIRED";
    session.credentials = credentials;
    await this.store.set(sessionKey(session.pairingId), session);
    await this.store.set(deviceKey(requester.deviceId), { ...requester, state: "PAIRED", currentPairingId: session.pairingId });
    await this.store.set(deviceKey(responder.deviceId), { ...responder, state: "PAIRED", currentPairingId: session.pairingId });

    return { status: 200, body: { pairingId: session.pairingId, state: "PAIRED", credentials } };
  }

  async pollDevice(body) {
    if (!body || typeof body.deviceId !== "string" || typeof body.controlToken !== "string") {
      return { status: 400, body: { error: "deviceId and controlToken required" } };
    }
    const device = await this.store.get(deviceKey(body.deviceId));
    if (!device || device.expiresAt <= nowMs(this.clock)) {
      return { status: 404, body: { error: "registered device not found" } };
    }
    if (device.controlTokenHash && device.controlTokenHash !== hashToken(body.controlToken)) {
      return { status: 403, body: { error: "invalid device token" } };
    }

    const sessions = [];
    const ids = await this.store.get(sessionIndexKey()) || [];
    for (const id of ids) {
      const session = await this.store.get(sessionKey(id));
      if (!session || session.expiresAt <= nowMs(this.clock)) continue;
      const involved = session.requesterDeviceId === body.deviceId || session.responderDeviceId === body.deviceId;
      if (!involved) continue;
      const publicSession = { ...session };
      if (!session.used) delete publicSession.credentials;
      sessions.push(publicSession);
    }

    let pairedSession = null;
    if (device.currentPairingId) {
      const currentSession = await this.store.get(sessionKey(device.currentPairingId));
      if (currentSession?.used && currentSession.credentials) pairedSession = currentSession;
    }
    if (!pairedSession) {
      pairedSession = sessions
        .filter((session) => session.used && session.credentials)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
    }
    return {
      status: 200,
      body: {
        device: publicDevice(device),
        sessions,
        credentials: pairedSession?.credentials || null
      }
    };
  }

  async getSession(pairingId) {
    const session = await this.store.get(sessionKey(pairingId));
    if (!session || session.expiresAt <= nowMs(this.clock)) return { status: 404, body: { error: "pairing session not found" } };
    const publicSession = { ...session };
    delete publicSession.credentials?.sharedSecret;
    return { status: 200, body: publicSession };
  }

  async addToIndex(key, id) {
    const index = await this.store.get(key) || [];
    if (!index.includes(id)) {
      index.push(id);
      await this.store.set(key, index);
    }
  }
}

function publicDevice(device) {
  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    directEndpoint: device.directEndpoint,
    state: device.state,
    currentPairingId: device.currentPairingId || null,
    publicKey: device.publicKey
  };
}
