# V1.0 分发说明

## 支持目标

| 目标 | 产物 | 状态 |
|---|---|---|
| Linux ARM64 | `ai-project-command-platform-1.0.0-linux-arm64.tar.gz` | CI 构建与完整栈 smoke |
| macOS Apple Silicon | `ai-project-command-platform-1.0.0-macos-arm64.tar.gz` | 本地组装与驱动支持 |

Windows、x86 和 RPM 不属于 V1.0 支持边界。

## 产物内容

- Node.js 20.19.5 runtime
- 虚谷 12.9.10 ARM64 Docker 镜像归档、manifest 和 SHA-256
- 目标平台虚谷原生 Node.js 驱动
- server、src、public、生产依赖
- managed 启停脚本和 env 示例

## 明确排除

- 项目夹具和公司数据
- 运行数据库 volume
- 上传材料、处理结果、备份和导出
- `.env.local`、API Key、首次凭据和日志
- test、规划目录和浏览器报告

## 组装

```bash
node scripts/assemble-release.mjs \
  --target linux-arm64 \
  --runtime /path/to/node-v20.19.5-linux-arm64 \
  --output dist/ai-project-command-platform-1.0.0-linux-arm64
```

macOS 使用 `--target macos-arm64` 与对应 runtime。

## 首次启动

1. 确认 Docker 可用。
2. 解压完整目录并执行 `./start.sh`。
3. 启动脚本生成随机管理员密码与 `.env.local`。
4. manager 校验/加载镜像、创建专用 volume、启动虚谷，再启动应用。
5. 首次登录后修改密码并删除首次凭据文件。

停止使用 `./stop.sh`，不要直接删除专用 volume。
