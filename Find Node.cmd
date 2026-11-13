@echo off
set "TRACKER_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined TRACKER_NODE set "TRACKER_NODE=%%N"
if not defined TRACKER_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "TRACKER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined TRACKER_NODE exit /b 1
"%TRACKER_NODE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0
