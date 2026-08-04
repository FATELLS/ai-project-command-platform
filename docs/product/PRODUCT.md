# AI 项目作战管理平台

> Migrated from `.planning/PROJECT.md`. Updated for PostgreSQL architecture.

版本：`2.0.0-dev` (重构中)
状态：`refactoring in progress (G00-G18)`

## 目标

用一套工程管理多个项目和团队，把项目路线、材料证据、AI 结构化建议、人工审核、发布和回滚统一到可追溯的数据链路中。

## 核心价值

- 项目内容更新不再依赖定制页面开发。
- AI 只提出有证据的结构化变更，人负责审核与发布。
- 项目事实具有版本、来源、权限和审计边界。
- 应用 + PostgreSQL 两个服务作为最小运行栈交付和运维。

## 范围

- 多项目、成员与角色权限。
- 固定项目工作区和统一卡片路线图。
- 材料上传/人工录入、提取、证据与 readiness。
- 项目问答与结构化更新建议。
- 审核、草稿合并、发布、回滚与审计。
- PostgreSQL migration 管理、备份和恢复。
- Linux ARM64/x86_64、Windows amd64、macOS Apple Silicon 发布。

## 不在 V2 范围

- AI 自动审核或自动发布。
- AI 生成页面代码或动态执行代码。
- 微服务架构。
- Redis、消息队列、对象存储或 Kubernetes。
- 把真实项目数据、材料或密钥打入发布包。

## 成功标准

- `xugu-agentic-group` 作为业务项目 stable external ID 保留（名称不代表数据库技术）。
- 新环境可一组命令启动 PostgreSQL 和应用。
- UI 主流程、异常输入、真实 PostgreSQL 集成、备份恢复与静态门禁全部通过。
- canonical design、代码、测试和发布支持矩阵一致。

## 技术栈

| 层 | 技术 |
|---|---|
| 数据库 | PostgreSQL 18 |
| 后端 | Fastify 5 + TypeScript strict |
| 前端 | Vue 3 + Vite + Vue Router + Element Plus 按需 |
| 状态管理 | TanStack Query (server) + Pinia (auth only) |
| Query Builder | Kysely |
| 包管理 | npm workspaces |
