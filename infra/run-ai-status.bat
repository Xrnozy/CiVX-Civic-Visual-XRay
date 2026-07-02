@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "INFRA=%ROOT%\infra"

echo.
echo === CiVX AI pipeline status ===
echo.

docker ps --filter name=civx-redis --filter status=running --format "{{.Names}}" 2>nul | findstr /i civx-redis >nul
if !ERRORLEVEL!==0 (
  echo [Redis] civx-redis container running
) else (
  echo [Redis] NOT running — run infra\run-redis.bat
)

if exist "%BACKEND%\venv\Scripts\python.exe" (
  set "PY=%BACKEND%\venv\Scripts\python.exe"
) else (
  where py >nul 2>&1
  if !ERRORLEVEL!==0 (set "PY=py -3.11") else (set "PY=python")
)

echo.
echo [Worker windows]
tasklist /FI "WINDOWTITLE eq CiVX Prefilter*" 2>nul | findstr /i cmd >nul && echo   Prefilter: window open || echo   Prefilter: not found
tasklist /FI "WINDOWTITLE eq CiVX YOLO*" 2>nul | findstr /i cmd >nul && echo   YOLO:      window open || echo   YOLO:      not found
tasklist /FI "WINDOWTITLE eq CiVX Locate*" 2>nul | findstr /i cmd >nul && echo   Locate:    window open || echo   Locate:    not found
tasklist /FI "WINDOWTITLE eq CiVX Incident*" 2>nul | findstr /i cmd >nul && echo   Incident:  window open || echo   Incident:  not found
tasklist /FI "WINDOWTITLE eq CiVX Review*" 2>nul | findstr /i cmd >nul && echo   Review:    window open || echo   Review:    not found

echo.
echo [API pipeline-status]
set "FETCHED=0"
for %%U in (
  "http://127.0.0.1:8000/api/system/pipeline-status"
  "http://localhost:8000/api/system/pipeline-status"
  "http://localhost/api/system/pipeline-status"
  "https://civx.xrnozy.me/api/system/pipeline-status"
) do (
  if "!FETCHED!"=="0" (
    set "API_URL=%%~U"
    echo Trying !API_URL! ...
    %PY% "%INFRA%\_fetch_pipeline_status.py" "!API_URL!" 2>nul
    if !ERRORLEVEL!==0 set "FETCHED=1"
  )
)

if "!FETCHED!"=="0" (
  echo.
  echo Could not reach pipeline-status on any URL.
  echo   1. Restart the API so it loads the latest code:
  echo        cd backend ^&^& python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  echo   2. Or run infra\run-hosting.bat
  echo   3. Then open: http://127.0.0.1:8000/api/system/pipeline-status
  echo      or:      https://civx.xrnozy.me/api/system/pipeline-status
)

echo.
pause
