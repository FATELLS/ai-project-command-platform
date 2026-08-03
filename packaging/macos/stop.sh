#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$APP_ROOT/runtime/bin/node"
(cd "$APP_ROOT" && "$NODE_BIN" scripts/manage-server.mjs stop)
