#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$APP_ROOT/runtime/bin/node"
ENV_FILE="$APP_ROOT/.env.local"
CREDENTIAL_FILE="$APP_ROOT/first-run-credentials.txt"
PID_FILE="$APP_ROOT/server.pid"
APP_URL="http://127.0.0.1:4173"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Bundled Node.js runtime is missing: $NODE_BIN" >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  SERVER_PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "AI Project Command Platform is already running at $APP_URL"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

FIRST_RUN_PASSWORD=""
if [[ ! -f "$ENV_FILE" ]]; then
  FIRST_RUN_PASSWORD="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
  umask 077
  printf '%s\n' \
    "HOST=127.0.0.1" \
    "PORT=4173" \
    "PLATFORM_DATA_DIR=./data" \
    "PLATFORM_BOOTSTRAP_USERNAME=admin" \
    "PLATFORM_BOOTSTRAP_DISPLAY_NAME=平台管理员" \
    "PLATFORM_BOOTSTRAP_PASSWORD=$FIRST_RUN_PASSWORD" \
    "PLATFORM_COOKIE_SECURE=false" \
    "AI_CHAT_PROVIDER=disabled" \
    "AI_GENERATION_PROVIDER=disabled" > "$ENV_FILE"
  printf '%s\n' \
    "AI Project Command Platform" \
    "URL: $APP_URL" \
    "Username: admin" \
    "Password: $FIRST_RUN_PASSWORD" \
    "" \
    "请在首次登录后立即修改密码，并妥善删除本文件。" > "$CREDENTIAL_FILE"
fi

mkdir -p "$APP_ROOT/data"
(
  cd "$APP_ROOT"
  nohup "$NODE_BIN" --env-file-if-exists=.env --env-file-if-exists=.env.local server.mjs > app.log 2>&1 &
  echo "$!" > "$PID_FILE"
)
SERVER_PID="$(tr -d '[:space:]' < "$PID_FILE")"

READY=0
for _ in $(seq 1 40); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited during startup. See $APP_ROOT/app.log" >&2
    rm -f "$PID_FILE"
    exit 1
  fi
  if "$NODE_BIN" -e "fetch('$APP_URL/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "$READY" != "1" ]]; then
  kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Server did not become ready at $APP_URL" >&2
  exit 1
fi

echo "AI Project Command Platform started: $APP_URL"
if [[ -n "$FIRST_RUN_PASSWORD" ]]; then
  echo "Username: admin"
  echo "Password: $FIRST_RUN_PASSWORD"
  echo "Credentials were also written to: $CREDENTIAL_FILE"
fi
