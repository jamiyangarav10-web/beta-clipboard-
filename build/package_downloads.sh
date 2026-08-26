#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DOWNLOADS="$ROOT/apps/web/public/downloads"
WORK_DIR="${TMPDIR:-/tmp}/localbridge-downloads"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/mac/LocalBridge-Mac/mac"
mkdir -p "$WORK_DIR/windows/LocalBridge-Windows/windows"
mkdir -p "$WORK_DIR/windows/LocalBridge-Windows/packages/shared"
mkdir -p "$PUBLIC_DOWNLOADS"
rm -f "$PUBLIC_DOWNLOADS/LocalBridge-Mac.zip" "$PUBLIC_DOWNLOADS/LocalBridge-Windows.zip" "$PUBLIC_DOWNLOADS/LocalBridge-Windows-python.zip"

cp "$ROOT/setup_mac.command" "$WORK_DIR/mac/LocalBridge-Mac/setup_mac.command"
cp "$ROOT/requirements.txt" "$WORK_DIR/mac/LocalBridge-Mac/requirements.txt"
cp "$ROOT/clients/native/agent.py" "$WORK_DIR/mac/LocalBridge-Mac/agent.py"
cp "$ROOT/clients/native/cloud_relay.py" "$WORK_DIR/mac/LocalBridge-Mac/cloud_relay.py"
cp "$ROOT/clients/native/mac/sync_client.py" "$WORK_DIR/mac/LocalBridge-Mac/mac/sync_client.py"
chmod +x "$WORK_DIR/mac/LocalBridge-Mac/setup_mac.command"
cat > "$WORK_DIR/mac/LocalBridge-Mac/README.txt" <<'EOF'
LocalBridge for macOS

1. Double-click setup_mac.command.
2. If macOS blocks it, Control-click the file, choose Open, then approve.
3. Open https://ai-mongolia.netlify.app/#connect and pair this device.

The installer runs LocalBridge in the background at http://127.0.0.1:17833.
EOF

cp "$ROOT/setup_windows.bat" "$WORK_DIR/windows/LocalBridge-Windows/setup_windows.bat"
cp "$ROOT/requirements.txt" "$WORK_DIR/windows/LocalBridge-Windows/requirements.txt"
cp "$ROOT/clients/native/agent.py" "$WORK_DIR/windows/LocalBridge-Windows/agent.py"
cp "$ROOT/clients/native/cloud_relay.py" "$WORK_DIR/windows/LocalBridge-Windows/cloud_relay.py"
cp "$ROOT/windows/server.py" "$WORK_DIR/windows/LocalBridge-Windows/windows/server.py"
cp -R "$ROOT/packages/shared/localbridge" "$WORK_DIR/windows/LocalBridge-Windows/packages/shared/localbridge"
find "$WORK_DIR/windows/LocalBridge-Windows/packages" -name "__pycache__" -type d -prune -exec rm -rf {} +
cat > "$WORK_DIR/windows/LocalBridge-Windows/README.txt" <<'EOF'
LocalBridge for Windows

1. Run setup_windows.bat.
2. Open https://ai-mongolia.netlify.app/#connect and pair this device.

The installer runs LocalBridge in the background at http://127.0.0.1:17833 and
registers it to start automatically when you sign in to Windows.
EOF

(
  cd "$WORK_DIR/mac"
  zip -qr "$PUBLIC_DOWNLOADS/LocalBridge-Mac.zip" LocalBridge-Mac
)
(
  cd "$WORK_DIR/windows"
  zip -qr "$PUBLIC_DOWNLOADS/LocalBridge-Windows.zip" LocalBridge-Windows
)
cp "$PUBLIC_DOWNLOADS/LocalBridge-Windows.zip" "$PUBLIC_DOWNLOADS/LocalBridge-Windows-python.zip"

echo "Wrote:"
echo "  $PUBLIC_DOWNLOADS/LocalBridge-Mac.zip"
echo "  $PUBLIC_DOWNLOADS/LocalBridge-Windows.zip"
echo "  $PUBLIC_DOWNLOADS/LocalBridge-Windows-python.zip (compatibility alias)"
