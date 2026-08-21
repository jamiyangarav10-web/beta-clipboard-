# LocalBridge Architecture

LocalBridge has three layers:

1. Web onboarding and dashboard in `apps/web`.
2. Short-lived pairing APIs in `netlify/functions` and `services/pairing`.
3. Native Python agents for operating-system clipboard access.

The browser never performs cross-device clipboard synchronization. The website starts pairing, shows device state, links downloads, and explains security posture. Clipboard text is read and written only by the native Windows and macOS agents.

## Sync transport

The beta preserves the existing authenticated direct WebSocket engine. Windows listens on the private endpoint, macOS connects, both sides authenticate with the paired shared secret, and both sides enforce payload limits and sensitive-data filtering.

The current beta assumes both devices can reach each other on a private mesh network. Tailscale can still satisfy that transport, but users should not need to see Tailscale IPs, ports, WebSocket URLs, or shared secrets.

## Pairing state machine

```text
UNPAIRED
PAIRING
PAIR_APPROVAL_REQUIRED
PAIRED
CONNECTED
DISCONNECTED
RECONNECTING
```

Pairing sessions expire after five minutes and are single-use. A device must be locally registered before it can create or join a pairing session. The approving device receives credentials only after explicit approval.

## Cloud privacy boundary

Netlify Functions store pairing metadata and direct endpoint descriptors. They do not store clipboard contents or clipboard history. Netlify Functions are not used as a persistent WebSocket server.
