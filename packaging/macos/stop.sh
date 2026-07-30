#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_ROOT/server.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "AI Project Command Platform is not running."
  exit 0
fi

SERVER_PID="$(tr -d '[:space:]' < "$PID_FILE")"
if [[ -n "$SERVER_PID" ]]; then
  kill "$SERVER_PID" 2>/dev/null || true
fi
rm -f "$PID_FILE"
echo "AI Project Command Platform stopped."
