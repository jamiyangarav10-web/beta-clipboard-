# LocalBridge

LocalBridge syncs clipboard text between your Windows and macOS devices.

The beta product goal is simple:

```text
Install LocalBridge -> open the website -> connect two devices -> copy and paste.
```

LocalBridge uses a website for onboarding, downloads, device status, and short-lived pairing. The actual operating-system clipboard sync is handled by native Python agents. Browser JavaScript does not read or write clipboard contents across computers.

## Architecture

```text
localbridge/
  apps/
    web/                  React + TypeScript website and dashboard
  clients/
    windows/              Minimal Windows native UI launcher
    mac/                  Minimal macOS native UI launcher
  services/
    pairing/              Pairing service logic and tests
  packages/
    protocol/             JavaScript protocol validation
    crypto/               JavaScript token and secret helpers
    shared/               Python protocol, identity, config, and security helpers
  netlify/
    functions/            Netlify pairing API
  windows/                Preserved Windows clipboard WebSocket server
  mac/                    Preserved macOS clipboard WebSocket client
  build/                  PyInstaller build scripts
  docs/                   Architecture and pairing notes
```

## How pairing works

1. The native agent creates a stable local device identity on first launch.
2. Each device registers with the Netlify pairing API.
3. Device A creates a short-lived pairing session.
4. Device B joins the session.
5. Device A explicitly approves the request.
6. The API returns a fresh shared secret and endpoint metadata to the agents.
7. Clipboard text syncs directly between agents using the preserved authenticated WebSocket engine.

Pairing states:

```text
UNPAIRED -> PAIRING -> PAIR_APPROVAL_REQUIRED -> PAIRED -> CONNECTED -> DISCONNECTED -> RECONNECTING
```

## Security model

- Clipboard contents are never stored in Netlify.
- Clipboard contents are never shown in the dashboard.
- Clipboard contents are not written to logs.
- Pairing sessions expire after five minutes.
- Pairing sessions are single-use.
- Shared secrets are generated with cryptographically secure randomness.
- Frontend JavaScript never receives permanent app secrets for arbitrary devices.
- Native messages are validated and capped at `MAX_CLIPBOARD_BYTES`.
- Sensitive-data filtering is preserved in the Windows and macOS agents.
- The direct WebSocket service must stay on a private reachable network and must not be exposed publicly without authentication.

## Development

Install JavaScript dependencies:

```bash
npm install
```

Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Python 3.9+ is supported for the native helper modules.

Run the web app:

```bash
npm run dev
```

Open the local site at `http://localhost:5173`.

Run the Netlify web app and functions locally:

```bash
npm run netlify:dev
```

Run the Windows agent during development:

```powershell
python clients\windows\localbridge_agent.py
```

Run the macOS agent during development:

```bash
python3 clients/mac/localbridge_agent.py
```

Legacy manual `.env` mode still works for development:

- `windows/.env` may define `LISTEN_HOST`, `ALLOWED_PEER`, `PORT`, `SECRET`, and `MAX_CLIPBOARD_BYTES`.
- `mac/.env` may define `WINDOWS_TAILSCALE_IP`, `PORT`, `SECRET`, `MAX_CLIPBOARD_BYTES`, and `BLOCK_SENSITIVE_PATTERNS`.

## Tests

Run all tests:

```bash
npm test
```

The suite covers pairing token generation, expiration, single-use approval, invalid device rejection, auth validation, clipboard payload limits, sensitive-data filtering, and protocol messages.

## Deploy to Netlify

1. Push this repository to GitHub.
2. Create a Netlify site from the repository.
3. Use the included `netlify.toml`.
4. Configure Netlify Blobs for the pairing function.
5. Publish signed native agent builds as release artifacts and update the download links in `apps/web/src/main.tsx`.

Netlify Functions are used only for short-lived pairing/authentication/control operations. They are not used as a permanent WebSocket server.

## Build native clients

Windows:

```powershell
./build/build_windows.ps1
```

Output:

```text
dist/LocalBridge-Windows.exe
```

macOS:

```bash
bash build/build_mac.sh
```

Output:

```text
dist/LocalBridge-Mac.app
```

GitHub Actions can also build both artifacts from `.github/workflows/build.yml`.

## User setup

1. Open the LocalBridge website.
2. Download the Windows or macOS agent on each device.
3. Open LocalBridge on both devices.
4. Create a 6-digit pairing code on one device and enter it on the other.
5. Finish pairing on the first device.
6. Copy on one device and paste on the other.

No clipboard content appears on the website.

## Known limitations

- A website cannot silently install native apps or grant OS clipboard access.
- Unsigned beta builds may require manual OS approval.
- The current direct sync transport requires both devices to be reachable on a private network. The product hides IPs and ports from users, but the transport still has to exist.
- Production pairing storage should use Netlify Blobs or another durable store with expiry cleanup.
- The current local UI is intentionally minimal and should be replaced by signed tray/menu-bar apps before a broad public beta.

## License

MIT. See `LICENSE`.
