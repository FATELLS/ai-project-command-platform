# System Specification: AI Project Command Platform

> Migrated from `.planning/design/system/SYSTEM-SPEC.md`. Updated for PostgreSQL + Fastify + Vue 3 architecture.
> Status: canonical (V2 refactoring)

## 1. Mission

平台管理多个项目和团队，把路线、任务、材料、证据与项目更新统一为受控数据流程。AI 的价值是把材料转换成有来源的结构化建议，而不是生成页面或代替人员发布。

## 2. 角色

| 角色 | 能力 |
|---|---|
| 平台管理员 | 平台配置、用户、全部项目、AI 与运维 |
| 项目管理员 | 成员、材料、审核、发布和回滚 |
| 项目编辑 | 材料维护、生成和允许的审核操作 |
| 查看者 | 读取授权项目发布态和允许的问答 |
| LLM Provider | 受限生成建议或回答，不是受信任主体 |
| Material Worker | 在项目隔离与配额约束下产生证据（进程内） |

## 3. 核心对象

- `Project`：稳定项目身份、模板和版本指针。
- `ProjectVersion`：不可变发布或草稿快照。
- `ProjectCard`：任务、单元、阶段、成果、风险、指标等统一元素。
- `ProjectCardLink`：父子、依赖和其他显式关系。
- `Material` / `EvidenceBlock`：项目材料及可引用证据。
- `GenerationJob`：锁定材料、证据、模板和基准版本的生成任务。
- `ChangeProposal`：只含白名单结构化变更与证据引用。
- `ReviewItem` / `ReleaseEvent` / `AuditEvent`：审核、发布与追溯。

## 4. 系统边界

### 4.1 运行拓扑

```
┌─────────────────────────────────┐
│         Fastify App             │
│  ┌───────┐  ┌────────────────┐  │
│  │  API  │  │  Vue Static    │  │
│  │Routes │  │  (built dist)  │  │
│  └───┬───┘  └────────────────┘  │
│      │                          │
│  ┌───┴────────────────────┐     │
│  │   Business Modules     │     │
│  │  identity | projects   │     │
│  │  materials | ai        │     │
│  │  governance            │     │
│  └───┬────────────────────┘     │
│      │                          │
│  ┌───┴────────────────────┐     │
│  │  In-Process Workers    │     │
│  │  (material extraction) │     │
│  └───┬────────────────────┘     │
└──────┼──────────────────────────┘
       │
       ▼
┌──────────────┐
│ PostgreSQL   │
│ (sole DB)    │
└──────────────┘
```

### 4.2 信任边界

- HTTP 入口：Fastify schema validation + auth plugin
- AI Provider 出口：HTTPS-only、主机白名单、凭据脱敏
- 文件系统：材料原件隔离存储、projectId 命名空间
- 数据库：参数化查询（Kysely）、projectId 隔离

### 4.3 事务边界

- 每个业务用例只有一个清晰事务入口。
- Repository 不隐式嵌套事务。
- 外部 API 调用（AI Provider）不得处于长数据库事务中。

## 5. 模块映射

| V1 模块 | V2 模块 | Goal |
|---|---|---|
| 01 Runtime & Persistence | `packages/database` | G04 |
| 02 Identity & Project Access | `apps/api/src/modules/identity` + `projects` | G06 |
| 03 Project Model & Rendering | `apps/api/src/modules/project-graph` + `apps/web/src/features/project-workspace` | G07, G13 |
| 04 Materials & Evidence | `apps/api/src/modules/materials` | G08 |
| 05 AI Services | `apps/api/src/modules/ai-services` | G08 |
| 06 Change Control & Release | `apps/api/src/modules/change-governance` | G09 |
| 07 Product Experience | `apps/web/src/` | G11-G16 |
| 08 Operations & Delivery | `ops/` + `apps/api/src/modules/operations` | G17 |

## 6. 权威顺序

`AGENTS.md → REFACTOR-PLAN.md → constitution → accepted ADR → architecture → feature spec/plan/tasks → code/tests`
