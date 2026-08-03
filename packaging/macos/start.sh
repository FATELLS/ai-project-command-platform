#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$APP_ROOT/runtime/bin/node"
ENV_FILE="$APP_ROOT/.env.local"
CREDENTIAL_FILE="$APP_ROOT/first-run-credentials.txt"
APP_URL="http://127.0.0.1:4173"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Bundled Node.js runtime is missing: $NODE_BIN" >&2
  exit 1
fi

FIRST_RUN_PASSWORD=""
if [[ ! -f "$ENV_FILE" ]]; then
  FIRST_RUN_PASSWORD="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
  umask 077
  printf '%s\n' \
    "HOST=127.0.0.1" \
    "PORT=4173" \
    "PLATFORM_DATA_DIR=./data" \
    "PLATFORM_XUGU_LIFECYCLE=managed" \
    "XUGU_CONTAINER=ai-project-command-platform-xugu" \
    "XUGU_VOLUME=ai-project-command-platform-xugu-data" \
    "XUGU_PORT=5138" \
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
(cd "$APP_ROOT" && "$NODE_BIN" scripts/manage-server.mjs start)

echo "AI Project Command Platform started: $APP_URL"
if [[ -n "$FIRST_RUN_PASSWORD" ]]; then
  echo "Username: admin"
  echo "Password: $FIRST_RUN_PASSWORD"
  echo "Credentials were also written to: $CREDENTIAL_FILE"
fi
