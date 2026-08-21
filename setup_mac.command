#!/bin/bash
set -e
cd "$(dirname "$0")"

APP_DIR="$HOME/Library/Application Support/LocalBridge"
LOG_DIR="$HOME/Library/Logs/localbridge"
PLIST="$HOME/Library/LaunchAgents/com.localbridge.client.plist"

mkdir -p "$APP_DIR/mac" "$LOG_DIR" "$HOME/Library/LaunchAgents"
cp agent.py "$APP_DIR/agent.py"
cp mac/sync_client.py "$APP_DIR/mac/sync_client.py"
cp requirements.txt "$APP_DIR/requirements.txt"

/usr/bin/python3 -m pip install --user -r "$APP_DIR/requirements.txt"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.localbridge.client</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$APP_DIR/agent.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/agent.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/agent.err.log</string>
    <key>WorkingDirectory</key>
    <string>$APP_DIR</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.localbridge.client"

echo "LocalBridge is installed and running."
echo "Open https://localbridge-pairing-beta-163358.netlify.app/#connect to pair this device."
read -p "Press Enter to close..."
