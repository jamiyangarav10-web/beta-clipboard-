@echo off
setlocal
cd /d "%~dp0"

set "APP_DIR=%LOCALAPPDATA%\LocalBridge"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "RUNNER=%APP_DIR%\start-localbridge.vbs"
set "BAT_RUNNER=%APP_DIR%\run-localbridge-agent.bat"
set "DIAG=%APP_DIR%\diagnose-localbridge.bat"
set "PY_CMD="

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 set "PY_CMD=python"

if "%PY_CMD%"=="" (
  where py >nul 2>nul
  if %ERRORLEVEL% EQU 0 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
  echo Python was not found.
  echo Install Python 3 from https://www.python.org/downloads/ and check "Add python.exe to PATH".
  if not "%LOCALBRIDGE_NONINTERACTIVE%"=="1" pause
  exit /b 1
)

if not exist "%APP_DIR%" mkdir "%APP_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*LocalBridge*agent.py*' -or $_.CommandLine -like '*LocalBridge*windows*server.py*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }" >nul 2>nul

xcopy /E /I /Y packages "%APP_DIR%\packages" >nul
xcopy /E /I /Y windows "%APP_DIR%\windows" >nul
copy /Y agent.py "%APP_DIR%\agent.py" >nul
copy /Y cloud_relay.py "%APP_DIR%\cloud_relay.py" >nul
copy /Y requirements.txt "%APP_DIR%\requirements.txt" >nul

%PY_CMD% -m pip install --user -r "%APP_DIR%\requirements.txt"

(
  echo @echo off
  echo cd /d "%%~dp0"
  echo %PY_CMD% agent.py ^>^> agent.log 2^>^&1
) > "%BAT_RUNNER%"

(
  echo Set shell = CreateObject^("WScript.Shell"^)
  echo shell.CurrentDirectory = "%APP_DIR%"
  echo shell.Run "cmd.exe /c ""%BAT_RUNNER%""", 0, False
) > "%RUNNER%"

(
  echo @echo off
  echo echo Checking LocalBridge agent...
  echo powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:17833/api/status' -TimeoutSec 3 ^| ConvertTo-Json -Depth 4 } catch { Write-Host $_.Exception.Message; exit 1 }"
  echo echo.
  echo echo Agent log:
  echo type "%APP_DIR%\agent.log"
  echo pause
) > "%DIAG%"

copy /Y "%RUNNER%" "%STARTUP%\LocalBridge.vbs" >nul
wscript "%RUNNER%"

timeout /t 2 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:17833/api/status' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
  echo LocalBridge was installed, but the agent did not answer on http://127.0.0.1:17833.
  echo Run this file to see the exact error:
  echo "%DIAG%"
  if not "%LOCALBRIDGE_NONINTERACTIVE%"=="1" pause
  exit /b 1
)

echo LocalBridge is installed and running.
echo Open https://clipboardbeta.netlify.app/#connect to pair this device.
if not "%LOCALBRIDGE_NONINTERACTIVE%"=="1" pause
