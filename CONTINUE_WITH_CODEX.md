# Continue LocalBridge — handoff brief for a NEW Codex (or Claude Code) session

The previous Codex session hit usage limits mid-build and its context is gone.
This file gives a fresh session everything it needs to continue WITHOUT redoing work.
Read the codebase in this folder first; do NOT throw away or rewrite working code.

## GOAL
Build **LocalBridge**: a ZERO-CONFIG consumer clipboard-sync product. It syncs the
OS clipboard between a Windows PC and a Mac over Tailscale. The user must NEVER
manually configure: Tailscale IPs, .env files, shared secrets, ports, WebSocket URLs,
or terminal commands. Target UX: "install once, connect once, forget it exists."

## HARD TECHNICAL CONSTRAINT (do not violate)
A normal browser website CANNOT silently read/write the OS clipboard across two
different computers. Therefore:
- The Netlify website is ONLY the onboarding / control / PAIRING layer.
- A small native LocalBridge agent runs on Windows + Mac and does the actual
  system clipboard synchronization.
- The website must NOT pretend browser JS alone can do cross-device OS clipboard sync.

## ARCHITECTURE (as specified)
- Frontend: modern responsive web app, React + TypeScript, Vite, deployable to Netlify.
  Desktop-first but responsive, clean minimal SaaS UI.
- Backend: Netlify Functions / API ONLY for short-lived pairing/auth/control.
  Do NOT use Netlify Functions as a permanent WebSocket server or long-running process.
  Native agents communicate directly (or via an appropriate realtime service) for sync.
- Native agents: preserve the existing Python clipboard engine. Windows + Mac agents
  monitor / receive / update clipboard, auth, reconnect, filter sensitive data.
  Keep clipboard out of logs, enforce payload size limits, keep auth secure,
  never expose publicly without auth.

## ZERO-CONFIG PAIRING (desired UX)
User opens the site -> "Connect your devices" -> picks [Windows]/[macOS] ->
installs native agent -> agent shows "LocalBridge is ready" -> site shows "Device detected"
-> "Connect another device" -> temporary short-lived pairing session/token (single-use,
expires) -> identifies + authenticates both devices -> establishes secure relationship ->
generates/stores credentials -> exchanges minimum info for direct connection.
Never show raw Tailscale IPs to the user. Never require editing config files.

## SECURITY REQUIREMENTS (must hold)
- Never log clipboard contents. Never store clipboard contents in the backend.
- Pairing tokens expire; pairing sessions are single-use.
- Use cryptographically secure random tokens. Never expose permanent secrets in frontend JS.
- Keep .env / private credentials OUT of Git and GitHub.
- Validate all incoming messages; enforce max clipboard payload size.
- Preserve existing sensitive-data filtering. Protect against unauthorized pairing.
- A device must EXPLICITLY approve a pairing request. No arbitrary visitor->device connect.
- Privacy: the backend must NOT become a clipboard storage service; data travels
  directly between paired devices; no cloud clipboard history for this beta.

## WHAT ALREADY EXISTS IN THIS FOLDER (verify by reading, then build on it)
- `packages/shared/localbridge/`: AgentRuntime, control_server (local HTTP API :17833),
  pairing_client, protocol, security, identity, config, tailscale, state.
- `clients/mac/` + `clients/windows/`: agent shells with a Tkinter GUI (status, paired
  device, sync/reconnect/disconnect/remove controls).
- `mac/mac_client.py` + `windows/server.py`: clipboard sync engine (WebSocket over
  Tailscale, hardened: constant-time secret compare, Tailscale-only bind, no clipboard in
  logs, sensitive-pattern filtering, payload size cap).
- `services/pairing/src/service.mjs` + `store.mjs`: pairing broker logic
  (register -> session -> join -> approve -> issue sharedSecret). Pure, no npm deps.
- `apps/web/`: React/Vite pairing website (has node_modules).
- `packages/crypto`, `packages/protocol`: shared crypto + wire protocol.
- `netlify/functions/pairing.mjs`: pairs the broker to Netlify (uses @netlify/blobs).
- `setup_mac.command` / `setup_windows.bat`, `requirements.txt`, tests, docs, `netlify.toml`.
- `local_broker.mjs`: a dependency-free LOCAL dev broker (wraps PairingService on
  http://127.0.0.1:8888) added for local testing, since the repo has no runnable local
  backend otherwise.

## KNOWN GAPS / WHAT REMAINS (previous session hit limits before finishing)
1. NOT a git repo — run `git init` and commit the current state before anything else.
2. ENGINE VERSION MISMATCH: `mac/mac_client.py` and `windows/server.py` here are dated
   Aug 15, but newer "HARDENED" versions exist at ~/Downloads/server.py and
   ~/Downloads/mac_client.py (Aug 19). Reconcile which is canonical and unify them.
3. NO runnable local pairing backend in the repo — pairing is only wired as a Netlify
   Function. `local_broker.mjs` covers local dev. Make the pairing backend properly
   runnable (real server or document the Netlify deploy) so `npm run dev` + pairing works.
4. Web frontend + pairing broker NOT verified working end-to-end together. Wire them and
   test the full flow: register two devices -> session -> join -> approve -> credentials
   returned -> engine uses them to connect.
5. No end-to-end clipboard test: with two paired devices, confirm a copy on one appears on
   the other. (Note: live cross-device test needs a real second device + Tailscale.)

## SUGGESTED FIRST STEPS FOR THIS SESSION
1. `git init && git add -A && git commit -m "LocalBridge zero-config WIP from prior Codex session"`
2. Read every file in the repo; output a short architecture summary (do not modify yet).
3. Reconcile the engine file mismatch (#2).
4. Make the pairing backend runnable locally; verify the pairing flow via `local_broker.mjs`.
5. Wire the web frontend to the broker; verify the pairing UI end-to-end.
6. Add/extend tests; verify the security requirements above are met.
