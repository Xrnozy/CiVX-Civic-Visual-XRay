@echo off
setlocal

cd /d "%~dp0.."

where cloudflared >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo cloudflared not found. Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  exit /b 1
)

echo Starting tunnel ^(origin http://127.0.0.1:80 - Caddy^)...
cloudflared tunnel --config infra/cloudflared-config.yml run
