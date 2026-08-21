# Pairing Flow

1. Each native agent creates a stable local identity on first launch.
2. The agent registers `{ deviceId, deviceName, platform, directEndpoint }` with `/api/pairing/register`.
3. Device A creates a short-lived session with `/api/pairing/session`.
4. Device B joins with `/api/pairing/join`.
5. Device A explicitly approves the pending request with `/api/pairing/approve`.
6. The pairing function returns a fresh shared secret and the minimum endpoint metadata required for the direct agent connection.
7. Each agent stores credentials in the local application-support directory.

Pairing tokens expire, are single-use, and are never permanent device credentials.

## Manual action still required in beta

Browsers cannot silently install native apps or grant clipboard permissions. Users still need to download and open the LocalBridge agent on both devices. Unsigned builds may require operating-system approval. The direct transport requires both devices to be mutually reachable on a private network.
