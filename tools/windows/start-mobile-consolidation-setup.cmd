@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "INSTALLER=%SCRIPT_DIR%install-mobile-consolidation.ps1"

if not exist "%INSTALLER%" (
  echo Mobile Consolidation setup script was not found:
  echo %INSTALLER%
  echo.
  pause
  exit /b 1
)

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo Requesting administrator permissions for firewall and Tailscale setup...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo Starting Mobile Consolidation setup...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%" %*
set "SETUP_EXIT=%ERRORLEVEL%"

echo.
if "%SETUP_EXIT%"=="0" (
  echo Setup finished.
  echo Use mobile-pairing-link.txt or mobile-pairing.json from the setup folder to pair Android.
) else (
  echo Setup failed with exit code %SETUP_EXIT%.
)
echo.
pause
exit /b %SETUP_EXIT%
