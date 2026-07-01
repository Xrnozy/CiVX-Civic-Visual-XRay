@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "INFRA=%ROOT%\infra"

echo.
echo === CiVX hosting stack ===
echo Repo: %ROOT%
echo.

REM --- Redis (passive pipeline + API queue status) ---
call "%INFRA%\run-redis.bat"
if errorlevel 1 (
  echo WARNING: Redis not available. Workers and passive pipeline will fail until Redis is up.
  echo.
)

REM --- Web build check ---
if not exist "%ROOT%\web\dist\index.html" (
  echo.
  echo WARNING: web\dist\index.html missing. Caddy will fail until you run:
  echo   cd web ^&^& npm run build
  echo.
)

REM --- Python for API ---
if exist "%BACKEND%\venv\Scripts\python.exe" (
  set "PY=%BACKEND%\venv\Scripts\python.exe"
) else (
  where py >nul 2>&1
  if !ERRORLEVEL!==0 (
    set "PY=py -3"
  ) else (
    set "PY=python"
  )
)

echo Starting backend API on port 8000...
if exist "%BACKEND%\venv\Scripts\python.exe" (
  start "CiVX API" cmd /k "cd /d "%BACKEND%" && "%BACKEND%\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
) else (
  start "CiVX API" cmd /k "cd /d "%BACKEND%" && %PY% -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)

echo Starting passive pipeline workers...
call "%INFRA%\run-workers.bat"

echo Starting Caddy (static web/dist on :80)...
start "CiVX Caddy" cmd /k "cd /d "%ROOT%" && "%INFRA%\run-caddy.bat"

echo Starting Cloudflare tunnel...
start "CiVX Tunnel" cmd /k "cd /d "%ROOT%" && "%INFRA%\run-tunnel.bat"

echo.
echo All hosting processes are launching in separate windows:
echo   - CiVX API
echo   - 5 passive workers (prefilter, yolo, locate, incident, review)
echo   - CiVX Caddy
echo   - CiVX Tunnel
echo.
echo Public URL: https://civx.xrnozy.me
echo Local API:  http://127.0.0.1:8000
echo.
pause
