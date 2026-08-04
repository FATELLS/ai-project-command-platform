# AI 项目作战管理平台

> **版本**: 2.0 (重构中 — G00-G18)
> **状态**: V1 功能完整，正在重构为 TypeScript + Fastify + Vue 3 + PostgreSQL

面向多项目、多团队的项目推进平台。路线图、作战单元、排期、健康度、材料、AI 结构化提案、人工审核与发布都在同一项目命名空间内运行。

## 技术栈 (V2 目标)

| 层 | 技术 |
|---|---|
| 数据库 | PostgreSQL 18 |
| 后端 | Fastify 5 + TypeScript strict |
| 前端 | Vue 3 + Vite + Vue Router + Element Plus 按需 |
| 状态管理 | TanStack Query (server) + Pinia (auth only) |
| Query Builder | Kysely |
| 包管理 | npm workspaces |
| 运行时 | Node.js 22 LTS |

## 重构状态

正在执行 SDD (Spec-Driven Development) 方法的 G00-G18 重构计划：

- **G00** ✅ 目录锁定和迁移映射
- **G01** ⏳ 跨 Agent 工程治理
- **G02-G18** 待执行

详见 `docs/REFACTOR-PLAN.md` 和 `docs/changes/EXECUTION-STATE.md`。

## 产品边界

- PostgreSQL 是唯一持久化后端（ADR-001）。
- `project_cards` 与 `project_card_links` 是唯一版本化项目图模型。
- LLM 只能生成有来源的结构化 `ChangeProposal`，不能生成页面代码，也不能审核、合并或发布。
- 项目、材料、证据、问答、生成任务和权限按 `projectId` 隔离。
- 运行服务上限 2（app + PostgreSQL），不引入 Redis/MQ/K8s（ADR-003）。

## 运行要求 (V2 目标)

- Node.js 22 LTS
- PostgreSQL 18（或连接外部 PostgreSQL）
- 至少 512 MB 可用内存

## 源码开发 (V1 当前)

> 注意：V1 代码仍在运行，使用 XuguDB。以下命令在 G10 后端切换前仍然有效。

```bash
npm ci
cp .env.example .env.local
npm run start:background
npm run status
```

打开 <http://127.0.0.1:4173>。

## AI 配置

AI 默认关闭。真实密钥只能放在未跟踪的 `.env.local` 或平台设置中：

```dotenv
AI_GENERATION_PROVIDER=openai-compatible
AI_GENERATION_BASE_URL=https://example.com/v1
AI_GENERATION_API_KEY=replace-me
AI_GENERATION_MODEL=replace-me
AI_GENERATION_ALLOWED_HOSTS=example.com
```

代码中不硬编码供应商 URL、模型名称或域名。设置接口只返回是否已配置及脱敏摘要。

## 验证

```bash
npm run verify:code
npm test
npm run test:e2e
```

## 项目文档

| 文档 | 位置 |
|---|---|
| 执行合同 | `docs/REFACTOR-PLAN.md` |
| 工程宪法 | `.specify/memory/constitution.md` |
| 产品定义 | `docs/product/PRODUCT.md` |
| 架构设计 | `docs/architecture/SYSTEM.md` |
| 架构决策 | `docs/adr/` |
| 变更记录 | `docs/changes/` |

## 授权

项目仅供内部使用，未开放许可（`UNLICENSED`）。
