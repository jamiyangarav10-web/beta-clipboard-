export const PairingState = Object.freeze({
  UNPAIRED: "UNPAIRED",
  PAIRING: "PAIRING",
  PAIR_APPROVAL_REQUIRED: "PAIR_APPROVAL_REQUIRED",
  PAIRED: "PAIRED",
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
  RECONNECTING: "RECONNECTING"
});

export const ClipboardMessageType = "clipboard";
export const AuthMessageType = "auth";
export const MaxClipboardBytes = 1024 * 1024;

export function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function validateClipboardMessage(message, maxBytes = MaxClipboardBytes) {
  if (!message || typeof message !== "object") {
    return { ok: false, reason: "message must be an object" };
  }
  if (message.type !== ClipboardMessageType) {
    return { ok: false, reason: "unsupported message type" };
  }
  if (typeof message.text !== "string") {
    return { ok: false, reason: "clipboard text must be a string" };
  }
  if (utf8Bytes(message.text) > maxBytes) {
    return { ok: false, reason: "clipboard payload too large" };
  }
  return { ok: true };
}

export function validateAuthMessage(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, reason: "message must be an object" };
  }
  if (message.type !== AuthMessageType) {
    return { ok: false, reason: "unsupported message type" };
  }
  if (typeof message.secret !== "string" || message.secret.length < 32) {
    return { ok: false, reason: "secret is missing or too short" };
  }
  return { ok: true };
}

export function validatePairingRegistration(body) {
  const platforms = new Set(["windows", "macos"]);
  if (!body || typeof body !== "object") return { ok: false, reason: "body must be an object" };
  if (typeof body.deviceId !== "string" || body.deviceId.length < 16) return { ok: false, reason: "invalid device id" };
  if (typeof body.deviceName !== "string" || body.deviceName.length < 1 || body.deviceName.length > 80) return { ok: false, reason: "invalid device name" };
  if (!platforms.has(body.platform)) return { ok: false, reason: "invalid platform" };
  if (body.directEndpoint !== undefined && typeof body.directEndpoint !== "string") return { ok: false, reason: "invalid endpoint" };
  if (body.publicKey !== undefined && typeof body.publicKey !== "string") return { ok: false, reason: "invalid public key" };
  return { ok: true };
}
