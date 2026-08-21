import { PairingService } from "../../services/pairing/src/service.mjs";
import { createNetlifyBlobStore, createMemoryStore } from "../../services/pairing/src/store.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store"
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

    if (method === "POST" && path === "/register") {
      const result = await service.registerDevice(await readBody(event));
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
