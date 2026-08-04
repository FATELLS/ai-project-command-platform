#!/usr/bin/env bash
# ============================================================
# bootstrap-runtime.sh
#
# 全新环境一键准备运行时依赖。
#
# 策略:
#   Linux:   优先 native 模式（直接跑虚谷二进制，零容器）；
#            如有 Docker 镜像且用户选 managed，则安装 podman。
#   Windows: native 模式（直接跑 xugu_server.exe，零容器）。
#   macOS:   必须用容器 VM（虚谷无 macOS 版），自动检测/安装 Colima。
#
# 输出: 将 PLATFORM_XUGU_LIFECYCLE 和 CONTAINER_CLI 写入 .env.local
# 退出码: 0=成功, 1=失败
# ============================================================
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_ROOT/.env.local"
VENDOR_SERVER="$APP_ROOT/vendor/xugudb/server"

# ---- 辅助函数 ----

log()  { printf '[bootstrap] %s\n' "$*" >&2; }
ok()   { printf '[bootstrap] OK: %s\n' "$*" >&2; }
fail() { printf '[bootstrap] FAIL: %s\n' "$*" >&2; exit 1; }

# 检测是否有虚谷原生服务端二进制
has_native_binary() {
  local os_type arch_type bin_path
  os_type="$(uname -s)"
  arch_type="$(uname -m)"

  case "$os_type" in
    Linux)
      case "$arch_type" in
        aarch64|arm64) arch_type="aarch64" ;;
        x86_64|amd64)  arch_type="x86_64" ;;
        *) return 1 ;;
      esac
      bin_path="$VENDOR_SERVER/linux/$arch_type/XuguDB/Server/BIN"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      bin_path="$VENDOR_SERVER/windows/amd64/XuguDB/Server/BIN"
      ;;
    *)
      return 1
      ;;
  esac

  # 检查目录下是否有 xugu_* 二进制
  if [[ -d "$bin_path" ]]; then
    if ls "$bin_path"/xugu_* >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

# 安装 Linux 虚谷原生运行依赖（libaio, libssl1.1）
install_linux_deps() {
  log "检测虚谷原生依赖..."
  if command -v apt-get &>/dev/null; then
    # Debian/Ubuntu: libaio1 (bullseye) or libaio1t64 (bookworm+)
    if ! ldconfig -p 2>/dev/null | grep -q libaio; then
      log "安装 libaio..."
      sudo apt-get update -qq 2>/dev/null
      sudo apt-get install -y -qq libaio1 2>/dev/null || sudo apt-get install -y -qq libaio1t64 2>/dev/null || true
      # Ubuntu 24.04 t64 transition: symlink libaio.so.1t64 → libaio.so.1
      arch_lib_dir=$(ldconfig -C 2>/dev/null; dpkg-architecture -qDEB_HOST_MULTIARCH 2>/dev/null || echo "aarch64-linux-gnu")
      for libdir in /usr/lib/$arch_lib_dir /usr/lib/aarch64-linux-gnu /usr/lib/x86_64-linux-gnu; do
        if [[ -f "$libdir/libaio.so.1t64" && ! -f "$libdir/libaio.so.1" ]]; then
          sudo ln -s "$libdir/libaio.so.1t64" "$libdir/libaio.so.1" 2>/dev/null || true
        fi
      done
    fi
    # libssl1.1: 虚谷需要 OpenSSL 1.1，Ubuntu 22.04+ 默认只有 3.x
    if ! ldconfig -p 2>/dev/null | grep -q "libcrypto.so.1.1"; then
      log "安装 libssl1.1..."
      sudo apt-get install -y -qq libssl1.1 2>/dev/null || true
      # Ubuntu 24.04: 从 22.04 仓库下载
      if ! ldconfig -p 2>/dev/null | grep -q "libcrypto.so.1.1"; then
        arch=$(dpkg --print-architecture 2>/dev/null || echo "arm64")
        # ARM64 包在 ports.ubuntu.com，x86_64 在 archive.ubuntu.com
        if [[ "$arch" == "arm64" ]]; then
          url="http://ports.ubuntu.com/ubuntu-ports/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_${arch}.deb"
        else
          url="http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_${arch}.deb"
        fi
        wget -q "$url" -O /tmp/libssl11.deb 2>/dev/null && \
        sudo dpkg -i /tmp/libssl11.deb 2>/dev/null && rm -f /tmp/libssl11.deb || true
      fi
    fi
  elif command -v yum &>/dev/null; then
    if ! ldconfig -p 2>/dev/null | grep -q libaio; then
      log "安装 libaio..."
      sudo yum install -y libaio 2>/dev/null || true
    fi
    if ! ldconfig -p 2>/dev/null | grep -q "libcrypto.so.1.1"; then
      log "安装 compat-openssl11..."
      sudo yum install -y compat-openssl11 2>/dev/null || true
    fi
  elif command -v dnf &>/dev/null; then
    if ! ldconfig -p 2>/dev/null | grep -q libaio; then
      log "安装 libaio..."
      sudo dnf install -y libaio 2>/dev/null || true
    fi
    if ! ldconfig -p 2>/dev/null | grep -q "libcrypto.so.1.1"; then
      log "安装 compat-openssl11..."
      sudo dnf install -y compat-openssl11 2>/dev/null || true
    fi
  fi
}

# 安装 podman（Linux 容器方案）
install_podman_linux() {
  log "正在安装 podman（daemonless 容器运行时）..."

  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq podman
  elif command -v yum &>/dev/null; then
    sudo yum install -y podman
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y podman
  elif command -v zypper &>/dev/null; then
    sudo zypper install -y podman
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm podman
  elif command -v apk &>/dev/null; then
    sudo apk add podman
  else
    fail "无法识别包管理器。请手动安装 podman: https://podman.io/getting-started/installation"
  fi
}

# macOS: 检测或安装 Colima
detect_or_install_macos_runtime() {
  # OrbStack（最快最轻）
  if [[ -d /Applications/OrbStack.app ]]; then
    log "检测到 OrbStack。"
    if ! orbctl status &>/dev/null 2>&1; then
      log "启动 OrbStack..."
      open -a OrbStack 2>/dev/null || true
      for i in $(seq 1 30); do
        docker info &>/dev/null 2>&1 && break
        sleep 1
      done
    fi
    ok "OrbStack 已就绪。"
    echo "docker"
    return 0
  fi

  # Colima
  if command -v colima &>/dev/null; then
    if ! colima status 2>/dev/null | grep -q "Running"; then
      log "启动 Colima..."
      colima start 2>/dev/null || fail "Colima 启动失败，请手动运行: colima start"
    fi
    ok "Colima 已就绪。"
    echo "docker"
    return 0
  fi

  # Docker Desktop
  if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
      ok "Docker Desktop 已就绪。"
      echo "docker"
      return 0
    fi
    if [[ -d /Applications/Docker.app ]]; then
      log "Docker Desktop 已安装但未运行，正在启动..."
      open -a Docker 2>/dev/null || true
      for i in $(seq 1 60); do
        if docker info &>/dev/null 2>&1; then
          ok "Docker Desktop 已启动。"
          echo "docker"
          return 0
        fi
        sleep 1
      done
    fi
  fi

  # 自动安装 Colima（最轻量免费方案）
  if command -v brew &>/dev/null; then
    log "未检测到容器运行时，自动安装 Colima..."
    brew install colima 2>/dev/null || fail "Colima 安装失败，请手动运行: brew install colima"
    colima start 2>/dev/null || fail "Colima 启动失败，请手动运行: colima start"
    ok "Colima 安装并启动完成。"
    echo "docker"
    return 0
  fi

  log "macOS 上未检测到容器运行时，也未找到 Homebrew。"
  log "推荐方案（按轻量程度排序）:"
  log "  1. OrbStack  — https://orbstack.dev"
  log "  2. Colima    — brew install colima && colima start"
  log "  3. Docker Desktop — https://docker.com/products/docker-desktop"
  fail "请安装上述任一运行时后重新运行。"
}

# 写入 .env.local
write_env() {
  local key="$1" val="$2"
  mkdir -p "$(dirname "$ENV_FILE")"
  if [[ -f "$ENV_FILE" ]] && grep -q "^${key}=" "$ENV_FILE"; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    fi
  elif [[ -f "$ENV_FILE" ]]; then
    echo "${key}=${val}" >> "$ENV_FILE"
  else
    echo "${key}=${val}" > "$ENV_FILE"
  fi
}

# ---- 主逻辑 ----

main() {
  local os_type arch_type

  os_type="$(uname -s)"
  arch_type="$(uname -m)"
  log "操作系统: $os_type / $arch_type"

  case "$os_type" in
    Linux)
      # 优先 native 模式
      if has_native_binary; then
        log "检测到虚谷原生服务端二进制，使用 native 模式（零容器）。"
        install_linux_deps
        write_env "PLATFORM_XUGU_LIFECYCLE" "native"
        ok "Linux native 模式准备完毕。"
        exit 0
      fi
      # fallback: 尝试容器模式
      log "未检测到虚谷原生二进制，尝试容器模式..."
      if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
        ok "Docker 已就绪。"
        write_env "PLATFORM_XUGU_LIFECYCLE" "managed"
        write_env "CONTAINER_CLI" "docker"
        exit 0
      fi
      if command -v podman &>/dev/null && podman info &>/dev/null 2>&1; then
        ok "Podman 已就绪。"
        write_env "PLATFORM_XUGU_LIFECYCLE" "managed"
        write_env "CONTAINER_CLI" "podman"
        exit 0
      fi
      install_podman_linux
      if command -v podman &>/dev/null; then
        write_env "PLATFORM_XUGU_LIFECYCLE" "managed"
        write_env "CONTAINER_CLI" "podman"
        ok "podman 安装完成。"
        exit 0
      fi
      fail "podman 安装后仍不可用"
      ;;

    MINGW*|MSYS*|CYGWIN*)
      # Windows: native 模式
      if has_native_binary; then
        log "检测到虚谷原生服务端二进制，使用 native 模式（零容器）。"
        write_env "PLATFORM_XUGU_LIFECYCLE" "native"
        ok "Windows native 模式准备完毕。"
        exit 0
      fi
      fail "未找到虚谷 Windows 服务端二进制。"
      ;;

    Darwin)
      # macOS: 必须用容器（虚谷无 macOS 版）
      local cli
      cli="$(detect_or_install_macos_runtime)" || exit 1
      write_env "PLATFORM_XUGU_LIFECYCLE" "managed"
      write_env "CONTAINER_CLI" "$cli"
      ok "macOS 容器运行时准备完毕。"
      ;;

    *)
      fail "不支持的操作系统: $os_type"
      ;;
  esac

  ok "运行时准备完毕。"
}

main "$@"
