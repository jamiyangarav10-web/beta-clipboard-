$ErrorActionPreference = "Stop"
python -m pip install --upgrade pip pyinstaller
python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm --clean --onefile --windowed --name LocalBridge-Windows `
  --add-data "windows;windows" `
  --add-data "packages;packages" `
  clients/windows/localbridge_agent.py
Write-Host "Built dist/LocalBridge-Windows.exe"
