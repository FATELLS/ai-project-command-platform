#!/usr/bin/env bash
# install.sh — 一行安装 AI Project Command Platform
#
# 用法（Linux / macOS）：
#   curl -fsSL https://github.com/FATELLS/ai-project-command-platform/releases/latest/download/install.sh | bash
#
# 或指定版本：
#   curl -fsSL .../download/v1.0.0/install.sh | bash

set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────
REPO="FATELLS/ai-project-command-platform"
GITHUB_BASE="https://github.com/${REPO}/releases"
INSTALL_DIR="${1:-./ai-project-command-platform}"  # 默认安装到当前目录下

# ── 颜色输出 ──────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; CYAN=''; BOLD=''; NC=''
fi

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "${CYAN}${BOLD}▶ $*${NC}"; }

# ── 检测平台 ──────────────────────────────────────────────────────
detect_platform() {
  local os arch

  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux)
      case "$arch" in
        aarch64|arm64) echo "linux-arm64" ;;
        x86_64|amd64)  echo "linux-x86_64" ;;
        *) error "不支持的架构: $arch" ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        arm64)  echo "macos-arm64" ;;
        x86_64) echo "macos-x86_64" ;;
        *) error "不支持的架构: $arch" ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*)
      error "检测到 Windows，请使用 PowerShell 安装命令:\n  irm https://github.com/${REPO}/releases/latest/download/install.ps1 | iex"
      ;;
    *) error "不支持的操作系统: $os" ;;
  esac
}

# ── 获取最新版本号 ────────────────────────────────────────────────
get_latest_version() {
  # 尝试 GitHub API，失败则用 "latest"
  local version
  version="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -oP '"tag_name"\s*:\s*"\K[^"]*' || true)"
  echo "${version:-latest}"
}

# ── 检查依赖 ──────────────────────────────────────────────────────
check_deps() {
  local missing=()

  command -v curl &>/dev/null || missing+=("curl")
  command -v tar &>/dev/null  || missing+=("tar")

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "缺少必要工具: ${missing[*]}\n请先安装后重试。"
  fi
}

# ── 主流程 ────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   AI Project Command Platform 安装程序      ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo ""

  check_deps

  # 检测平台
  step "检测平台..."
  local platform
  platform="$(detect_platform)"
  info "平台: $platform"

  # 获取版本
  step "获取最新版本..."
  local version
  version="$(get_latest_version)"
  info "版本: ${version}"
  echo ""

  # 确定下载 URL
  local version_path
  if [[ "$version" == "latest" ]]; then
    version_path="latest/download"
  else
    version_path="download/${version}"
  fi

  # 根据平台选择包文件名
  local package_name
  case "$platform" in
    linux-arm64)
      # 从 package.json 读版本号需要 Node，这里用通配匹配
      package_name="ai-project-command-platform-linux-arm64.tar.gz"
      ;;
    linux-x86_64)
      package_name="ai-project-command-platform-linux-x86_64.tar.gz"
      ;;
    macos-arm64)
      package_name="ai-project-command-platform-macos-arm64.tar.gz"
      ;;
    macos-x86_64)
      package_name="ai-project-command-platform-macos-x86_64.tar.gz"
      ;;
  esac

  local download_url="${GITHUB_BASE}/${version_path}/${package_name}"

  # 下载
  step "下载 ${package_name}..."
  info "URL: ${download_url}"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  if ! curl -fSL --progress-bar -o "${tmp_dir}/${package_name}" "$download_url"; then
    error "下载失败。请检查网络或版本号。\nURL: ${download_url}"
  fi

  info "下载完成 ($(du -h "${tmp_dir}/${package_name}" | cut -f1))"
  echo ""

  # 解压
  step "解压到 ${INSTALL_DIR}..."

  # 如果 INSTALL_DIR 是相对路径，转成绝对路径
  case "$INSTALL_DIR" in
    /*) : ;;  # 已经是绝对路径
    *)  INSTALL_DIR="$(pwd)/${INSTALL_DIR}" ;;
  esac

  mkdir -p "$INSTALL_DIR"
  tar -xzf "${tmp_dir}/${package_name}" -C "$INSTALL_DIR" --strip-components=1

  info "解压完成"
  echo ""

  # 设置权限
  chmod +x "$INSTALL_DIR/start.sh" "$INSTALL_DIR/stop.sh" 2>/dev/null || true
  chmod +x "$INSTALL_DIR/runtime/bin/node" 2>/dev/null || true
  chmod +x "$INSTALL_DIR/scripts/bootstrap-runtime.sh" 2>/dev/null || true
  chmod +x "$INSTALL_DIR/scripts/manage-server.mjs" 2>/dev/null || true

  # 启动
  step "启动平台..."
  cd "$INSTALL_DIR"

  # 自动设置 lifecycle 和容器运行时
  case "$platform" in
    linux-*)
      export PLATFORM_XUGU_LIFECYCLE="${PLATFORM_XUGU_LIFECYCLE:-native}"
      info "Linux native 模式：虚谷直接以进程运行，不需要容器"
      ;;
    macos-*)
      export PLATFORM_XUGU_LIFECYCLE="${PLATFORM_XUGU_LIFECYCLE:-managed}"
      info "macOS 容器模式：bootstrap 将自动检测/安装 Colima"
      ;;
  esac

  echo ""
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  安装完成！正在启动...${NC}"
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
  echo ""

  bash start.sh
}

main "$@"
