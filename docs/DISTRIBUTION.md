# V1.0 分发说明

## 支持目标

| 目标 | 产物 | 虚谷运行方式 | 需要容器？ |
|---|---|---|---|
| Linux ARM64 | `ai-project-command-platform-1.0.0-linux-arm64.tar.gz` | native（直接跑二进制） | ❌ 不需要 |
| Linux x86_64 | `ai-project-command-platform-1.0.0-linux-x86_64.tar.gz` | native | ❌ 不需要 |
| Windows amd64 | `ai-project-command-platform-1.0.0-windows-amd64.zip` | native（xugu_server.exe） | ❌ 不需要 |
| macOS Apple Silicon | `ai-project-command-platform-1.0.0-macos-arm64.tar.gz` | 容器 VM | ⚠️ 需要（Colima/Docker Desktop） |

## 三平台架构

### Linux / Windows：native 模式
虚谷服务端二进制直接以进程方式运行，不需要 Docker、不需要容器运行时。
- `PLATFORM_XUGU_LIFECYCLE=native`
- bootstrap 自动安装 Linux 依赖（libaio）
- 启动时自动检测：`xugu_linux_aarch64_*` / `xugu_linux_x86_64_*` / `xugu_windows_amd64_*.exe`

### macOS：容器模式
虚谷无 macOS 版本，必须在 Linux VM 中运行。
- `PLATFORM_XUGU_LIFECYCLE=managed`
- bootstrap 自动检测/安装 Colima、OrbStack 或 Docker Desktop

## 产物内容

- Node.js 20 runtime
- 虚谷服务端二进制（Linux ARM64/x86_64、Windows amd64）
- 虚谷多架构 Docker 镜像归档（macOS 容器模式使用）
- 目标平台虚谷原生 Node.js 驱动
- server、src、public、生产依赖
- 三平台启停脚本

## 明确排除

- 项目夹具和公司数据
- 运行数据库 volume
- 上传材料、处理结果、备份和导出
- `.env.local`、API Key、首次凭据和日志
- test、规划目录和浏览器报告

## 首次启动

### Linux
1. `./start.sh` — bootstrap 检测到 native 二进制，自动安装 libaio（如缺）。
2. manager 直接 spawn 虚谷进程，不需要容器。
3. 首次管理员凭据显示在终端和 `first-run-credentials.txt`。

### Windows
1. `start.bat` — native 模式，直接跑 `xugu_windows_amd64_*.exe`。
2. 首次管理员凭据显示在终端和 `first-run-credentials.txt`。

### macOS
1. `./start.sh` — bootstrap 自动检测/安装容器运行时。
2. manager 加载镜像、创建容器、启动虚谷。
3. 首次管理员凭据显示在终端和 `first-run-credentials.txt`。

## 停止
- Linux/macOS: `./stop.sh`
- Windows: `stop.bat`
