@echo off
setlocal
title WaveSpeed Studio Desktop (Live Repo)
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist "%~dp0node_modules\.bin\electron.cmd" (
  echo [INFO] Installing Electron dev dependencies once...
  call npm install
)
call "%~dp0node_modules\.bin\electron.cmd" "%~dp0"
endlocal
