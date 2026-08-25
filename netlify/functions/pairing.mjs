import { PairingService } from "../../services/pairing/src/service.mjs";
import { createNetlifyBlobStore, createMemoryStore } from "../../services/pairing/src/store.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  },
  body: JSON.stringify(body)
});

async function readBody(event) {
  if (!event.body) return {};
  return JSON.parse(event.body);
}

export const handler = async (event) => {
  try {
    let store;
    try {
      store = await createNetlifyBlobStore();
    } catch {
      store = createMemoryStore();
    }
    const service = new PairingService(store);
    const path = event.path.replace(/^.*\/pairing/, "") || "/";
    const method = event.httpMethod.toUpperCase();

    if (method === "OPTIONS") {
      return json(204, {});
    }
    if (method === "GET" && path === "/devices") {
      const result = await service.listDevices();
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/register") {
      const result = await service.registerDevice(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/device/poll") {
      const result = await service.pollDevice(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/session") {
      const result = await service.createSession(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/join") {
      const result = await service.joinSession(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/approve") {
      const result = await service.approveSession(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/relay/send") {
      const result = await service.sendRelayMessage(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "POST" && path === "/relay/poll") {
      const result = await service.pollRelayMessages(await readBody(event));
      return json(result.status, result.body);
    }
    if (method === "GET" && path.startsWith("/session/")) {
      const pairingId = decodeURIComponent(path.slice("/session/".length));
      const result = await service.getSession(pairingId);
      return json(result.status, result.body);
    }

    return json(404, { error: "not found" });
  } catch (error) {
    return json(500, { error: "pairing function failed", detail: error?.message || String(error) });
  }
};
