import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../src/store.mjs";
import { PairingService, PAIRING_TTL_MS } from "../src/service.mjs";

const windows = { deviceId: "lb_windows_1234567890", deviceName: "Windows PC", platform: "windows", directEndpoint: "100.64.1.2:8765" };
const mac = { deviceId: "lb_macos_1234567890", deviceName: "MacBook Pro", platform: "macos", directEndpoint: "100.64.1.3:8765" };

test("pairing code generation creates single-use approval", async () => {
  const store = createMemoryStore();
  await store.clear();
  const service = new PairingService(store);
  await service.registerDevice(windows);
  await service.registerDevice(mac);
  const created = await service.createSession({ deviceId: windows.deviceId });
  assert.equal(created.status, 201);
  assert.match(created.body.pairingId, /^\d{6}$/);
  await service.joinSession({ pairingId: created.body.pairingId, deviceId: mac.deviceId });
  const approved = await service.approveSession({ pairingId: created.body.pairingId });
  assert.equal(approved.status, 200);
  assert.ok(approved.body.credentials.sharedSecret.length >= 64);
  const replay = await service.approveSession({ pairingId: created.body.pairingId });
  assert.equal(replay.status, 409);
});

test("expired pairing tokens are rejected", async () => {
  let time = 1000;
  const store = createMemoryStore();
  await store.clear();
  const service = new PairingService(store, () => time);
  await service.registerDevice(windows);
  const created = await service.createSession({ deviceId: windows.deviceId });
  time += PAIRING_TTL_MS + 1;
  const joined = await service.joinSession({ pairingId: created.body.pairingId, deviceId: mac.deviceId });
  assert.equal(joined.status, 410);
});

test("invalid device rejection blocks unknown and self-pairing devices", async () => {
  const store = createMemoryStore();
  await store.clear();
  const service = new PairingService(store);
  await service.registerDevice(windows);
  const created = await service.createSession({ deviceId: windows.deviceId });
  assert.equal((await service.joinSession({ pairingId: created.body.pairingId, deviceId: "missing" })).status, 404);
  assert.equal((await service.joinSession({ pairingId: created.body.pairingId, deviceId: windows.deviceId })).status, 400);
});
