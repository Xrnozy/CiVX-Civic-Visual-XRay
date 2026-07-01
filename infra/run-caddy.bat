@echo off
setlocal

cd /d "%~dp0.."

set "CADDY_ROOT=%CD%\web\dist"
if not exist "%CADDY_ROOT%\index.html" (
  echo ERROR: %CADDY_ROOT%\index.html not found.
  echo Run: cd web ^&^& npm run build
  exit /b 1
)

set "CADDY_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe\caddy.exe"

echo Serving static files from: %CADDY_ROOT%

where caddy >nul 2>&1
if %ERRORLEVEL%==0 (
  caddy run --config infra/Caddyfile
  exit /b %ERRORLEVEL%
)

if exist "%CADDY_EXE%" (
  "%CADDY_EXE%" run --config infra/Caddyfile
  exit /b %ERRORLEVEL%
)

echo Caddy not found. Install with: winget install CaddyServer.Caddy
exit /b 1
