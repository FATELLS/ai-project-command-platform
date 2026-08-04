# AI 项目作战管理平台重构 Goal 执行计划

状态：`proposed-for-approval`  
版本：`1.0.0-draft`  
日期：2026-08-04  
用途：交给新的 Agent，按 Goal 串行、逐步执行。  
重要：本文是执行合同，不是背景材料。执行 Agent 不得自行改变 Goal 顺序、目录命名或成功定义。

---

## 0. 最终目标

把当前历史债务较重、文档与实现漂移、前后端巨型文件并存的工程，重构为一套可持续维护的工程级 B/S 模块化单体：

- Node.js 22 LTS + TypeScript strict。
- Vue 3 + Vite + Vue Router + Element Plus 按需导入。
- Fastify 5 + JSON Schema/OpenAPI。
- PostgreSQL 18.x + `pg` + Kysely。
- 一个应用部署单元；默认运行服务不超过 `app + PostgreSQL` 两个。
- PostgreSQL 是唯一数据库，不双写，不保留可运行的虚谷实现，不迁移旧虚谷数据。
- 规范、目录、ADR、spec、tasks、实现和测试可追踪。
- 换 Agent、换会话后，只读仓库即可恢复相同的命名、边界、步骤和成功标准。

### 0.1 锁定决策

以下内容执行 Agent 不再重新选型：

| 领域 | 锁定决策 |
|---|---|
| 架构 | 模块化单体，不拆微服务 |
| 运行时 | Node.js 22 LTS、TypeScript、ESM |
| 前端 | Vue 3、Vite、Vue Router |
| UI 基础 | Element Plus 按需导入；统一 design token |
| Server state | TanStack Vue Query |
| Client state | Pinia，仅认证和纯客户端跨页面状态 |
| 后端 | Fastify 5 |
| API | `/api/v1`、JSON Schema、OpenAPI、JSON camelCase |
| 数据库 | PostgreSQL 18.x、pg、Kysely、单迁移树 |
| 数据迁移 | 不迁移旧虚谷数据；使用脱敏 fixture 建新库 |
| 测试 | Vitest、Fastify inject、真实 PostgreSQL、Playwright |
| 包管理 | npm workspaces；不引入 Nx/Turborepo |
| 部署 | compact：app + PostgreSQL；external DB：只有 app |
| 禁止设施 | Redis、MQ、对象存储、Kubernetes、服务网格、ELK、强制监控栈 |
| 日志 | Fastify/Pino stdout JSON；日志和诊断不进入 Git |

变更锁定决策必须先暂停当前 Goal，新增 ADR，获得用户确认后再继续。

---

## 1. Goal 执行协议

### 1.1 一次只执行一个 Goal

新 Agent 每次只创建一个 active Goal：

1. 读取本文件和强制上下文。
2. 选择最前面一个依赖已完成、状态未完成的 Goal。
3. 用该 Goal 的“Objective”原文创建 Goal；不要设置 token budget。
4. 为 Goal 内部步骤建立工作计划。
5. 只修改该 Goal 允许的文件范围。
6. 产生验证证据并更新路标。
7. 全部成功条件满足后才能将 Goal 标记 complete。
8. 提交 Goal handoff，停止；下一 Goal 由下一次明确执行触发。

禁止在一个 Goal 尚未完成时提前实施后续 Goal。

### 1.2 强制阅读顺序

每个 Goal 开始前依次读取：

1. `AGENTS.md`
2. 本文件 `docs/REFACTOR-PLAN.md`
3. 本文件第 6 章“工程编码与命名规范”
4. 已建立后的 `.specify/memory/constitution.md`
5. 已建立后的 `docs/architecture/PROJECT-STRUCTURE.md`
6. 相关 ADR
7. 当前 Goal 对应的 `spec.md`、`plan.md`、`tasks.md`
8. 最近的 `DESIGN-CHANGELOG`、`EXECUTION-STATE` 和 `HANDOFF`

任何未写入版本化文档的会话结论都视为未确认。

### 1.3 状态定义

| 状态 | 定义 |
|---|---|
| `pending` | 依赖未满足或尚未开始 |
| `in_progress` | 当前唯一正在执行的 Goal |
| `verification` | 实现完成，正在收集退出证据 |
| `complete` | 所有成功条件、门禁和文档更新均完成 |
| `failed` | 发生硬失败，或退出条件无法满足且应回滚 |
| `blocked` | 同一外部阻塞连续三个 Goal turn 无法解除，且无法继续安全工作 |

测试失败、lint 失败、设计冲突和实现困难不是 `blocked`，需要修复或判定 `failed`。

### 1.4 每个 Goal 的证据

每个 Goal 必须留下：

- `specs/<goal-id>-<slug>/spec.md`
- `specs/<goal-id>-<slug>/plan.md`
- `specs/<goal-id>-<slug>/tasks.md`
- `specs/<goal-id>-<slug>/VERIFICATION.md`
- 必要时的 `research.md`、`contracts/`、`quickstart.md`
- `docs/changes/DESIGN-CHANGELOG.md` 追加记录
- `docs/changes/EXECUTION-STATE.md` 状态更新
- `docs/changes/HANDOFF.md` 准确交接

Goal 00/01 在新目录尚未建立前，可以临时使用现有 `.planning` 留痕；Goal 01 完成后只写新位置。

### 1.5 提交策略

- 每个 Goal 使用独立分支或清晰的原子提交组。
- commit 必须引用 Goal ID 和 task ID。
- 不混入下一个 Goal 的准备性代码。
- 不覆盖用户已有未提交修改。
- 不使用破坏性 Git 命令。

---

## 2. 全局成功、失败和回滚定义

### 2.1 什么叫 Goal 成功

一个 Goal 只有同时满足以下条件才成功：

1. Objective 已实际达成，不只是 task 打勾。
2. 所有 Success Criteria 有命令输出或人工检查证据。
3. 所有必需测试通过，无静默 skip。
4. 允许修改范围没有越界。
5. 文档先于或同步于实现更新。
6. 没有引入第二真相、无期限 fallback 或隐藏兼容分支。
7. `git diff --check` 通过。
8. 日志、密钥、数据、报告和临时产物未被 Git 跟踪。
9. `VERIFICATION.md` 给出 `PASS`，并列出验证命令和结果。
10. EXECUTION-STATE、HANDOFF 和 DESIGN-CHANGELOG 已更新。

“功能看起来能用”不是成功。

### 2.2 什么叫 Goal 失败

出现任一情况即失败，不得标记 complete：

- 数据丢失、版本关系损坏、跨项目泄露或权限绕过。
- 密钥、材料原文、运行日志、数据库数据或诊断包进入 Git/发布包。
- 运行时同时写入两套数据库。
- 新旧 API/UI 被长期同时作为正式入口。
- 必需测试被删除、放宽、skip 或改成无意义断言。
- 资源预算超标且没有已确认 ADR。
- 目录、命名、依赖方向违反 accepted 规范。
- 文档仍同时声明两个 canonical 结论。
- 未完成退出标准却标记 Goal complete。

### 2.3 硬失败处理

1. 立即停止扩展修改范围。
2. 保存失败证据和最小复现。
3. 回退本 Goal 未发布的代码路径，不删除用户数据。
4. 标记 Goal `failed`，更新 HANDOFF。
5. 修正规范/计划或实现后，重新执行同一 Goal；不得跳到下一 Goal。

### 2.4 回滚原则

- 文档：通过新追加记录 supersede，不静默抹掉历史决定。
- 代码：Goal 级原子提交，可用普通 `git revert` 回滚。
- 数据库：使用 expand → migrate → contract；已发布 migration 不修改、不执行通用 down。
- 发布切换：保留上一应用构建物；schema 必须在回滚窗口内向后兼容。
- destructive action 前必须确认精确目标并完成备份/导出验证。

---

## 3. Goal 00 锁定的目录命名

这是执行的第一项，不是后续设计议题。Goal 00 必须先把下面目录树写入 accepted `PROJECT-STRUCTURE.md`，并完成现有文件的 100% 迁移映射；在此之前禁止移动源码。

### 3.1 最终顶层目录

```text
.
├── .github/                     # CI、发布工作流、CODEOWNERS
├── .specify/                    # Spec Kit 模板、constitution、工作流配置
├── apps/                        # 可运行应用
│   ├── api/                     # 唯一后端应用
│   └── web/                     # 唯一前端应用
├── packages/                    # 非独立部署的共享包
│   ├── contracts/               # API 契约与生成客户端类型
│   ├── database/                # PostgreSQL client/schema/repository 基础与唯一 migrations
│   ├── domain/                  # 无框架依赖的业务规则和值对象
│   └── test-kit/                # 脱敏 fixture builder 和测试基础设施
├── specs/                       # 每个 Goal/feature 的 SDD 工件
├── docs/                        # 长期文档
│   ├── product/                 # 产品、需求、路线图、已实现能力
│   ├── architecture/            # 当前架构、目录契约、运行拓扑、追踪关系
│   ├── adr/                     # 架构决策
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

### 3.2 API 内部目录

```text
apps/api/
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts                  # 进程入口，只负责启动/停止
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

每个后端模块按需使用：

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

没有真实职责的文件不创建。

### 3.3 Web 内部目录

```text
apps/web/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.ts
    ├── app/                     # app providers、App.vue、全局错误边界
    ├── router/                  # 路由定义和守卫
    ├── features/
    │   ├── identity/
    │   ├── projects/
    │   ├── project-workspace/
    │   ├── materials/
    │   ├── ai-services/
    │   └── change-governance/
    ├── entities/
    │   ├── project/
    │   ├── project-card/
    │   ├── material/
    │   └── change-proposal/
    └── shared/
        ├── api/
        ├── ui/
        ├── styles/
        └── lib/
```

前端依赖方向固定为：

`app/router → features → entities → shared`

### 3.4 Database 包

```text
packages/database/
├── package.json
├── tsconfig.json
├── migrations/                 # 唯一 PostgreSQL migration tree
│   ├── 0001_create_baseline_schema.sql
│   └── ...
└── src/
    ├── client/
    ├── schema/
    ├── migration/
    └── index.ts
```

### 3.5 最终禁止的顶层目录

重构完成后不得存在：

- `src/`
- `public/`
- `scripts/`
- `vendor/`
- `frontend/`
- `backend/`
- `legacy/`
- `common/`
- `utils/`
- `logs/`
- `data/`
- `fixtures/`
- `.planning/`

迁移期间这些现有目录只允许被冻结、映射和删除，不允许继续增加新能力。不得创建 `legacy/` 收纳旧代码；旧代码留在原位直到被对应 Goal 删除。

### 3.6 文档目标文件名

```text
docs/product/PRODUCT.md
docs/product/REQUIREMENTS.md
docs/product/ROADMAP.md
docs/product/IMPLEMENTED.md
docs/architecture/README.md
docs/architecture/PROJECT-STRUCTURE.md
docs/architecture/MIGRATION-MAP.md
docs/architecture/SYSTEM.md
docs/architecture/TRACEABILITY.md
docs/architecture/AI-SYSTEM.md
docs/engineering/TESTING-STANDARDS.md
docs/engineering/PERFORMANCE-BUDGETS.md
docs/engineering/SECURITY-STANDARDS.md
docs/operations/RUNBOOK.md
docs/operations/BACKUP-RESTORE.md
docs/operations/RELEASE.md
docs/changes/DESIGN-CHANGELOG.md
docs/changes/EXECUTION-STATE.md
docs/changes/HANDOFF.md
```

---

## 4. 全局边界

### 4.1 必须保持的产品不变量

- 多项目和项目成员/角色权限。
- `project_cards` / `project_card_links` 继续是版本化项目图唯一模型。
- `xugu-agentic-group` 作为业务项目 stable external ID 保留，名称不代表数据库技术。
- 材料、证据、问答、生成任务、审核、版本和权限按 `projectId` 隔离。
- LLM 只生成有来源的结构化 `ChangeProposal`。
- AI 不直接写 draft/published，不审核、不发布、不执行代码。
- 人工审核、copy-on-write draft、发布、直接前驱回滚和追加审计语义保留。

### 4.2 明确不做

- 不迁移旧虚谷数据。
- 不保留虚谷兼容模式、驱动、Worker、镜像或发布包。
- 不同时维护两套正式 UI、API 或 migration tree。
- 不在重构中新增产品功能。
- 不改造为微服务。
- 不引入 Kubernetes、Redis、MQ、对象存储或独立前端服务。
- 不追求一次性大爆炸提交；按 Goal 可验证切换。

### 4.3 工程预算

| 指标 | 成功门槛 |
|---|---:|
| tracked 日志/诊断/密钥/数据 | 0 |
| TypeScript errors | 0 |
| lint errors | 0 |
| 循环依赖 | 0 |
| API schema 覆盖 | 100% |
| project isolation 关键负面测试 | 100% 通过 |
| 必需运行服务 | ≤ 2 |
| 应用空闲 RSS | ≤ 256 MiB |
| app + PostgreSQL 空闲 RSS | 目标 ≤ 768 MiB |
| 登录页首屏 JS | ≤ 150 KiB gzip |
| 登录后 shell JS | ≤ 250 KiB gzip |
| 单路由异步 chunk | ≤ 180 KiB gzip |
| 首屏 CSS | ≤ 90 KiB gzip |
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| 普通源文件 | 软上限 300 行、硬上限 500 行 |

预算在 Goal 02 建立实测基线后可收紧；放宽必须 ADR + 用户确认。

---

## 5. 路标监测板

执行 Agent 必须在 `docs/changes/EXECUTION-STATE.md` 维护下表；每个 Goal 结束更新一次。

| 路标 | 首次建立 | 目标 | 最终检查 |
|---|---|---:|---|
| 当前文件迁移映射覆盖率 | G00 | 100% | G18 |
| 文档 canonical 冲突数 | G01 | 0 | 每个 Goal |
| 现有功能基线可重复率 | G02 | 100% | G18 |
| 目标目录结构合规率 | G03 | 100% | G18 |
| TypeScript strict errors | G03 | 0 | 每个代码 Goal |
| PostgreSQL migration 空库重放 | G04 | PASS | G18 |
| API contract 覆盖率 | G05 | 100% 新路由 | G10 |
| 后端模块迁移比例 | G06 | 逐 Goal 更新 | G10 = 100% |
| 虚谷运行代码引用数 | G10 | 0 | G18 |
| Vue 正式路由迁移比例 | G12 | 逐 Goal 更新 | G16 = 100% |
| 旧前端运行文件数 | G16 | 0 | G18 |
| bundle 预算 | G11 | PASS | G16/G18 |
| 默认运行服务数 | G17 | ≤ 2 | G18 |
| 发布包 forbidden artifact | G17 | 0 | G18 |
| 需求到测试追踪覆盖 | G18 | 100% | G18 |

任一路标连续两个 Goal 恶化，必须停止下一个 Goal，先建立 gap-closure Goal 修复。

---

## 6. 工程编码与命名规范

本章是重构期间的内嵌工程规范，不再维护独立的 `CODING-STANDARDS.md`。G01 必须把不可变原则同步到 constitution，把可机械执行的规则落入 lint、类型检查、依赖检查和 CI；任何放宽都必须先写 ADR 并经用户确认。

权威顺序：

`AGENTS → 本计划 → constitution → accepted ADR → architecture → feature spec/plan/tasks → code/tests`

### 6.1 编写思想和变更顺序

统一工作流：

`Intent → Spec → Contract → Design → Tasks → Code → Verification → Result`

- 先写用户结果、业务不变量、边界和失败语义，再选择框架 API。
- 目录、API、数据模型、状态机和跨模块依赖变化，必须先更新设计 Markdown，并在 `DESIGN-CHANGELOG` 追加“改了什么、为什么改、影响什么、如何回滚”。
- 代码只能实现已确认的设计；不得以既有实现反向覆盖设计。
- 按可演示的垂直切片交付，切片可同时包含 UI、API、领域、数据库和测试。
- 采用模块化单体：一个应用部署单元、一个 PostgreSQL；没有容量证据和 ADR 不新增运行服务。
- 外部输入在 HTTP、数据库、文件、环境变量、AI Provider 等边界一次性校验和规范化；内部只使用明确类型。
- 权限、`projectId` 隔离、事务、状态转换和副作用必须显式可见；默认 fail closed。
- 优先使用 Vue、Fastify、Kysely、TanStack Query、Element Plus 等框架能力，不重复造框架已有能力。
- 相同实现第三次出现且语义一致时才抽象；禁止建立 `utils`、`helpers`、`common`、`misc`、`base` 杂物桶。
- 兼容层必须标明 spec/task、删除条件和最晚删除 Goal；正式切换后在同一阶段删除旧实现。

### 6.2 通用语言和标识符

- 文件、目录、代码标识符、API 字段和数据库对象使用英文；用户界面和面向用户的业务文档使用中文。
- 缩写按普通单词处理：`projectId`、`apiClient`、`httpServer`、`csrfToken`、`aiProvider`。
- 变量和函数使用 `camelCase`；类型、类和 Vue 组件使用 `PascalCase`；常量使用 `SCREAMING_SNAKE_CASE`。
- 布尔值使用 `is/has/can/should` 前缀；集合使用复数名词；Map 使用 `<value>By<key>`。
- 数量使用 `<noun>Count`；时间点使用 `At`；时长必须带单位，如 `timeoutMs`、`retentionDays`；ID 使用 `Id` 后缀。
- 避免 `data`、`info`、`item`、`obj`、`temp`、`result`、`value` 等无语义名称；只允许在极小且语义显然的局部作用域使用。
- 函数名采用动词加业务对象：`createProject`、`publishDraftVersion`。查询统一使用 `get`（必须存在）、`find`（可不存在）、`list`、`count`。
- 禁止模糊动词 `process`、`handle`、`do`、`manage`、`execute`，除非是领域正式术语。

### 6.3 文件和目录命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 普通 TypeScript 文件 | `kebab-case.ts` | `project-service.ts` |
| Vue 组件 | `PascalCase.vue` | `ProjectCardTable.vue` |
| 目录 | `kebab-case` | `change-proposals/` |
| 业务模块 | 复数资源名 | `projects/`, `materials/` |
| 单元/组件测试 | 与目标同名 `*.test.ts` | `project-service.test.ts` |
| E2E 测试 | 业务旅程 `*.spec.ts` | `review-and-publish.spec.ts` |
| SQL migration | `NNNN_<imperative_description>.sql` | `0001_create_baseline_schema.sql` |

- 一个文件只承担一个主要职责，文件名必须包含可识别的职责。
- `index.ts` 只暴露模块公共 API，不产生隐式注册副作用；禁止全工程 barrel。
- 相对导入只用于同一 feature/module；跨包使用 workspace package 名。
- 禁止深层导入其他模块的 repository、internal 或测试文件；禁止循环依赖。

### 6.4 前端目录、依赖和命名

```text
apps/web/src/
├── app/                 # 启动、全局 provider、错误边界
├── router/              # 路由和守卫
├── features/            # 可交付业务能力
├── entities/            # 稳定业务实体展示模型
└── shared/
    ├── api/             # API client 与查询基础设施
    ├── ui/              # 无业务语义基础组件
    ├── styles/          # token、reset、全局布局
    └── lib/             # 少量、职责明确的领域无关库
```

依赖方向为 `app/router → features → entities → shared`。下层不得导入上层；feature 不得直接导入另一 feature 的内部文件；`shared/ui` 不得请求 API、读取路由或包含业务判断。

| 类型 | 规则 | 示例 |
|---|---|---|
| 路由页面 | `View` 后缀 | `ProjectOverviewView.vue` |
| 布局 | `Layout` 后缀 | `ProjectWorkspaceLayout.vue` |
| 对话框 | `Dialog` 后缀 | `PublishProjectDialog.vue` |
| 表单/表格/面板 | `Form/Table/Panel` | `ProjectMemberTable.vue` |
| 状态展示 | `State` 后缀 | `EmptyProjectState.vue` |
| composable | `use` 前缀 | `useProjectAccess.ts` |
| Pinia store | `use...Store` | `useAuthStore.ts` |
| 查询 key 工厂 | `...Keys` | `projectKeys.ts` |
| API 封装 | `...Api` | `projectApi.ts` |

- 组件名至少两个单词；Props 在脚本中用 `camelCase`、模板中用 `kebab-case`。
- emit 表达已发生事件，如 `saved`、`cancelled`、`selectionChanged`；事件处理函数表达意图，如 `submitReviewDecision`。
- URL 使用复数名词和 `kebab-case`；路由名使用点分层级，如 `projects.detail.overview`。
- 路由组件必须懒加载；图表、甘特和预览器二次懒加载。
- TanStack Query 是服务端状态唯一缓存；Pinia 仅保存认证和纯客户端跨页面状态；临时表单/弹窗状态留在组件内。
- 禁止把同一份服务端数据同时复制到 Query cache、Pinia 和组件 state；query key 由集中工厂生成。
- 颜色、字号、间距、圆角、阴影和层级只能来自 design token；Element Plus 按需导入并由唯一主题入口覆盖。
- 禁止业务组件写全局 selector、散落内联 style 和无说明的 `!important`；动态几何值使用 CSS variable。

### 6.5 后端模块和编码边界

```text
apps/api/src/modules/projects/
├── index.ts
├── project.routes.ts
├── project.schemas.ts
├── project.service.ts
├── project.repository.ts
├── project.mapper.ts
├── project.errors.ts
└── project.types.ts
```

- `routes` 只处理 HTTP 协议、schema、认证/权限入口和响应映射。
- `schemas` 保存请求/响应 JSON Schema 及派生类型；所有 route 必须声明 request/response schema。
- `service` 编排用例和事务边界；`repository` 只处理 Kysely 查询与持久化；`mapper` 只做纯转换。
- `errors` 定义稳定错误类型和错误码；`types` 只放无法从 schema 或数据库派生的类型。
- 没有真实职责时不得创建空层；模块唯一公开入口是自己的 `index.ts`。
- 默认使用纯函数和显式依赖；仅在生命周期或封装可变资源时使用类。
- Fastify plugin 组装数据库、配置、日志和模块；service/repository 不读取 `process.env`。
- 配置在启动边界解析一次，形成只读 typed config；测试通过显式依赖替换，不做全局 monkey patch。
- Promise 必须 await、return，或明确 `void` 且处理失败；禁止丢失错误的 fire-and-forget。
- 每个业务用例只有一个清晰事务入口；repository 不隐式嵌套事务；外部 API 调用不得处于长数据库事务中。

### 6.6 API 契约和命名

- 基础前缀固定为 `/api/v1`；资源使用复数名词，路径使用 `kebab-case`，JSON 字段使用 `camelCase`。
- CRUD 使用 HTTP method，不在 URL 重复 `create/get/update/delete`；领域动作使用明确子资源，如 `POST /projects/:projectId/releases`。
- ID 字段统一 `<resource>Id`；分页统一请求 `cursor/limit`、响应 `items/nextCursor`；时间统一 ISO 8601 UTC。
- 空集合返回 `[]`；可选字段缺失和显式 `null` 必须在 schema 中区分。
- mutation 默认不自动重试；需要幂等时使用 `Idempotency-Key` 或明确业务 key。
- 错误结构固定为 `{ "error": { "code", "message", "requestId", "details" } }`。
- 错误码使用 `SCREAMING_SNAKE_CASE` 且发布后兼容；未授权项目返回 not-found 语义，避免泄露存在性。
- 错误消息不得包含内部异常、SQL、路径、凭据或供应商原始响应。

### 6.7 PostgreSQL 规则

| 对象 | 规则 | 示例 |
|---|---|---|
| schema | 单数 `snake_case` | `app`, `audit` |
| table | 复数 `snake_case` | `project_cards` |
| column | `snake_case` | `project_id`, `created_at` |
| primary key | `pk_<table>` | `pk_projects` |
| foreign key | `fk_<table>__<target>` | `fk_project_cards__projects` |
| unique | `uq_<table>__<columns>` | `uq_projects__external_id` |
| check | `chk_<table>__<meaning>` | `chk_project_versions__status` |
| index | `idx_<table>__<columns>` | `idx_project_cards__project_id_version_id` |

- 主键统一 `id`；外键统一 `<target_singular>_id`；稳定业务 ID 使用明确字段，如 `external_id`。
- 时间列统一 `created_at`、`updated_at`，仅在语义需要时使用 `archived_at/deleted_at`。
- JSON 仅用于确实可变或类型特有的数据；公共可查询字段必须列化。
- PostgreSQL 是唯一数据库和测试后端；禁止虚谷兼容层、第二迁移树、双写和生产 fallback。
- 已发布 migration 不可修改；使用 expand → migrate → contract 保留应用回滚窗口。
- destructive migration 必须独立 task、备份、数据验证和人工门禁；seed 与 schema migration 分离。

### 6.8 测试、日志、注释和依赖

- 测试标题使用行为语言；一个测试验证一个主要行为；固定时间、UUID、随机数和外部响应。
- 使用脱敏、最小、语义明确的 fixture；API 测试使用 Fastify inject，数据库测试使用真实 PostgreSQL，关键旅程使用 Playwright。
- 日志字段用 `camelCase`，至少含适用的 `requestId`、`projectId`、`durationMs`、`errorCode`。
- 禁止记录 Authorization、Cookie、API Key、数据库 URL、材料正文、完整 prompt 或 Provider 原始响应。
- 运行日志与业务审计分离；审计事件使用点分名词，如 `project.published`。
- 公共 API、复杂状态机、数据库不变量和安全边界需要说明“为什么”和 spec/ADR 来源。
- TODO 格式为 `TODO(SPEC-123/T045): reason and removal condition`；禁止无编号 TODO、注释掉的代码和复制的历史实现。
- 新增依赖前记录用途、替代方案、bundle/runtime 影响、维护状态和许可证；不为一行工具函数引入大型依赖。

### 6.9 自动门禁和评审清单

G03 前必须建立并在后续持续执行：

- ESLint：TypeScript/Vue、命名、未处理 Promise、禁止导入和复杂度。
- Prettier/Stylelint：格式、CSS 和 token 使用规则。
- TypeScript/Vue TSC：strict 类型检查。
- 依赖图检查：模块方向、循环依赖和深层导入。
- naming check：文件、目录、migration、测试和数据库对象。
- contract check：所有 API route 的请求/响应 schema。
- doc governance：受治理的目录/API/数据模型变化必须伴随设计和 changelog。
- artifact check：拒绝日志、诊断、coverage、测试报告、密钥和数据库数据进入 Git。
- size check：源文件、前端 bundle、运行内存和服务数预算。

任何 `eslint-disable`、类型忽略或门禁例外必须最小范围并引用 spec/task；全局关闭规则需要 ADR。每次评审必须回答：

1. 是否交付当前 spec 的用户结果？
2. 命名和模块边界是否表达业务语义？
3. 是否出现第二实现、无期限 fallback 或杂物桶目录？
4. 外部输入、权限、项目隔离、事务和副作用是否显式且 fail closed？
5. 前端是否重复保存服务端状态或全量加载重模块？
6. 是否新增不必要的依赖或运行服务？
7. 日志是否脱敏且不会进入 Git？
8. 测试是否覆盖成功、失败、权限和跨项目场景？
9. 设计、变更记录、任务、验证和结果是否同步？

## 7. Goal 路线图

| Goal | 名称 | 依赖 | 主要退出物 |
|---|---|---|---|
| G00 | 锁定目录命名和迁移映射 | 无 | accepted 目录契约、100% mapping |
| G01 | 建立跨 Agent 工程治理 | G00 | constitution、规范、ADR、启动协议 |
| G02 | 冻结行为与资源基线 | G01 | 可重复测试/API/资源基线 |
| G03 | 建立 workspace walking skeleton | G02 | Node22/TS/workspaces/CI 骨架 |
| G04 | 建立 PostgreSQL 唯一数据基线 | G03 | schema、migrations、fixture、恢复验证 |
| G05 | 建立 Fastify 平台基础 | G04 | app/plugins/OpenAPI/health/error contract |
| G06 | 迁移身份、项目和成员 API | G05 | identity/projects modules |
| G07 | 迁移项目图和版本 API | G06 | project-graph module |
| G08 | 迁移材料、证据和 AI API | G07 | materials/ai-services modules |
| G09 | 迁移审核、发布和运维 API | G08 | change-governance/operations modules |
| G10 | 切换新 API/PG 并删除虚谷后端 | G09 | 唯一 Fastify + PostgreSQL runtime |
| G11 | 建立 Vue 壳和设计系统 | G10 | web skeleton、tokens、component baseline |
| G12 | 迁移认证、设置、项目列表 UI | G11 | 第一批正式 Vue journeys |
| G13 | 迁移项目工作区和项目图 UI | G12 | overview/roadmap/units/gantt/health |
| G14 | 迁移材料、证据和 AI UI | G13 | materials/readiness/generation/chat |
| G15 | 迁移审核、发布、回滚和审计 UI | G14 | governance journeys |
| G16 | 切换 Vue 并删除旧前端 | G15 | 唯一 Vue UI、旧 public 删除 |
| G17 | 收口运维、发布、备份恢复 | G16 | 两服务拓扑、一条命令运维 |
| G18 | 最终一致性审计和交付 | G17 | 全量验证、追踪、最终文档 |

---

## 8. Goal 详细执行合同

### G00：锁定目录命名和迁移映射

**Objective**：在不移动任何源码的前提下，确认最终目录树、目录职责、命名语法和依赖方向，并将当前每个 tracked 文件映射为 keep/move/replace/delete/generated 中唯一一种结果。

**允许修改**：`docs/REFACTOR-PLAN.md`、新建 `docs/architecture/PROJECT-STRUCTURE.md`、`docs/architecture/MIGRATION-MAP.md`、现有 PROCESS/STATE/HANDOFF。

**禁止**：移动/重命名/删除源码；修改 package 依赖；创建 apps/packages 代码；修改数据库。

**步骤**：

1. 用 `rg --files` 生成当前 tracked 文件清单。
2. 把第 3 节目录树写入 `PROJECT-STRUCTURE.md`。
3. 写明每个目录的 owner、允许内容、禁止内容和依赖方向。
4. 建立 current path → target path/action → reason → owner → Goal ID 映射表。
5. 对所有 tracked 文件做覆盖检查，不允许未映射或重复映射。
6. 明确最终禁止目录和删除 Goal。
7. 让用户确认目录命名；记录 approval。

**路标**：R00.1 顶层命名锁定；R00.2 内部目录锁定；R00.3 mapping 100%；R00.4 用户确认。

**成功**：mapping 覆盖率 100%；同一职责只有一个目标目录；依赖图无环；没有 `legacy/common/utils` 目标目录；用户明确确认。

**失败**：在确认前移动代码；任何文件未映射；同一文件有两个目标；目录职责使用“其他/通用/临时”。

**验证证据**：文件总数、mapping 行数、未映射=0、重复=0、用户确认记录、`git diff --check`。

**解锁**：仅 G01。

### G01：建立跨 Agent 工程治理

**Objective**：让新 Agent 在没有聊天上下文时，仅靠仓库恢复相同的编码思想、命名、目录、决策和执行流程。

**允许修改**：`AGENTS.md`、`.specify/`、`docs/**`、`specs/`、现有 `.planning` 的迁移/清理。

**禁止**：修改应用源代码、依赖、数据库、运行脚本。

**步骤**：

1. 建立 `.specify/memory/constitution.md`。
2. 将本文件第 6 章的原则固化到 constitution，并把可机械执行的规则写入门禁配置。
3. 建立 testing/performance/security standards。
4. 把 `.planning` 产品、决策、设计、过程内容映射到第 3.6 节新位置。
5. 将冲突决策改为 superseded，不复制两份 canonical 内容。
6. 记录 PostgreSQL 替代虚谷、模块化单体、两服务运维 ADR。
7. 更新 AGENTS 强制阅读顺序和会话结束协议。
8. 建立 Spec Kit Goal 模板、verification 模板和变更记录模板。

**路标**：R01.1 constitution；R01.2 standards accepted；R01.3 ADR 完成；R01.4 AGENTS 可独立导航；R01.5 文档冲突=0。

**成功**：新 Agent 只读文档可准确说出目标目录、命名、唯一数据库、运行服务上限、当前 Goal 和禁止事项；所有 canonical 文档有唯一 owner。

**失败**：`.planning` 与新 docs 同时继续作为权威；AGENTS 仍指向失效路径；规范只写原则没有可执行例子/门禁。

**验证**：独立 fresh-context walkthrough；链接检查；文档冲突扫描；`git diff --check`。

**解锁**：仅 G02。

### G02：冻结行为与资源基线

**Objective**：在重构前建立可重复的产品行为、API、数据库语义、发布和资源基线，作为所有后续 Goal 的回归标准。

**允许修改**：baseline spec、测试说明、脱敏测试夹具、只读测量脚本；必要时只修测试基础设施，不改产品行为。

**禁止**：业务重构、目录迁移、换数据库、改 UI。

**步骤**：

1. 运行当前 verify、Node、真实数据库、主 UI、异常输入和 audit。
2. 导出现有 API method/path/auth/error/response inventory。
3. 记录核心业务旅程和稳定 ID/版本关系。
4. 测量 JS/CSS 体积、启动时间、Node RSS、请求延迟和运行服务数。
5. 建立 tracked forbidden artifact 和 secret 基线。
6. 记录已知失败、flaky、平台限制；不得伪造绿灯。

**路标**：R02.1 tests；R02.2 API inventory；R02.3 domain invariants；R02.4 performance；R02.5 release inventory。

**成功**：基线命令在 clean checkout 可重复；现有核心旅程均有测试或明确 gap；所有测量有环境和命令。

**失败**：为获得绿灯删除断言；使用开发数据库；把历史测试报告提交 Git；不记录失败环境。

**验证**：`BASELINE.md` + 命令输出摘要；测试结果；资源表；gap list。

**解锁**：仅 G03。

### G03：建立 workspace walking skeleton

**Objective**：按 accepted 目录创建最小 Node22/TypeScript/npm workspaces 骨架，完成 build/lint/typecheck/test/structure/doc/artifact 门禁，但不迁移业务功能。

**允许修改**：根配置、`apps/api` 最小 health、`apps/web` 最小页面、`packages/*` 空但有职责的入口、CI、开发工具。

**禁止**：复制现有业务到新目录；正式切流；创建空洞层级；引入运行中间件。

**步骤**：

1. 建 npm workspaces 和 Node22 engines。
2. 配 TypeScript strict、ESLint、Prettier、Stylelint、Vue TSC、Vitest。
3. 建 structure/naming/dependency/doc/artifact 检查。
4. 建 API `/health/live` 和 Web skeleton。
5. 建 clean checkout 一键 verify。
6. 记录 dependency inventory 和许可证。

**路标**：R03.1 workspaces；R03.2 TS strict；R03.3 CI；R03.4 walking skeleton；R03.5 budgets 初始门禁。

**成功**：`npm ci && npm run verify` 在 clean checkout 通过；TypeScript/lint/循环依赖=0；目标结构合规 100%；旧应用仍未切换。

**失败**：引入 Nx/Turbo；为了过 lint 全局 disable；新建无内容的所有模块文件；改变用户功能。

**验证**：CI/本地输出、structure report、dependency graph、skeleton smoke。

**解锁**：仅 G04。

### G04：建立 PostgreSQL 唯一数据基线

**Objective**：从业务不变量重建 PostgreSQL 18 schema、唯一 migration tree、Kysely 类型和脱敏 fixture；不迁移旧虚谷数据。

**允许修改**：`packages/database`、`packages/domain`、`packages/test-kit`、`tests/integration`、`ops/compose.yaml` 的 PostgreSQL 服务、数据库文档/ADR。

**禁止**：运行时双写；保留第二 PG schema；导入真实/旧虚谷数据；修改项目图语义。

**步骤**：

1. 从需求和当前代码提取 canonical entities/constraints。
2. 设计 `0001_create_baseline_schema.sql`。
3. 使用 UUID、timestamptz、jsonb 和真实 FK/UNIQUE/CHECK。
4. 保持 `project_cards/project_card_links` 唯一项目图。
5. 建 Kysely DB 类型、client 和 transaction primitive。
6. 建最小脱敏 fixture，保留 stable external ID。
7. 测空库重放、重复运行保护、中文/JSON/时间/事务/并发。
8. 测 `pg_dump -Fc`、checksum、`pg_restore` 到新库和业务对账。

**路标**：R04.1 model；R04.2 migration；R04.3 constraints；R04.4 fixture；R04.5 backup/restore。

**成功**：空库 migration PASS；所有业务不变量有 DB 或应用边界；备份恢复后数量/关系/checksum 对账 PASS；只有一个 migration tree。

**失败**：把 CLOB/JSON 字符串机械照搬；无约束 JSON 堆积；迁移真实数据；down migration 破坏数据；连接池泄漏。

**验证**：schema review、migration tests、integration tests、restore report、query/index rationale。

**解锁**：仅 G05。

### G05：建立 Fastify 平台基础

**Objective**：建立唯一新 Fastify app 的组装、配置、数据库、认证接口、错误契约、日志脱敏、OpenAPI、静态资源和生命周期基础。

**允许修改**：`apps/api/src/app|config|plugins`、`packages/contracts`、对应 contract/integration tests。

**禁止**：迁移业务模块；正式切换旧 server；新增 Redis/MQ；直接读取旧 repository。

**步骤**：

1. 建 `build-app` 和 `main` 生命周期。
2. 一次性 typed config 解析；模块不得读 process.env。
3. 注入 PostgreSQL pool/Kysely。
4. 建 requestId、Pino redaction、统一 error envelope。
5. 建 security headers、CSRF/session hook、rate-limit 插槽。
6. 建 OpenAPI 和 schema coverage 检查。
7. 建 live/ready/version/migration-state endpoints。
8. 建 graceful shutdown 和连接池释放。

**路标**：R05.1 app；R05.2 config；R05.3 errors/logging；R05.4 OpenAPI；R05.5 lifecycle。

**成功**：新路由 schema 100%；启动/停止无资源泄漏；日志无敏感字段；health 能区分 live/ready；Fastify inject tests PASS。

**失败**：route 自行解析 env；日志输出 header/body；所有逻辑塞进 app.ts；健康检查在 DB 不可用时仍 ready。

**验证**：contract tests、redaction tests、shutdown tests、OpenAPI artifact comparison。

**解锁**：仅 G06。

### G06：迁移身份、项目和成员 API

**Objective**：在新 Fastify/PostgreSQL 上实现 identity、projects、members 的行为等价 API 和权限边界。

**允许修改**：API `identity/projects` modules、domain/database 对应代码、contracts/tests。

**禁止**：迁移项目图/材料/AI；改变角色语义；前端改造。

**步骤**：锁定 contract → 实现 repository/service/routes → 认证/session/CSRF → 角色矩阵 → project not-found 隐藏 → contract parity。

**路标**：登录/登出/改密；项目 CRUD；成员；跨项目负面矩阵；审计。

**成功**：所有身份/项目 API 有 schema；密码/session/CSRF/限流正确；未授权项目不泄露；contract 和 PostgreSQL integration PASS。

**失败**：角色放宽；跨项目可枚举；route 直接 SQL；API 字段临时混用 snake_case。

**验证**：permission matrix、contract tests、real PG tests、audit assertions。

**解锁**：仅 G07。

### G07：迁移项目图和版本 API

**Objective**：迁移 project-graph、版本、模块读取、draft 更新和导入导出语义，保持 stable ID 和图关系。

**允许修改**：`project-graph` module、domain/database/contracts/tests。

**禁止**：第二项目模型；旧关系表；改变 card/link 唯一真相；UI 改造。

**步骤**：建立 graph domain invariants → repository → version clone → module envelope → import/export fixture → cycle/date/dependency validation。

**路标**：cards；links；versions；clone；module API；semantic round trip。

**成功**：stable external IDs 保留；父子/依赖/阶段/日期无损；draft/published 隔离；图循环和跨项目链接被拒绝。

**失败**：出现第二图表；JSONB 代替公共列；版本更新原地覆盖；导入导出语义不等价。

**验证**：golden fixture、round-trip、transaction rollback、graph property tests。

**解锁**：仅 G08。

### G08：迁移材料、证据和 AI API

**Objective**：迁移 materials、evidence、readiness、generation、chat，保持项目隔离、来源约束和 AI 无工具权限。

**允许修改**：`materials/ai-services` modules、storage adapter、contracts/tests。

**禁止**：对象存储；独立 worker 服务；AI 写 draft/published；Provider 硬编码。

**步骤**：材料元数据/文件边界 → processing task 持久化 → evidence → readiness snapshot → bounded context → provider adapter → proposal schema → chat。

**路标**：upload/manual；extract；evidence；readiness；generation；retry；chat；quota。

**成功**：文件/证据/任务按 projectId 隔离；任务重启可恢复；所有 ChangeProposal 可追溯；provider config 用户化且脱敏。

**失败**：fire-and-forget 丢任务；记录原始材料/prompt；AI 直接写版本；引入 Redis/MQ；跨项目 evidence 引用。

**验证**：real file tests、restart recovery、provider no-tools tests、schema/evidence/isolation tests。

**解锁**：仅 G09。

### G09：迁移审核、发布和运维 API

**Objective**：迁移 change-governance 和 operations，完成逐项审核、draft merge、preview、publish、rollback、audit、diagnostics 的新后端闭环。

**允许修改**：`change-governance/operations` modules、domain/database/contracts/tests。

**禁止**：自动审核/发布；修改回滚语义；把运行日志当审计。

**步骤**：review item state machine → module accept → transactional merge → preview token → publish → direct-predecessor rollback → audit → safe diagnostics。

**路标**：review；merge；preview；publish；history；rollback；audit；diagnostics。

**成功**：权限和二次确认正确；draft/published 不变量成立；并发版本冲突安全失败；审计追加不可变；诊断脱敏。

**失败**：AI/普通编辑直接 publish；回滚任意历史版本；审计可更新删除；错误包泄露 SQL/密钥/路径。

**验证**：state-machine tests、transaction/concurrency tests、full backend journey、security review。

**解锁**：仅 G10。

### G10：切换新 API/PG 并删除虚谷后端

**Objective**：让正式 server 只运行 Node22/Fastify/PostgreSQL，随后在同一 Goal 删除虚谷运行代码、二进制、迁移和旧 HTTP app。

**允许修改**：server/start scripts、旧 `src` 后端、vendor、package、tests、ops minimal start、文档。

**禁止**：保留 runtime database switch；旧/new API 双正式入口；声明尚未验证的平台。

**步骤**：全 backend parity → preview smoke → freeze → switch entry → run full tests → remove Xugu/old HTTP → remove Node20 → scan forbidden refs → rerun full tests。

**路标**：R10.1 parity；R10.2 switch；R10.3 Xugu refs=0；R10.4 Node22 only；R10.5 full backend PASS。

**成功**：唯一 runtime=Fastify+PG；`vendor/xugudb`、xugu worker/database/migrations 生命周期不存在；API contract coverage 100%；旧 Vue 前端仍能使用新 API。

**失败**：保留环境开关；删除前 parity 不完整；切换后核心旅程失败；Xugu 二进制/驱动仍进发布。

**验证**：`rg` forbidden scan、full Node/API/PG tests、旧前端 browser smoke、package/release inventory。

**解锁**：仅 G11。

### G11：建立 Vue 壳和设计系统

**Objective**：建立唯一新 Vue 应用壳、路由、typed API client、状态策略、Element Plus 主题和通用交互状态，不迁移复杂业务页面。

**允许修改**：`apps/web` app/router/shared/entities 基础、contracts client、component tests、design docs。

**禁止**：正式切换；全量导入 Element Plus；复制旧 CSS；业务数据硬编码。

**步骤**：Vite/Vue → router → app providers → Query/Pinia → generated API → tokens → AppShell → error/loading/empty/toast/dialog → a11y/performance harness。

**路标**：R11.1 shell；R11.2 theme；R11.3 API；R11.4 state；R11.5 budgets。

**成功**：路由懒加载；Element 按需；server state 不复制；组件可访问；登录 shell bundle 预算 PASS；新 UI 仅 preview。

**失败**：第二套主题；旧 styles.css 直接搬入；全局 Pinia 存所有数据；Element 全量 import；正式用户看到混合皮肤。

**验证**：component tests、axe、bundle report（artifact only）、keyboard/responsive review。

**解锁**：仅 G12。

### G12：迁移认证、设置和项目列表 UI

**Objective**：迁移 login/logout/password/settings/projects/members，完成第一批端到端 Vue 业务旅程。

**允许修改**：对应 web features/entities、API queries、E2E。

**禁止**：项目工作区/材料/审核；改变 API；混用旧组件。

**步骤**：认证 route/query → 登录/退出 → 强制改密 → AI 设置与脱敏 → 项目列表/创建/归档 → 成员与角色 → 错误/空态/加载态 → responsive/a11y。

**路标**：auth；password；settings；projects；members；error states。

**成功**：功能/权限/异常等价；键盘和响应式 PASS；新页面使用统一组件/token；E2E PASS。

**失败**：设置页泄露 key；前端自行猜权限；复制旧 DOM renderer；新旧表单样式并存。

**验证**：component + E2E + a11y + bundle delta。

**解锁**：仅 G13。

### G13：迁移项目工作区和项目图 UI

**Objective**：迁移 project shell、overview、roadmap、units、gantt、outcomes、risks、metrics、health。

**允许修改**：project-workspace features/entities/shared visualization、E2E。

**禁止**：迁移 materials/governance；一次加载完整无界数据；自造通用 UI 库。

**步骤**：shell/deep links → overview → roadmap → units → gantt → outcomes/risks/metrics → health → responsive/performance。

**路标**：每个 renderer 对应一项；迁移一项、验证一项，不批量删除旧 renderer。

**成功**：路由/deep link 等价；大表分页/虚拟化；项目图关系显示正确；每个视图有 loading/empty/error；资源预算 PASS。

**失败**：把 2827 行 renderer 改写成一个巨型 Vue 文件；全量深响应项目图；视觉/术语跨项目泄漏。

**验证**：view E2E、visual review、large fixture performance、route chunk report。

**解锁**：仅 G14。

### G14：迁移材料、证据和 AI UI

**Objective**：迁移材料上传/录入/详情/证据/readiness/生成任务/问答。

**允许修改**：materials/ai-services web features、E2E。

**禁止**：审核发布 UI；浏览器直连 Provider；记录材料原文到日志。

**步骤**：材料列表/上传/手工录入 → 材料详情/处理状态 → evidence 搜索与定位 → readiness → generation task/retry → proposal 入口 → project chat → 异常输入/刷新恢复。

**路标**：R14.1 materials；R14.2 evidence；R14.3 readiness；R14.4 generation/retry；R14.5 chat；R14.6 abnormal/isolation。

**成功**：上传与异常输入、安全提示、readiness、生成/retry、证据跳转和问答完整；刷新后任务状态可恢复；跨项目隔离 PASS。

**失败**：Key 到客户端；浏览器拼 prompt；任务状态只在内存；文件无限制预览加载。

**验证**：file matrix、abnormal inputs、network assertions、E2E、memory/bundle checks。

**解锁**：仅 G15。

### G15：迁移审核、发布、回滚和审计 UI

**Objective**：迁移 proposal review、逐项编辑、merge preview、publish confirm、history、rollback、audit 和 diagnostics。

**允许修改**：change-governance web feature、E2E。

**禁止**：改变后端状态机；自动接受；弱化二次确认。

**步骤**：proposal 列表/详情 → review item diff/evidence → accept/reject/edit → module batch accept → merge preview → publish confirm → history/rollback → audit/diagnostics → 权限/并发/失败状态。

**路标**：R15.1 proposal/review；R15.2 evidence/diff；R15.3 merge preview；R15.4 publish；R15.5 rollback/history；R15.6 audit/diagnostics。

**成功**：原值/建议值/证据/语义/置信度可见；逐项决策；preview/publish/rollback/audit 完整；权限和并发错误友好展示。

**失败**：发布按钮绕过 preview token；证据不可追踪；错误后 UI 假成功；审计可编辑。

**验证**：full governance E2E、role matrix、concurrency/error states、a11y。

**解锁**：仅 G16。

### G16：切换 Vue 并删除旧前端

**Objective**：正式入口切换到 Vue 构建产物，在同一 Goal 删除 `public/app.js`、`public/modules`、旧 CSS 和旧兼容路由。

**允许修改**：web/API static serving、旧 public、packaging minimal、tests/docs。

**禁止**：长期 feature flag；保留第二正式 UI；删除测试以过门禁。

**步骤**：route parity 100% → preview UAT → build → switch static root → full browser → delete old UI → scan → full browser again。

**路标**：R16.1 parity；R16.2 cutover；R16.3 legacy UI files=0；R16.4 bundle PASS；R16.5 E2E PASS。

**成功**：唯一 UI=Vue；旧 public runtime 文件为 0；所有主/异常/权限旅程通过；无混合皮肤；预算 PASS。

**失败**：保留 `?legacy`/fallback；旧 CSS 仍影响新 UI；正式路由部分落旧 renderer；测试覆盖下降。

**验证**：forbidden scan、full Chromium、responsive/a11y、bundle report、visual review。

**解锁**：仅 G17。

### G17：收口运维、发布、备份恢复

**Objective**：用同一个 app artifact 支持 compact 两服务和 external DB 单服务，统一七个运维入口并完成新机、升级、备份恢复和发布验证。

**允许修改**：`ops/**`、CI/release、operations docs、root scripts facade、health smoke。

**禁止**：第三种部署模式；捆绑 PG 二进制/镜像 tar；Kubernetes；日志平台。

**步骤**：compose 两服务 → external DB config → install/start/status/backup/restore/upgrade/stop → migration preflight → artifact allowlist → three-platform build/smoke（仅真实支持平台）。

**路标**：R17.1 compact；R17.2 external；R17.3 backup/restore；R17.4 upgrade/rollback；R17.5 artifact。

**成功**：默认服务≤2；一条命令升级；pg_dump/restore 对账；日志只 stdout；包内 forbidden=0；支持矩阵与 CI 一致。

**失败**：平台特定脚本分叉业务逻辑；把数据/log/report 打包；升级自动执行不可逆迁移无门禁；声称未 smoke 平台支持。

**验证**：fresh machine/isolated environment runbook、resource measurement、artifact inventory、release smoke。

**解锁**：仅 G18。

### G18：最终一致性审计和交付

**Objective**：证明目标架构、产品不变量、工程预算、目录契约、文档追踪、测试和发布全部达成，并删除所有临时/过期路径。

**允许修改**：gap fixes、docs、tests；任何源代码 gap fix 必须有 task 和重跑相关 Goal 门禁。

**禁止**：新增功能；放宽门禁；把未完成项写成成功。

**步骤**：目录 audit → docs cross-artifact analyze → code review → security → dependency → PG → API → UI → performance → operations → release → tracked artifact → final result/handoff。

**路标**：第 5 节所有指标达到目标；requirements → spec → task → code → test 追踪 100%。

**成功**：

- 最终目录与第 3 节一致，禁止目录为 0。
- PostgreSQL/Fastify/Vue 各只有一套运行实现。
- 虚谷运行引用为 0；旧 UI/API 为 0。
- 所有全局预算和测试通过。
- clean checkout 可 build/verify/start。
- 新 Agent fresh context 能准确接手。
- `docs/product/IMPLEMENTED.md` 只包含已验证能力。

**失败**：任何指标缺证据；任何 required suite skip；文档与代码仍冲突；发布包含 forbidden artifact；遗留 TODO 无 spec/task。

**验证**：`FINAL-VERIFICATION.md`，包含命令、环境、结果、风险、支持矩阵和明确 PASS/FAIL。

**解锁**：无；成功后项目重构完成。

---

## 9. 目标验证命令

这些命令由 G03 起逐步建立，G18 必须全部存在且通过：

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run verify:structure
npm run verify:docs
npm run verify:contracts
npm run verify:artifacts
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:e2e
npm run test:e2e:abnormal
npm run test:security
npm run test:performance
npm run build
npm run verify
```

数据库与运维必须另有：

```bash
npm run db:migrate
npm run db:verify
npm run backup
npm run restore:verify
npm run start
npm run status
npm run stop
```

CI 报告、bundle report、coverage、Playwright report 只能作为 CI artifact，不提交 Git。

---

## 10. 每个 Goal 的 HANDOFF 模板

```markdown
# Goal <ID> Handoff

## Status
- Goal: <ID/name>
- Result: PASS | FAIL | BLOCKED
- Commit(s): <hashes>

## Objective evidence
- <criterion>: <evidence path/command/result>

## Roadmarks
- <roadmark>: <value/status>

## Changed
- <file/module>: <what and why>

## Verification
- `<command>`: PASS/FAIL

## Boundaries checked
- Out-of-scope changes: none | list
- Tracked logs/secrets/data/reports: 0
- Canonical doc conflicts: 0

## Risks
- <remaining risk or none>

## Next
- Only unlocked Goal: <ID>
- Exact starting point: <path/task>
```

---

## 11. 给执行 Agent 的首条指令

可直接复制：

> 读取 AGENTS.md、唯一交付文档 docs/REFACTOR-PLAN.md 和当前项目记忆，并严格执行本计划第 1 章协议与第 6 章工程规范。只执行 G00“锁定目录命名和迁移映射”，不要移动、重命名或删除任何源码，不要创建 G01 代码。使用 G00 Objective 原文作为当前 Goal。完成 PROJECT-STRUCTURE.md 和 MIGRATION-MAP.md，证明 tracked 文件映射覆盖率 100%、重复映射 0、未映射 0，并等待用户确认目录命名。成功条件未全部满足时不得把 Goal 标记 complete。

---

## 12. 计划依据

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec Kit 核心流程](https://github.github.io/spec-kit/)
- [Spec of Specs](https://github.github.io/spec-kit/concepts/spec-of-specs.html)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL Versioning](https://www.postgresql.org/support/versioning/)
- [Fastify Reference](https://fastify.dev/docs/latest/Reference/)
- [Vue Performance](https://vuejs.org/guide/best-practices/performance)
- [Element Plus On-demand Import](https://element-plus.org/en-US/guide/quickstart.html)
- [Kysely](https://www.kysely.dev/)
- [node-postgres Pooling](https://node-postgres.com/features/pooling)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup-dump.html)
- [Docker Compose Production](https://docs.docker.com/compose/how-tos/production/)
