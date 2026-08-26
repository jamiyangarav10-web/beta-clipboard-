@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "APP_DIR=%LOCALAPPDATA%\LocalBridge"
set "BAT_RUNNER=%APP_DIR%\run-localbridge-agent.bat"
set "DIAG=%APP_DIR%\diagnose-localbridge.bat"
set "PYTHON_INSTALLER=%TEMP%\localbridge-python-3.12.10-amd64.exe"
set "PY_CMD="

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 set "PY_CMD=python"

if "%PY_CMD%"=="" (
  where py >nul 2>nul
  if %ERRORLEVEL% EQU 0 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
  echo Python was not found. Installing Python for this user...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile '%PYTHON_INSTALLER%' -UseBasicParsing"
  if !ERRORLEVEL! EQU 0 (
    "%PYTHON_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1 Include_test=0
  ) else (
    echo Could not download Python installer from python.org. Trying winget...
    where winget >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
      winget install --id Python.Python.3.12 --exact --source winget --scope user --silent --accept-package-agreements --accept-source-agreements
    )
  )
  del "%PYTHON_INSTALLER%" >nul 2>nul
  set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)

if not exist "%PY_CMD%" (
  where python >nul 2>nul
  if %ERRORLEVEL% EQU 0 set "PY_CMD=python"
)

if "%PY_CMD%"=="" (
  where py >nul 2>nul
  if %ERRORLEVEL% EQU 0 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
  echo Python was installed, but LocalBridge could not find python.exe.
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
  echo %PY_CMD% agent.py
) > "%BAT_RUNNER%"

(
  echo @echo off
  echo echo Checking LocalBridge agent...
  echo powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:17833/api/status' -TimeoutSec 3 ^| ConvertTo-Json -Depth 4 } catch { Write-Host $_.Exception.Message; exit 1 }"
  echo echo.
  echo echo Agent log:
  echo type "%APP_DIR%\agent.log"
  echo pause
) > "%DIAG%"

echo Starting LocalBridge in a visible terminal window...
start "LocalBridge Agent" cmd /k ""%BAT_RUNNER%""

set "AGENT_READY=0"
for /L %%I in (1,1,15) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:17833/api/status' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
  if !ERRORLEVEL! EQU 0 (
    set "AGENT_READY=1"
    goto agent_ready
  )
  timeout /t 2 /nobreak >nul
)

:agent_ready
if not "%AGENT_READY%"=="1" (
  echo LocalBridge was installed, but the agent did not answer on http://127.0.0.1:17833.
  echo.
  echo Agent log:
  if exist "%APP_DIR%\agent.log" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path '%APP_DIR%\agent.log' -Tail 80"
  ) else (
    echo No agent.log file was created.
  )
  echo.
  echo Run this file to see the exact error:
  echo "%DIAG%"
  if not "%LOCALBRIDGE_NONINTERACTIVE%"=="1" pause
  exit /b 1
)

echo LocalBridge is installed and running.
echo Open https://clipboardbeta.netlify.app/#connect to pair this device.
if not "%LOCALBRIDGE_NONINTERACTIVE%"=="1" pause
