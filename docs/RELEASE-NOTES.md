# Release Notes

## v1.0.0

### 新功能

- **三平台零容器运行**：Linux (ARM64/x86_64)、Windows (amd64)、macOS (ARM64) 全面支持
- **native 生命周期模式**：Linux/Windows 直接以原生进程运行虚谷服务端，无需任何容器运行时
- **CONTAINER_CLI 可配置**：managed 模式支持 docker / podman / nerdctl 等任意 OCI 兼容 CLI
- **一行安装**：新用户在任意平台执行一行命令即可完成下载、安装依赖、启动
  - Linux / macOS：`curl -fsSL .../install.sh | bash`
  - Windows：`irm .../install.ps1 | iex`
- **多架构 Docker 镜像**：虚谷 12.10.13 ARM64 + AMD64 双架构 manifest
- **四平台 Node.js 原生驱动**：macOS ARM64、Linux ARM64/x86_64、Windows x64

### 改进

- bootstrap-runtime.sh 三平台自动检测：有 native 二进制优先用 native，缺依赖自动安装
- assemble-release 按平台裁剪 vendor，每个发布包只含该平台需要的二进制
- 启动脚本统一集成 bootstrap，首次启动自动准备运行环境

### 平台支持矩阵

| 平台 | 虚谷运行方式 | 需要容器运行时 |
|------|-------------|--------------|
| Linux ARM64 | native（原生进程） | 否 |
| Linux x86_64 | native（原生进程） | 否 |
| Windows amd64 | native（原生进程） | 否 |
| macOS ARM64 | managed（容器 VM） | 是（Colima / Docker Desktop / OrbStack） |
