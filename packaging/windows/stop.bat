@echo off
setlocal

set APP_ROOT=%~dp0
set APP_ROOT=%APP_ROOT:~0,-1%
set NODE_BIN=%APP_ROOT%\runtime\bin\node.exe

if not exist "%NODE_BIN%" (
  echo Bundled Node.js runtime is missing: %NODE_BIN% >&2
  exit /b 1
)

cd /d "%APP_ROOT%"
"%NODE_BIN%" scripts\manage-server.mjs stop

endlocal
