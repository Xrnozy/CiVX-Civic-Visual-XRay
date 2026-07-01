@echo off
setlocal EnableDelayedExpansion

where docker >nul 2>&1
if !ERRORLEVEL! neq 0 (
  echo ERROR: Docker not found. Install Docker Desktop or start Redis manually on port 6379.
  exit /b 1
)

docker info >nul 2>&1
if !ERRORLEVEL! neq 0 (
  echo ERROR: Docker is installed but not running. Start Docker Desktop, then retry.
  exit /b 1
)

docker start civx-redis >nul 2>&1
if !ERRORLEVEL! neq 0 (
  echo Creating Redis container civx-redis...
  docker run -d --name civx-redis -p 6379:6379 redis:7-alpine
  if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to start Redis. Check: docker ps -a --filter name=civx-redis
    exit /b 1
  )
)

docker ps --filter name=civx-redis --filter status=running --format "{{.Names}}" | findstr /i civx-redis >nul
if !ERRORLEVEL! neq 0 (
  echo ERROR: civx-redis is not running.
  exit /b 1
)

echo Redis ready at redis://127.0.0.1:6379
exit /b 0
