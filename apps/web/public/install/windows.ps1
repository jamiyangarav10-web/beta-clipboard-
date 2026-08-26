$ErrorActionPreference = "Stop"

$BaseUrl = $env:LOCALBRIDGE_BASE_URL
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = "https://ai-mongolia.netlify.app"
}

$WorkDir = Join-Path $env:TEMP ("LocalBridge-" + [guid]::NewGuid().ToString("N"))
$ZipPath = Join-Path $WorkDir "LocalBridge-Windows.zip"

Write-Host "LocalBridge beta installer for Windows"
Write-Host "Downloading latest agent..."
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

try {
  Invoke-WebRequest -Uri "$BaseUrl/downloads/LocalBridge-Windows.zip" -OutFile $ZipPath -UseBasicParsing
  Write-Host "Unpacking..."
  Expand-Archive -Path $ZipPath -DestinationPath $WorkDir -Force

  $Setup = Join-Path $WorkDir "LocalBridge-Windows\setup_windows.bat"
  if (!(Test-Path $Setup)) {
    throw "setup_windows.bat was not found in the download."
  }

  Write-Host "Installing and starting LocalBridge..."
  $env:LOCALBRIDGE_NONINTERACTIVE = "1"
  & cmd.exe /c "`"$Setup`""
  if ($LASTEXITCODE -ne 0) {
    throw "LocalBridge setup failed with exit code $LASTEXITCODE."
  }

  Write-Host ""
  Write-Host "Done. Open $BaseUrl/#connect to pair this device."
}
finally {
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
