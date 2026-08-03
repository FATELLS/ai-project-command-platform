# Agent Handoff

日期：2026-08-03
版本：`1.0.0`

## 当前起点

- 工程已收口为虚谷单后端，唯一迁移目录 `src/db/xugu-migrations/`。
- 项目图唯一模型为 `project_cards` / `project_card_links`。
- 虚谷镜像与 ARM64 驱动位于 `vendor/xugudb/`；manifest 已升级为 v2 多架构格式（arm64 完整、amd64 占位）。
- managed 生命周期由 `scripts/manage-server.mjs` 负责，按运行时 arch 自动选择镜像。
- 真实数据库桥接位于 `src/db/xugu-database.cjs` 与 `src/db/xugu-worker.cjs`。
- 发布支持 Linux ARM64 和 macOS Apple Silicon portable；Linux x86_64 代码路径已就绪，待获取 amd64 镜像和驱动。
- 本机旧 `xugu-dev` 容器已停止但未删除；隔离体验实例仍在运行。
- V1.0 整合最终提交为 `5aea6f0`，已推送至 `origin/main`；完整服务使用 `npm run start:background`，不是 `npx serve`。
- 2026-08-03 全新隔离环境完整复验通过；修复 E2E 测试竞态后提交 `d9aac1e`（尚未推送）。

## 关键驱动结论

- 必须使用 Node.js 20 ABI 与 `CHAR_SET=UTF8`。
- 原生 query callback 由 Worker 独占消费，上层维持同步事务接口。
- CLOB 返回值可能是 ArrayBuffer，必须按 UTF-8 解码。
- 空字符串绑定需要适配，空值使用 SQL `NULL`。
- 不要把数值型版本列重命名为同表字符串主键 `id`，驱动会发生结果类型解码冲突。

## 本次已验证

- 真实查询、命中更新、事务插入与回滚。
- fake provider 生成成功并创建一个审核项。
- 真实浏览器完成材料、生成、审核、合并、发布、回滚和审计闭环。
- 最终 `npm run verify`：Node `67/67`、Chromium 主 UI `82/82`。
- 独立异常输入 Chromium：`9/9`；`npm audit`：0 个已知漏洞。

## 下一步

1. 获取虚谷 Linux x86 Docker 镜像（下载 `XuguDB-Server linux-x86_64` 产品包 → 构建 → `docker save`），填入 manifest amd64 条目。
2. 获取 Linux x86_64 原生驱动 `xugudbjs-linux-x86_64.node`，放入 `vendor/xugudb/nodejs/`。
3. Windows 原生支持需要独立的进程管理生命周期（不走 Docker），作为独立工作项。
4. 若继续 V1.1，优先拆分 `src/http/app.mjs` 与前端巨型模块，保持现有 82 条主浏览器契约。

## 禁止回退

- 不得恢复第二数据库、第二迁移树、旧项目关系表或双写。
- 不得恢复 Windows/x86/RPM 空壳发布。
- 不得把密钥、项目数据或运行 volume 纳入仓库和 release。
