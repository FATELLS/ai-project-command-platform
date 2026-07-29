#!/usr/bin/env bash
# 前端 E2E 测试运行脚本
# 用法：./scripts/run-e2e.sh [grep pattern]
# 示例：./scripts/run-e2e.sh "05 材料管理"

set -e

PROJECT_DIR="/Users/mingyuzhuo/Documents/AI Project Command Platform"
NODE_BIN="/Users/mingyuzhuo/.workbuddy/binaries/node/versions/22.22.2/bin/node"
NPX_BIN="/Users/mingyuzhuo/.workbuddy/binaries/node/versions/22.22.2/bin/npx"
NODE_PATH="/Users/mingyuzhuo/.workbuddy/binaries/node/workspace/node_modules"

cd "$PROJECT_DIR"

# 检查服务器是否运行
if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4173/login | grep -q "200"; then
  echo "⚠️  服务器未启动，正在启动..."
  PORT=4173 "$NODE_BIN" --env-file-if-exists=.env --env-file-if-exists=.env.local server.mjs &
  SERVER_PID=$!
  echo "等待服务器启动..."
  sleep 5
  trap "kill $SERVER_PID 2>/dev/null" EXIT
fi

# 运行测试
GREP="$1"
if [ -n "$GREP" ]; then
  echo "▶ 运行匹配 \"$GREP\" 的测试..."
  NODE_PATH="$NODE_PATH" "$NPX_BIN" playwright test --config=playwright.config.mjs -g "$GREP"
else
  echo "▶ 运行全部前端 E2E 测试..."
  NODE_PATH="$NODE_PATH" "$NPX_BIN" playwright test --config=playwright.config.mjs
fi

echo ""
echo "📊 HTML 报告：e2e-report/index.html"
echo "📸 失败截图：test-results/"
