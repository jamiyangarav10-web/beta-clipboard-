#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DOWNLOADS="$ROOT/apps/web/public/downloads"
WORK_DIR="${TMPDIR:-/tmp}/localbridge-downloads"
PYTHON_EMBED_VERSION="3.12.10"
PYTHON_EMBED_URL="https://www.python.org/ftp/python/${PYTHON_EMBED_VERSION}/python-${PYTHON_EMBED_VERSION}-embed-amd64.zip"

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

WINDOWS_RUNTIME="$WORK_DIR/windows/LocalBridge-Windows/runtime"
mkdir -p "$WINDOWS_RUNTIME/Lib/site-packages"
curl -fsSL "$PYTHON_EMBED_URL" -o "$WORK_DIR/python-embed.zip"
unzip -q "$WORK_DIR/python-embed.zip" -d "$WINDOWS_RUNTIME"
python3 -m pip install \
  --disable-pip-version-check \
  --no-compile \
  --no-deps \
  --only-binary=:all: \
  --platform win_amd64 \
  --implementation cp \
  --python-version 3.12 \
  --abi cp312 \
  --target "$WINDOWS_RUNTIME/Lib/site-packages" \
  "websockets==15.0.1" \
  "pyperclip==1.11.0"
printf '\nLib\\site-packages\nimport site\n' >> "$WINDOWS_RUNTIME/python312._pth"
cat > "$WORK_DIR/windows/LocalBridge-Windows/README.txt" <<'EOF'
LocalBridge for Windows

1. Run setup_windows.bat.
2. Open https://ai-mongolia.netlify.app/#connect and pair this device.

Python is included. You do not need to install Python or change App Execution
Aliases. The installer runs LocalBridge in the background at
http://127.0.0.1:17833 and registers it to start automatically when you sign in.
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
