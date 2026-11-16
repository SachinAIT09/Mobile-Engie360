@echo off
REM ENGIE360 demo - double-click to install, build and start everything on http://localhost:3000
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)
echo.
echo [1/3] Installing packages (the first time takes a few minutes)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
echo.
echo [2/3] Building the apps...
call npm run build
if errorlevel 1 goto :fail
echo.
echo [3/3] Starting the demo. Your browser opens the start page shortly:
echo        http://localhost:3000
echo        Keep this window open while you use the demo. Close it to stop.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm start
goto :eof
:fail
echo.
echo Something went wrong. Copy the messages above and send them to Claude.
pause
