@echo off
setlocal EnableDelayedExpansion
echo.
echo === Stopping CiVX AI workers ===
echo.

for %%T in ("CiVX Prefilter" "CiVX YOLO" "CiVX Locate" "CiVX Incident" "CiVX Review") do (
  taskkill /FI "WINDOWTITLE eq %%T*" /F >nul 2>&1
  if !ERRORLEVEL!==0 (
    echo Stopped %%~T
  ) else (
    echo %%~T — not running
  )
)

echo.
echo Worker windows closed. Redis container civx-redis is left running.
echo To stop Redis: docker stop civx-redis
echo.
pause
