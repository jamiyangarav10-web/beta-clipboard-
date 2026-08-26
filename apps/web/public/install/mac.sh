#!/bin/bash
set -euo pipefail

BASE_URL="${LOCALBRIDGE_BASE_URL:-https://ai-mongolia.netlify.app}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "LocalBridge beta installer for macOS"
echo "Downloading latest agent..."
curl -fsSL "$BASE_URL/downloads/LocalBridge-Mac.zip" -o "$WORK_DIR/LocalBridge-Mac.zip"

echo "Unpacking..."
unzip -q "$WORK_DIR/LocalBridge-Mac.zip" -d "$WORK_DIR"
chmod +x "$WORK_DIR/LocalBridge-Mac/setup_mac.command"

echo "Installing and starting LocalBridge..."
LOCALBRIDGE_NONINTERACTIVE=1 "$WORK_DIR/LocalBridge-Mac/setup_mac.command"

echo
echo "Done. Open $BASE_URL/#connect to pair this device."
