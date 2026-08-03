# Current State

日期：2026-08-03
版本：`1.0.0`
数据库：XuguDB `12.9.10-arm64`
迁移：`001..008`
Git HEAD：`015b37e`（多架构虚谷支持：manifest v2 + driverPath 多平台 + manage-server/fixture 按架构选镜像）

## 已实现

- 多项目、权限、固定模块 UI、统一卡片项目图。
- 材料、证据、readiness、问答和结构化提案。
- 人工审核、草稿合并、发布、回滚和审计。
- 虚谷 Worker 适配、UTF-8/CLOB、事务、导入导出。
- 镜像和驱动随包、managed/external 生命周期、冷备恢复。
- manifest v2 多架构格式（arm64 完整、amd64 占位）；driverPath 支持 darwin/arm64、linux/arm64、linux/x64、win32/x64。
- manage-server 按运行时 arch 自动选择镜像。
- Linux ARM64 发布 workflow；macOS ARM64 本地组装路径；Linux x86_64 代码路径就绪。
- 设置与日志密钥脱敏。

## 当前验证

- 定点数据库读写与事务回滚：通过。
- 材料→生成→审核→发布→回滚浏览器闭环：通过。
- `npm run verify`：通过；Node 测试 `67/67`，Chromium 主 UI `82/82`。
- 独立异常输入 UI：`9/9` 通过。
- 真实虚谷集成包含 8 版迁移、中文 CLOB、事务、冷备份与 volume 恢复。
- `npm audit`：0 个已知漏洞。
- 2026-08-03 全新隔离环境复验：全部通过（容器 `ai-platform-playwright-xugu` / `ai-platform-playwright-abnormal-xugu`，端口 55140/55142）。

## 本机运行状态

- `xugu-dev` 已于 2026-08-03 按用户要求停止，容器和匿名 volume 保留。
- V1.0 隔离体验实例 `ai-platform-isolated-ui` 继续运行，健康检查为 `ok`。
- `origin/main` 已同步到提交 `5aea6f0`；GitHub 对 70 MB 虚谷镜像给出大文件建议但未阻止推送。

## 已知后续

- 获取虚谷 Linux x86 Docker 镜像和 x86_64 原生驱动，填入 manifest amd64 条目。
- Windows 原生支持需要独立进程管理生命周期。
- 大型 HTTP/前端文件仍需按领域拆分，但当前行为由浏览器契约保护。
- macOS 发布尚缺 CI 完整栈 smoke。
- 需要长期维护真实虚谷升级夹具和兼容窗口。

## 安全状态

- 未发现提交的真实 API Key。
- 发布白名单排除项目数据、材料、凭据、日志和备份。
- 运行数据目录未作为本次清理对象删除。
