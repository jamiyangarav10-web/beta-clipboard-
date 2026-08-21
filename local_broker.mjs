// Minimal local pairing broker to run the Codex build without Netlify.
// Wires the repo's PairingService to an HTTP server on http://127.0.0.1:8888
import http from "node:http";
import { PairingService } from "./services/pairing/src/service.mjs";
import { createMemoryStore } from "./services/pairing/src/store.mjs";

const store = createMemoryStore();
const service = new PairingService(store);
const PORT = 8888;
const HOST = "127.0.0.1";

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}
const r = (result) => [result.status, result.body];

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" });
    return res.end();
  }
  let body = {};
  if (req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { body = {}; }
  }
  const p = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  try {
    if (req.method === "POST" && p === "/api/pairing/register") return send(res, ...r(await service.registerDevice(body)));
    if (req.method === "POST" && p === "/api/pairing/session") return send(res, ...r(await service.createSession(body)));
    if (req.method === "POST" && p === "/api/pairing/join") return send(res, ...r(await service.joinSession(body)));
    if (req.method === "POST" && p === "/api/pairing/approve") return send(res, ...r(await service.approveSession(body)));
    if (req.method === "GET" && p.startsWith("/api/pairing/session/")) {
      const id = decodeURIComponent(p.slice("/api/pairing/session/".length));
      return send(res, ...r(await service.getSession(id)));
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: String(e) });
  }
});

server.listen(PORT, HOST, () => console.log(`LocalBridge pairing broker on http://${HOST}:${PORT}`));
