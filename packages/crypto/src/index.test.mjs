import test from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual, randomSharedSecret, randomToken, sha256 } from "./index.mjs";

test("random tokens are URL-safe and unique", () => {
  const a = randomToken();
  const b = randomToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test("shared secrets have enough entropy for agent auth", () => {
  assert.ok(randomSharedSecret().length >= 64);
});

test("constant-time compare preserves equality semantics", () => {
  const digest = sha256("localbridge");
  assert.equal(constantTimeEqual(digest, digest), true);
  assert.equal(constantTimeEqual(digest, sha256("other")), false);
});
