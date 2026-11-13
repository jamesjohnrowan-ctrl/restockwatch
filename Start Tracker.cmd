@echo off
setlocal
cd /d "%~dp0"
call "%~dp0Find Node.cmd"
if errorlevel 1 (
 echo Node.js 22 or newer is required. Install it from https://nodejs.org
 pause
 exit /b 1
)
start "" http://127.0.0.1:4317
"%TRACKER_NODE%" server.mjs
pause
