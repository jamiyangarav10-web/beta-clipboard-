import crypto from "node:crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomDeviceId() {
  return `lb_${randomToken(18)}`;
}

export function randomSharedSecret() {
  return randomToken(48);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
