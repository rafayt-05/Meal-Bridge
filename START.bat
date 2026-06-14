@echo off
REM ============================================================
REM  MealBridge — one-click launcher for Windows
REM  Installs dependencies on first run, then starts the server.
REM ============================================================

setlocal
cd /d "%~dp0server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Install it from https://nodejs.org/ ^(LTS version^) and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  First-time setup — installing backend dependencies...
  echo  ^(this only happens once and takes about 30 seconds^)
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  npm install failed. See the messages above.
    pause
    exit /b 1
  )
)

echo.
echo  Starting MealBridge...
echo  Once it boots, open  http://localhost:4000/  in your browser.
echo  Press Ctrl+C in this window to stop the server.
echo.

call npm start
