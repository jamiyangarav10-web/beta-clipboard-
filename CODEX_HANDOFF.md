# LocalBridge — Codex continuation handoff

Read this first. It explains what LocalBridge is, the architecture, and the ONE missing
piece that caused "it can't connect two devices." Most of the hard parts are already done;
you mostly need to (a) know the architecture, (b) keep the native agent, and (c) do the
polish tasks at the bottom.

## What it is
LocalBridge syncs the clipboard between a user's Mac and Windows PC over their private
Tailscale network. Copy on one device, paste on the other. There is NO cloud clipboard
storage and NO AI/LLM anywhere in the project — it is a local peer-to-peer clipboard relay.

## Architecture (this is the key)
- The website (apps/web, deployed on Netlify) is ONLY a control panel. It does NOT sync
  anything itself.
- The website talks to a LOCAL native agent on each machine at http://127.0.0.1:17833.
  See apps/web/src/main.tsx -> CONTROL_URL. Browsers cannot read/write the OS clipboard,
  so a local program on each machine is required. This is by design, not a bug.
- The native agent (clients/native/agent.py):
  - serves a small REST API on 127.0.0.1:17833 that the site calls:
      GET  /api/status
      POST /api/register
      POST /api/pairing/session      (Mac creates a session -> returns a 6-digit pairingId)
      POST /api/pairing/join         (peer joins with pairingId)
      POST /api/pairing/approve      (Mac approves with pairingId -> launches sync engine)
  - proxies pairing to the backend (services/pairing, deployed as the Netlify function at
    /.netlify/functions/pairing).
  - after approve, launches the clipboard sync engine (subprocess).
- Sync engine:
  - macOS: clients/native/mac/sync_client.py — self-contained, only needs `websockets` +
    pbcopy/pbpaste. Connects to the Windows server over Tailscale (ws://<windows_ip>:8765),
    sends auth {type:"auth", secret:SECRET}, relays clipboard {type:"clipboard", text:...}.
  - Windows: windows/server.py — the hardened server you built. Accepts the connection,
    validates the shared secret (constant-time), writes to the Windows clipboard.
- Protocol constants live in packages/protocol/src/index.mjs (AuthMessageType="auth",
  clipboard message {type:"clipboard", text}). The agent + sync client already match them.

## What was MISSING (the gap you left)
You built the website + the pairing backend, but you NEVER built the native agent that
lives on 127.0.0.1:17833. So the site had nothing to talk to -> "can't connect 2 devices."
clients/native/agent.py was added afterward (not by you). It is the missing piece. Do not
"clean up" or remove it — without it the entire product is non-functional.

## Key files
- clients/native/agent.py        <- the control agent (NEW). REST on :17833, launches sync.
- clients/native/mac/sync_client.py <- macOS sync client (NEW, self-contained).
- windows/server.py              <- your hardened Windows sync server (proven, unchanged).
- apps/web/src/main.tsx          <- CONTROL_URL = http://127.0.0.1:17833. DO NOT change this.
- netlify/functions/pairing.mjs  <- pairing backend. Has an in-memory fallback; Netlify
                                    Blobs are NOT provisioned, so pairing state resets on a
                                    cold serverless instance.
- apps/web/public/downloads/LocalBridge-{Mac,Windows}.zip <- downloadable installers
  (built, wired to the Download buttons, deployed). Each zip contains clients/native/agent.py
  + the right sync engine + an installer script (setup_mac.command / setup_windows.bat).

## Current status (verified)
- Mac: agent runs via LaunchAgent (com.localbridge.client), site connects, full pairing
  flow works end-to-end, clipboard relay proven with a loopback test.
- Windows: package built and downloadable; the user must run setup_windows.bat on the
  Windows PC (installs deps, starts the agent). Not yet verified from the Mac side because
  the Windows peer's port 8765 was not up during testing.
- Site deployed: https://ai-mongolia.netlify.app

## Hard constraints / gotchas
- The agent MUST run with the SYSTEM python3 (/usr/bin/python3 on macOS — it has
  `websockets`). Homebrew python3.13 does NOT have websockets, so sync fails there.
- Keep CONTROL_URL at 127.0.0.1:17833. The browser calls localhost, which is exempt from
  mixed-content/CORS problems; agent.py also sends permissive CORS headers.
- Pairing backend is in-memory: test a pairing in one sitting (the serverless instance may
  recycle between calls and drop state).
- Windows .exe / Mac .app were never compiled (you cannot build a Windows .exe from macOS).
  The downloads are zips. That is acceptable but not "signed binaries."

## Good next tasks
1. Generate the download zips from the repo in CI instead of hand-building them (add a
   packaging script that zips clients/native + windows/server.py + packages/shared).
2. Provision Netlify Blobs for persistent pairing (store.mjs already has
   createNetlifyBlobStore; it just needs the siteID/token from the dashboard env).
3. Add a real "agent detected / not detected" indicator on the site by polling /api/status,
   so users immediately see whether the local app is installed.
4. Properly package signed Mac .app and Windows .exe installers via a cross-platform build
   (e.g. GitHub Actions + PyInstaller) and point the Download buttons at those.
5. Surface sync connection errors (e.g. Windows peer unreachable) into the site UI instead
   of only the agent log.

## How a user pairs (for context)
Mac: Register device -> Create session (gets 6-digit pairing code).
Windows: enter pairing code -> Join session.
Mac: Finish pairing. Both show PAIRED; clipboard syncs.
