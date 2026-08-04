@echo off
setlocal enabledelayedexpansion

set APP_ROOT=%~dp0
set APP_ROOT=%APP_ROOT:~0,-1%
set NODE_BIN=%APP_ROOT%\runtime\bin\node.exe
set ENV_FILE=%APP_ROOT%\.env.local
set CREDENTIAL_FILE=%APP_ROOT%\first-run-credentials.txt

if not exist "%NODE_BIN%" (
  echo Bundled Node.js runtime is missing: %NODE_BIN% >&2
  exit /b 1
)

REM ---- 首次运行生成 .env.local ----
set FIRST_RUN_PASSWORD=
if not exist "%ENV_FILE%" (
  REM 生成随机密码
  powershell -Command "$bytes = New-Object byte[] 18; [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes); ($bytes | ForEach-Object { '{0:x2}' -f $_ }) -join ''" > "%TEMP%\_xugu_pwd.txt"
  set /p FIRST_RUN_PASSWORD=<"%TEMP%\_xugu_pwd.txt"
  del "%TEMP%\_xugu_pwd.txt" 2>nul

  (
    echo HOST=127.0.0.1
    echo PORT=4173
    echo PLATFORM_DATA_DIR=./data
    echo PLATFORM_XUGU_LIFECYCLE=native
    echo XUGU_PORT=5138
    echo PLATFORM_BOOTSTRAP_USERNAME=admin
    echo PLATFORM_BOOTSTRAP_DISPLAY_NAME=平台管理员
    echo PLATFORM_BOOTSTRAP_PASSWORD=!FIRST_RUN_PASSWORD!
    echo PLATFORM_COOKIE_SECURE=false
    echo AI_CHAT_PROVIDER=disabled
    echo AI_GENERATION_PROVIDER=disabled
  ) > "%ENV_FILE%"

  (
    echo AI Project Command Platform
    echo URL: http://127.0.0.1:4173
    echo Username: admin
    echo Password: !FIRST_RUN_PASSWORD!
    echo.
    echo 请在首次登录后立即修改密码，并妥善删除本文件。
  ) > "%CREDENTIAL_FILE%"
)

REM ---- Windows native 模式不需要容器 ----
REM 虚谷 Windows 服务端直接以进程方式运行
REM 将虚谷 BIN 目录加入 PATH，确保 Node.js 驱动能找到 libcrypto-1_1-x64.dll
set XUGU_BIN_DIR=%APP_ROOT%\vendor\xugudb\server\windows\amd64\XuguDB\Server\BIN
if exist "%XUGU_BIN_DIR%" set PATH=%XUGU_BIN_DIR%;%PATH%

if not exist "%APP_ROOT%\data" mkdir "%APP_ROOT%\data"

cd /d "%APP_ROOT%"
"%NODE_BIN%" scripts\manage-server.mjs start

echo AI Project Command Platform started: http://127.0.0.1:4173
if defined FIRST_RUN_PASSWORD (
  echo Username: admin
  echo Password: !FIRST_RUN_PASSWORD!
  echo Credentials were also written to: %CREDENTIAL_FILE%
)

endlocal
