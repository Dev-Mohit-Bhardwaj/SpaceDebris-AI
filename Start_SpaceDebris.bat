@echo off
title Space Debris Simulation Launcher
color 0B

echo ===================================================
echo     SPACE DEBRIS AI - INITIALIZE DATALINK
echo ===================================================
echo.
echo Starting Python Backend Server...
start "Backend API" cmd /c "cd /d %~dp0\backend && .venv\Scripts\activate && python main.py"

echo Starting React WebGL Frontend...
start "Frontend UI" cmd /c "cd /d %~dp0\frontend && npm run dev"

echo.
echo Servers are booting up! Please wait a few seconds...
timeout /t 3 >nobreak

echo Launching Dashboard in default browser...
start http://localhost:5173/

echo.
echo Done! You can safely close this launcher window.
echo (The servers will keep running in their own minimized windows)
timeout /t 5 >nobreak
