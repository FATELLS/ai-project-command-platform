# ADR S-08：完整栈 portable 发布与冷备恢复

状态：`accepted`
日期：2026-08-02

## 决策

1. 唯一发布组装入口为 `scripts/assemble-release.mjs`。
2. 产物必须包含 Node.js runtime、虚谷 ARM64 镜像、目标原生驱动、应用代码和启停脚本。
3. v1.0 支持 Linux ARM64 与 macOS Apple Silicon；未验证平台不生成空壳产物。
4. 虚谷备份采用停止容器后的 volume 归档；恢复前自动保护当前 volume。
5. 发布包和诊断不得包含项目数据、材料、密钥、日志、测试或规划文件。

## 原因

应用包若不含数据库运行栈，就不是可独立交付的产品。虚谷运行文件是有状态目录，冷备份提供当前版本下可验证、可恢复的一致边界。

## 影响

- 启动依赖 Docker。
- GitHub CI 使用 ARM64 runner 做镜像校验与完整栈 smoke。
- macOS CI smoke 是后续发布增强，但本地驱动和组装路径已存在。
