@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"

if not exist "%BACKEND%\workers\prefilter_worker.py" (
  echo ERROR: backend workers not found at %BACKEND%
  exit /b 1
)

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

echo.
echo === CiVX passive pipeline workers ===
echo Repo:    %ROOT%
echo Python:  %PY%
echo.

call "%~dp0run-redis.bat"
if errorlevel 1 (
  echo Workers need Redis on port 6379. Fix the error above and retry.
  pause
  exit /b 1
)
echo.

echo Each worker opens in its own terminal window.
echo.

call :start_worker "CiVX Prefilter" workers.prefilter_worker
call :start_worker "CiVX YOLO" workers.yolo_worker
call :start_worker "CiVX Locate" workers.locate_worker
call :start_worker "CiVX Incident" workers.incident_worker
call :start_worker "CiVX Review" workers.review_worker

echo Started 5 workers.
exit /b 0

:start_worker
set "TITLE=%~1"
set "MODULE=%~2"
if exist "%BACKEND%\venv\Scripts\python.exe" (
  start "%TITLE%" cmd /k "cd /d "%BACKEND%" && "%BACKEND%\venv\Scripts\python.exe" -m %MODULE%"
) else (
  start "%TITLE%" cmd /k "cd /d "%BACKEND%" && %PY% -m %MODULE%"
)
exit /b 0
