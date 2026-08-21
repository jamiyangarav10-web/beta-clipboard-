#!/bin/bash
set -e
python3 -m pip install --upgrade pip pyinstaller
python3 -m pip install -r requirements.txt
python3 -m PyInstaller --noconfirm --clean --onedir --windowed --name LocalBridge-Mac \
  --add-data "mac:mac" \
  --add-data "packages:packages" \
  clients/mac/localbridge_agent.py
echo "Built dist/LocalBridge-Mac.app"
