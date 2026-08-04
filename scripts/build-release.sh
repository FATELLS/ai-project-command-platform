#!/usr/bin/env bash
# ============================================================
# build-release.sh — 多平台 Release 打包脚本
#
# 功能:
#   按平台组装发布包，只包含该平台需要的文件（减小体积）
#
# 用法:
#   bash scripts/build-release.sh <platform> [--runtime <dir>] [--output <dir>]
#
# 平台:
#   linux-arm64      Linux ARM64（含虚谷 native 二进制 + Node ARM64 runtime）
#   linux-x86_64     Linux x86_64（含虚谷 native 二进制 + Node x86_64 runtime）
#   windows-amd64    Windows AMD64（含虚谷 native 二进制 + Node Windows runtime）
#   macos-arm64      macOS ARM64（容器模式，含 Docker 镜像 + Node macOS runtime）
#
# 产物:
#   dist/ai-project-command-platform-<version>-<platform>.tar.gz (or .zip)
# ============================================================
set -euo pipefail

PLATFORM=""
RUNTIME_DIR=""
OUTPUT_DIR="dist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- 参数解析 ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    linux-arm64|linux-x86_64|windows-amd64|macos-arm64)
      PLATFORM="$1"; shift ;;
    --runtime)    RUNTIME_DIR="$2"; shift 2 ;;
    --output)     OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "用法: build-release.sh <platform> [--runtime <dir>] [--output <dir>]"
      echo ""
      echo "平台: linux-arm64 | linux-x86_64 | windows-amd64 | macos-arm64"
      exit 0
      ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PLATFORM" ]]; then
  echo "错误: 必须指定平台" >&2
  echo "用法: build-release.sh <platform>" >&2
  exit 1
fi

# ---- 辅助函数 ----
log()  { printf '\033[36m[build]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[build] ✓\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[build] ✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---- 读取版本号 ----
VERSION="$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')"
if [[ -z "$VERSION" ]]; then
  VERSION="1.0.0"
fi

PKG_NAME="ai-project-command-platform-${VERSION}-${PLATFORM}"
STAGING_DIR="$PROJECT_ROOT/$OUTPUT_DIR/$PKG_NAME"
ARCHIVE_DIR="$PROJECT_ROOT/$OUTPUT_DIR"

log "构建 $PLATFORM 包 (版本 $VERSION)"

# ---- 清理 staging ----
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# ---- 拷贝通用文件 ----
log "拷贝应用代码..."
cp "$PROJECT_ROOT/server.mjs" "$STAGING_DIR/"
cp "$PROJECT_ROOT/package.json" "$STAGING_DIR/"
cp "$PROJECT_ROOT/package-lock.json" "$STAGING_DIR/" 2>/dev/null || true
cp "$PROJECT_ROOT/README.md" "$STAGING_DIR/"
cp "$PROJECT_ROOT/.env.example" "$STAGING_DIR/" 2>/dev/null || true
cp -r "$PROJECT_ROOT/src" "$STAGING_DIR/"
cp -r "$PROJECT_ROOT/public" "$STAGING_DIR/"
mkdir -p "$STAGING_DIR/scripts"
cp "$PROJECT_ROOT/scripts/manage-server.mjs" "$STAGING_DIR/scripts/"
cp "$PROJECT_ROOT/scripts/bootstrap-runtime.sh" "$STAGING_DIR/scripts/"
chmod +x "$STAGING_DIR/scripts/bootstrap-runtime.sh"

mkdir -p "$STAGING_DIR/data"

# ---- 按平台拷贝 vendor 和启动脚本 ----
mkdir -p "$STAGING_DIR/vendor/xugudb/nodejs"

case "$PLATFORM" in
  linux-arm64)
    # 虚谷 native 二进制
    mkdir -p "$STAGING_DIR/vendor/xugudb/server/linux/aarch64"
    cp -r "$PROJECT_ROOT/vendor/xugudb/server/linux/aarch64/"* "$STAGING_DIR/vendor/xugudb/server/linux/aarch64/"
    # Docker 镜像（fallback 用）
    mkdir -p "$STAGING_DIR/vendor/xugudb/image"
    cp "$PROJECT_ROOT/vendor/xugudb/image/manifest.json" "$STAGING_DIR/vendor/xugudb/image/"
    cp "$PROJECT_ROOT/vendor/xugudb/image/xugudb-12.10.13-arm64.tar.gz" "$STAGING_DIR/vendor/xugudb/image/" 2>/dev/null || true
    # 原生驱动
    cp "$PROJECT_ROOT/vendor/xugudb/nodejs/xugudbjs-darwin-arm64.node" "$STAGING_DIR/vendor/xugudb/nodejs/" 2>/dev/null || true
    cp "$PROJECT_ROOT/vendor/xugudb/nodejs/xugudbjs-linux-arm64.node" "$STAGING_DIR/vendor/xugudb/nodejs/" 2>/dev/null || true
    # 启动脚本
    cp "$PROJECT_ROOT/packaging/linux/start.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/linux/stop.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/linux/README-LINUX.txt" "$STAGING_DIR/" 2>/dev/null || true
    chmod +x "$STAGING_DIR/start.sh" "$STAGING_DIR/stop.sh"
    ;;

  linux-x86_64)
    mkdir -p "$STAGING_DIR/vendor/xugudb/server/linux/x86_64"
    cp -r "$PROJECT_ROOT/vendor/xugudb/server/linux/x86_64/"* "$STAGING_DIR/vendor/xugudb/server/linux/x86_64/"
    mkdir -p "$STAGING_DIR/vendor/xugudb/image"
    cp "$PROJECT_ROOT/vendor/xugudb/image/manifest.json" "$STAGING_DIR/vendor/xugudb/image/"
    cp "$PROJECT_ROOT/vendor/xugudb/image/xugudb-12.10.13-amd64.tar.gz" "$STAGING_DIR/vendor/xugudb/image/" 2>/dev/null || true
    cp "$PROJECT_ROOT/vendor/xugudb/nodejs/xugudbjs-linux-x86_64.node" "$STAGING_DIR/vendor/xugudb/nodejs/" 2>/dev/null || true
    cp "$PROJECT_ROOT/packaging/linux/start.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/linux/stop.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/linux/README-LINUX.txt" "$STAGING_DIR/" 2>/dev/null || true
    chmod +x "$STAGING_DIR/start.sh" "$STAGING_DIR/stop.sh"
    ;;

  windows-amd64)
    mkdir -p "$STAGING_DIR/vendor/xugudb/server/windows/amd64"
    cp -r "$PROJECT_ROOT/vendor/xugudb/server/windows/amd64/"* "$STAGING_DIR/vendor/xugudb/server/windows/amd64/"
    mkdir -p "$STAGING_DIR/vendor/xugudb/image"
    cp "$PROJECT_ROOT/vendor/xugudb/image/manifest.json" "$STAGING_DIR/vendor/xugudb/image/"
    cp "$PROJECT_ROOT/vendor/xugudb/nodejs/xugudbjs-win32-x64.node" "$STAGING_DIR/vendor/xugudb/nodejs/" 2>/dev/null || true
    # Windows 启动脚本
    cp "$PROJECT_ROOT/packaging/windows/start.bat" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/windows/stop.bat" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/windows/README-WINDOWS.txt" "$STAGING_DIR/" 2>/dev/null || true
    ;;

  macos-arm64)
    # macOS 用容器模式，不需要 native server 二进制
    mkdir -p "$STAGING_DIR/vendor/xugudb/image"
    cp "$PROJECT_ROOT/vendor/xugudb/image/manifest.json" "$STAGING_DIR/vendor/xugudb/image/"
    cp "$PROJECT_ROOT/vendor/xugudb/image/xugudb-12.10.13-arm64.tar.gz" "$STAGING_DIR/vendor/xugudb/image/" 2>/dev/null || true
    cp "$PROJECT_ROOT/vendor/xugudb/nodejs/xugudbjs-darwin-arm64.node" "$STAGING_DIR/vendor/xugudb/nodejs/" 2>/dev/null || true
    cp "$PROJECT_ROOT/packaging/macos/start.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/macos/stop.sh" "$STAGING_DIR/"
    cp "$PROJECT_ROOT/packaging/macos/README-MACOS.txt" "$STAGING_DIR/" 2>/dev/null || true
    chmod +x "$STAGING_DIR/start.sh" "$STAGING_DIR/stop.sh"
    ;;
esac

# ---- 拷贝 Node.js runtime ----
if [[ -n "$RUNTIME_DIR" && -d "$RUNTIME_DIR" ]]; then
  log "拷贝 Node.js runtime..."
  cp -r "$RUNTIME_DIR" "$STAGING_DIR/runtime"
  if [[ "$PLATFORM" != "windows-amd64" ]]; then
    chmod +x "$STAGING_DIR/runtime/bin/node" 2>/dev/null || true
  fi
else
  log "未提供 --runtime，使用系统 Node.js"
  # 创建 runtime 软链接到系统 node
  mkdir -p "$STAGING_DIR/runtime/bin"
  SYS_NODE="$(command -v node || true)"
  if [[ -n "$SYS_NODE" ]]; then
    ln -sf "$SYS_NODE" "$STAGING_DIR/runtime/bin/node"
  fi
fi

# ---- 安装生产依赖 ----
log "安装生产依赖..."
cd "$STAGING_DIR"
if command -v npm &>/dev/null; then
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund 2>/dev/null || {
    log "npm ci 失败，尝试 npm install..."
    npm install --omit=dev --ignore-scripts --no-audit --no-fund 2>/dev/null || true
  }
fi

# ---- 安全审计：确保不含敏感文件 ----
log "安全审计..."
FORBIDDEN=(".env.local" ".planning" "fixtures" "test" "test-results" "playwright-report" "first-run-credentials.txt" "bootstrap-credentials.txt" ".api-keys.local.json" "uploads" "processed" "backups" "diagnostics" "exports")
for item in "${FORBIDDEN[@]}"; do
  if find "$STAGING_DIR" -name "$item" -maxdepth 3 2>/dev/null | grep -q .; then
    fail "发布包包含禁止的文件/目录: $item"
  fi
done
ok "安全审计通过"

# ---- 打包 ----
cd "$ARCHIVE_DIR"
log "打包..."
if [[ "$PLATFORM" == "windows-amd64" ]]; then
  zip -q -r "${PKG_NAME}.zip" "$PKG_NAME"
  ARCHIVE_FILE="${ARCHIVE_DIR}/${PKG_NAME}.zip"
else
  tar -czf "${PKG_NAME}.tar.gz" "$PKG_NAME"
  ARCHIVE_FILE="${ARCHIVE_DIR}/${PKG_NAME}.tar.gz"
fi

# ---- 摘要 ----
SIZE="$(du -h "$ARCHIVE_FILE" | cut -f1)"
FILE_COUNT="$(find "$STAGING_DIR" -type f | wc -l | tr -d ' ')"

ok "构建完成"
echo ""
echo "  产物:     $ARCHIVE_FILE"
echo "  大小:     $SIZE"
echo "  文件数:   $FILE_COUNT"
echo "  目录:     $STAGING_DIR"
echo ""

# ---- 清理 staging（保留归档） ----
rm -rf "$STAGING_DIR"
