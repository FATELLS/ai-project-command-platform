# Project Structure

> **Status**: ACCEPTED (G00)
> **Authority**: REFACTOR-PLAN.md §3
> **Canonical**: This is the single source of truth for directory naming, ownership and dependency direction.

## 1. Top-Level Directory Tree

```text
.
├── .github/                     # CI、发布工作流、CODEOWNERS
├── .specify/                    # Spec Kit 模板、constitution、工作流配置
├── apps/                        # 可运行应用
│   ├── api/                     # 唯一后端应用 (Fastify)
│   └── web/                     # 唯一前端应用 (Vue 3)
├── packages/                    # 非独立部署的共享包
│   ├── contracts/               # API 契约与生成客户端类型
│   ├── database/                # PostgreSQL client/schema/repository 基础与唯一 migrations
│   ├── domain/                  # 无框架依赖的业务规则和值对象
│   └── test-kit/                # 脱敏 fixture builder 和测试基础设施
├── specs/                       # 每个 Goal/feature 的 SDD 工件
├── docs/                        # 长期文档
│   ├── product/                 # 产品、需求、路线图、已实现能力
│   ├── architecture/            # 当前架构、目录契约、运行拓扑、追踪关系
│   ├── adr/                     # 架构决策记录
│   ├── engineering/             # 编码、测试、性能、安全规范
│   ├── operations/              # 安装、升级、备份、恢复、运行手册
│   └── changes/                 # 追加式设计变更、执行状态和交接
├── tests/                       # 跨包黑盒测试
│   ├── contract/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── ops/                         # 非业务运维资产
│   ├── compose.yaml
│   ├── container/
│   ├── packaging/
│   └── scripts/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.mjs
└── stylelint.config.mjs
```

## 2. Directory Ownership and Rules

### 2.1 `.github/`

| 属性 | 值 |
|---|---|
| Owner | CI/CD |
| 允许内容 | GitHub Actions workflows, CODEOWNERS, PR/issue 模板 |
| 禁止内容 | 业务代码、密钥、构建产物 |
| 依赖方向 | 无运行时依赖 |

### 2.2 `.specify/`

| 属性 | 值 |
|---|---|
| Owner | G01 建立 |
| 允许内容 | Spec Kit constitution、模板、预设、扩展配置 |
| 禁止内容 | 业务代码、运行时配置 |
| 依赖方向 | 被 specs/ 引用 |

### 2.3 `apps/api/` — 唯一后端应用

| 属性 | 值 |
|---|---|
| Owner | backend team |
| 允许内容 | Fastify app 组装、模块化路由、service/repository |
| 禁止内容 | 前端代码、数据库 migration（在 packages/database）、纯领域规则（在 packages/domain） |
| 依赖方向 | `apps/api → packages/{contracts,database,domain} → 无` |

内部目录：

```text
apps/api/src/
├── main.ts                  # 进程入口
├── app/
│   ├── build-app.ts         # Fastify 组装
│   └── lifecycle.ts         # readiness、shutdown
├── config/
│   ├── config.schema.ts
│   └── load-config.ts
├── plugins/
│   ├── authentication.plugin.ts
│   ├── database.plugin.ts
│   ├── error-handler.plugin.ts
│   ├── observability.plugin.ts
│   └── security.plugin.ts
└── modules/
    ├── identity/
    ├── projects/
    ├── project-graph/
    ├── materials/
    ├── ai-services/
    ├── change-governance/
    └── operations/
```

每个模块按需使用：

```text
<module>/
├── index.ts
├── <resource>.routes.ts
├── <resource>.schemas.ts
├── <resource>.service.ts
├── <resource>.repository.ts
├── <resource>.mapper.ts
├── <resource>.errors.ts
└── <resource>.types.ts
```

### 2.4 `apps/web/` — 唯一前端应用

| 属性 | 值 |
|---|---|
| Owner | frontend team |
| 允许内容 | Vue 3 app、路由、feature 组件、entity 展示模型 |
| 禁止内容 | 业务规则、数据库访问、API 端点定义（在 packages/contracts） |
| 依赖方向 | `app/router → features → entities → shared`（严格单向，下层不可导入上层） |

内部目录：

```text
apps/web/src/
├── main.ts
├── app/                     # app providers、App.vue、全局错误边界
├── router/                  # 路由定义和守卫
├── features/                # 可交付业务能力
│   ├── identity/
│   ├── projects/
│   ├── project-workspace/
│   ├── materials/
│   ├── ai-services/
│   └── change-governance/
├── entities/                # 稳定业务实体展示模型
│   ├── project/
│   ├── project-card/
│   ├── material/
│   └── change-proposal/
└── shared/
    ├── api/                 # API client 与查询基础设施
    ├── ui/                  # 无业务语义基础组件
    ├── styles/              # token、reset、全局布局
    └── lib/                 # 少量领域无关库
```

### 2.5 `packages/contracts/`

| 属性 | 值 |
|---|---|
| Owner | platform |
| 允许内容 | API JSON Schema、OpenAPI 定义、生成的前端类型 |
| 禁止内容 | 业务实现、数据库访问 |
| 依赖方向 | `contracts → domain（仅类型） → 无` |

### 2.6 `packages/database/`

| 属性 | 值 |
|---|---|
| Owner | platform |
| 允许内容 | PostgreSQL Kysely client、schema 类型、**唯一 migration tree** |
| 禁止内容 | 虚谷兼容层、第二迁移树、业务 service 逻辑 |
| 依赖方向 | `database → domain（仅类型） → 无` |

```text
packages/database/
├── package.json
├── tsconfig.json
├── migrations/               # 唯一 PostgreSQL migration tree
│   ├── 0001_create_baseline_schema.sql
│   └── ...
└── src/
    ├── client/
    ├── schema/
    ├── migration/
    └── index.ts
```

### 2.7 `packages/domain/`

| 属性 | 值 |
|---|---|
| Owner | platform |
| 允许内容 | 无框架依赖的业务规则、值对象、状态机定义 |
| 禁止内容 | Fastify/Vue/数据库依赖 |
| 依赖方向 | `domain → 无`（最底层，不依赖任何包） |

### 2.8 `packages/test-kit/`

| 属性 | 值 |
|---|---|
| Owner | platform |
| 允许内容 | 脱敏 fixture builder、测试工厂、testcontainers 辅助 |
| 禁止内容 | 真实业务数据、密钥 |
| 依赖方向 | `test-kit → {domain, database} → 无` |

### 2.9 `specs/`

| 属性 | 值 |
|---|---|
| Owner | 每个 Goal 的执行 Agent |
| 允许内容 | spec.md、plan.md、tasks.md、VERIFICATION.md |
| 禁止内容 | 运行时代码 |
| 依赖方向 | 引用 docs/ 和 packages/contracts/ |

### 2.10 `docs/`

| 属性 | 值 |
|---|---|
| Owner | 全体 |
| 允许内容 | 产品、架构、ADR、工程规范、运维手册、变更记录 |
| 禁止内容 | 运行时代码、密钥、日志 |
| 依赖方向 | 无（文档是权威源） |

### 2.11 `tests/`

| 属性 | 值 |
|---|---|
| Owner | 全体 |
| 允许内容 | 跨包黑盒测试（contract/integration/e2e）、脱敏 fixture |
| 禁止内容 | 真实数据、密钥 |
| 依赖方向 | `tests → apps/* + packages/*` |

### 2.12 `ops/`

| 属性 | 值 |
|---|---|
| Owner | ops team |
| 允许内容 | compose.yaml、container 定义、packaging 脚本、运维脚本 |
| 禁止内容 | 业务逻辑、应用源码 |
| 依赖方向 | 引用 apps/ 构建产物 |

## 3. Forbidden Top-Level Directories

重构完成后不得存在：

- `src/` → 内容迁移到 `apps/api/src/` 或 `packages/`
- `public/` → 迁移到 `apps/web/`
- `scripts/` → 迁移到 `ops/scripts/`
- `vendor/` → 完全删除（虚谷二进制和驱动不再需要）
- `frontend/` `backend/` `legacy/` `common/` `utils/` → 禁止创建
- `logs/` `data/` → .gitignore，不进 Git
- `fixtures/` → 迁移到 `tests/fixtures/`
- `.planning/` → 迁移到 `docs/product/`、`docs/architecture/`、`docs/changes/`

## 4. Dependency Direction Summary

```text
apps/api ──────────────────┐
                           ├──→ packages/contracts ──→ packages/domain
apps/web ──────────────────┤
                           ├──→ packages/database ───→ packages/domain
tests/ ────────────────────┤
                           └──→ packages/test-kit ───→ packages/{domain,database}

ops/ ──→ apps/* (build artifacts only)
docs/ ──→ (no runtime dependency)
specs/ ──→ docs/ + packages/contracts (reference only)
```

**规则**：
- 依赖只能从上层指向下层，不可逆
- feature 不得直接导入另一 feature 的内部文件
- `shared/ui` 不得请求 API、读取路由或包含业务判断
- 无循环依赖
