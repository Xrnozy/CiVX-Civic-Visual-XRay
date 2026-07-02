@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "INFRA=%ROOT%\infra"
set "LOGS=%ROOT%\logs\workers"

echo.
echo === CiVX AI passive pipeline ===
echo Repo: %ROOT%
echo.

if not exist "%BACKEND%\workers\prefilter_worker.py" (
  echo ERROR: backend workers not found at %BACKEND%
  exit /b 1
)

if exist "%BACKEND%\venv\Scripts\python.exe" (
  set "PY=%BACKEND%\venv\Scripts\python.exe"
) else (
  where py >nul 2>&1
  if !ERRORLEVEL!==0 (
    set "PY=py -3.11"
  ) else (
    set "PY=python"
  )
)
echo Python: %PY%

REM --- Redis ---
call "%INFRA%\run-redis.bat"
if errorlevel 1 (
  echo ERROR: Redis is required on port 6379.
  pause
  exit /b 1
)

REM --- Redis ping via Python ---
%PY% -c "import redis; r=redis.Redis.from_url('redis://127.0.0.1:6379/0'); r.ping(); print('Redis PING ok')" 2>nul
if errorlevel 1 (
  echo ERROR: Redis ping failed.
  pause
  exit /b 1
)

REM --- Optional GPU check ---
where nvidia-smi >nul 2>&1
if !ERRORLEVEL!==0 (
  echo GPU:
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>nul
) else (
  echo WARNING: nvidia-smi not found. YOLO/Locate will use CPU if CUDA unavailable.
)

if not exist "%LOGS%" mkdir "%LOGS%"

echo.
echo Starting 5 workers (logs in %LOGS%)...
echo.

call :start_worker "CiVX Prefilter" workers.prefilter_worker prefilter.log
call :start_worker "CiVX YOLO" workers.yolo_worker yolo.log
call :start_worker "CiVX Locate" workers.locate_worker locate.log
call :start_worker "CiVX Incident" workers.incident_worker incident.log
call :start_worker "CiVX Review" workers.review_worker review.log

echo.
echo Started 5 workers + Redis.
echo   Status:  infra\run-ai-status.bat
echo   Stop:    infra\run-ai-stop.bat
echo   API:     http://127.0.0.1:8000/api/system/pipeline-status
echo.
echo YOLO loads in CiVX YOLO window; LocateAnything loads in CiVX Locate window.
echo.
exit /b 0

:start_worker
set "TITLE=%~1"
set "MODULE=%~2"
set "LOGFILE=%~3"
if exist "%BACKEND%\venv\Scripts\python.exe" (
  start "%TITLE%" /MIN cmd /k "cd /d "%BACKEND%" && "%BACKEND%\venv\Scripts\python.exe" -m %MODULE% 1>>"%LOGS%\%LOGFILE%" 2>&1"
) else (
  start "%TITLE%" /MIN cmd /k "cd /d "%BACKEND%" && %PY% -m %MODULE% 1>>"%LOGS%\%LOGFILE%" 2>&1"
)
exit /b 0
