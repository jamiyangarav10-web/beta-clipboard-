import test from "node:test";
import assert from "node:assert/strict";
import { PairingState, validateAuthMessage, validateClipboardMessage } from "./index.mjs";

test("pairing state machine includes required consumer states", () => {
  assert.equal(PairingState.UNPAIRED, "UNPAIRED");
  assert.equal(PairingState.PAIR_APPROVAL_REQUIRED, "PAIR_APPROVAL_REQUIRED");
  assert.equal(PairingState.RECONNECTING, "RECONNECTING");
});

test("clipboard validation rejects oversized payloads", () => {
  const message = { type: "clipboard", text: "abcdef" };
  assert.deepEqual(validateClipboardMessage(message, 5), { ok: false, reason: "clipboard payload too large" });
});

test("auth validation rejects short secrets", () => {
  assert.equal(validateAuthMessage({ type: "auth", secret: "short" }).ok, false);
  assert.equal(validateAuthMessage({ type: "auth", secret: "x".repeat(32) }).ok, true);
});
