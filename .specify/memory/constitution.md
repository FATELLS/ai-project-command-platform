# Engineering Constitution

> **非协商原则。** 任何偏离必须先写 ADR 并经用户确认。权威顺序：`AGENTS → REFACTOR-PLAN → constitution → accepted ADR → architecture → feature spec/plan/tasks → code/tests`

---

## C-01: 统一工作流

`Intent → Spec → Contract → Design → Tasks → Code → Verification → Result`

- 先写用户结果、业务不变量、边界和失败语义，再选择框架 API。
- 目录、API、数据模型、状态机和跨模块依赖变化，必须先更新设计 Markdown，并在 `DESIGN-CHANGELOG` 追加"改了什么、为什么改、影响什么、如何回滚"。
- 代码只能实现已确认的设计；不得以既有实现反向覆盖设计。
- 按可演示的垂直切片交付。

## C-02: 模块化单体

- 一个应用部署单元、一个 PostgreSQL。
- 没有容量证据和 ADR 不新增运行服务。
- 必需运行服务上限：**2**（app + PostgreSQL）。
- 外部数据库时仅 app：上限 **1**。

## C-03: 唯一数据库

- **PostgreSQL** 是唯一数据库和测试后端。
- 禁止虚谷兼容层、第二迁移树、双写和生产 fallback。
- 已发布 migration 不可修改；使用 expand → migrate → contract。
- destructive migration 必须独立 task、备份、数据验证和人工门禁。

## C-04: 边界校验

- 外部输入在 HTTP、数据库、文件、环境变量、AI Provider 等边界**一次性校验和规范化**。
- 内部只使用明确类型。
- 权限、`projectId` 隔离、事务、状态转换和副作用必须显式可见。
- 默认 **fail closed**。

## C-05: 禁止杂物桶

- 相同实现第三次出现且语义一致时才抽象。
- **禁止** `utils/`、`helpers/`、`common/`、`misc/`、`base/` 杂物桶目录。
- 兼容层必须标明 spec/task、删除条件和最晚删除 Goal。

## C-06: 通用语言

- 文件、目录、代码标识符、API 字段和数据库对象使用**英文**。
- 用户界面和面向用户的业务文档使用**中文**。
- 变量和函数：`camelCase`。
- 类型、类和 Vue 组件：`PascalCase`。
- 常量：`SCREAMING_SNAKE_CASE`。
- 布尔值：`is/has/can/should` 前缀。
- ID：`Id` 后缀（`projectId`）。
- 时长带单位：`timeoutMs`、`retentionDays`。
- 函数名：动词+业务对象（`createProject`、`publishDraftVersion`）。
- 查询动词：`get`（必须存在）、`find`（可不存在）、`list`、`count`。
- 禁止模糊动词 `process`、`handle`、`do`、`manage`、`execute`（除非领域正式术语）。

## C-07: 文件命名

| 对象 | 规则 | 示例 |
|---|---|---|
| TypeScript 文件 | `kebab-case.ts` | `project-service.ts` |
| Vue 组件 | `PascalCase.vue` | `ProjectCardTable.vue` |
| 目录 | `kebab-case` | `change-proposals/` |
| 业务模块 | 复数资源名 | `projects/`, `materials/` |
| 单元测试 | `*.test.ts` | `project-service.test.ts` |
| E2E 测试 | `*.spec.ts` | `review-and-publish.spec.ts` |
| SQL migration | `NNNN_<imperative>.sql` | `0001_create_baseline_schema.sql` |

- 一个文件只承担一个主要职责。
- `index.ts` 只暴露模块公共 API，禁止全工程 barrel。
- 禁止深层导入其他模块的 repository/internal/test。
- 禁止循环依赖。

## C-08: 前端依赖方向

```
app/router → features → entities → shared
```

- 下层不得导入上层。
- feature 不得直接导入另一 feature 的内部文件。
- `shared/ui` 不得请求 API、读取路由或包含业务判断。
- TanStack Query 是服务端状态唯一缓存。
- Pinia 仅保存认证和纯客户端跨页面状态。
- 禁止把同一份服务端数据同时复制到 Query cache、Pinia 和组件 state。

## C-09: 后端模块分层

```
routes → schemas → service → repository → mapper
```

- `routes`：只处理 HTTP 协议、schema、认证/权限入口和响应映射。
- `schemas`：请求/响应 JSON Schema 及派生类型；所有 route 必须声明 schema。
- `service`：编排用例和事务边界。
- `repository`：只处理 Kysely 查询与持久化。
- `mapper`：只做纯转换。
- 没有真实职责时不得创建空层。
- service/repository 不读取 `process.env`；配置在启动边界解析一次。
- Promise 必须 await、return 或明确 `void` 且处理失败。

## C-10: API 契约

- 基础前缀：`/api/v1`。
- 资源：复数名词；路径：`kebab-case`；JSON 字段：`camelCase`。
- CRUD 使用 HTTP method，不在 URL 重复动词。
- ID 字段：`<resource>Id`。
- 分页：请求 `cursor/limit`，响应 `items/nextCursor`。
- 时间：ISO 8601 UTC。
- 错误结构：`{ "error": { "code", "message", "requestId", "details" } }`。
- 错误消息不得包含内部异常、SQL、路径、凭据或供应商原始响应。

## C-11: PostgreSQL 命名

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

- 主键统一 `id`；外键统一 `<target_singular>_id`。
- 时间列统一 `created_at`、`updated_at`。

## C-12: 测试纪律

- 测试标题使用行为语言；一个测试验证一个主要行为。
- 固定时间、UUID、随机数和外部响应。
- 使用脱敏、最小、语义明确的 fixture。
- API 测试使用 Fastify inject。
- 数据库测试使用真实 PostgreSQL。
- 关键旅程使用 Playwright。
- 测试必须覆盖成功、失败、权限和跨项目场景。

## C-13: 日志安全

- 日志字段用 `camelCase`，至少含 `requestId`、`projectId`、`durationMs`、`errorCode`。
- **禁止记录** Authorization、Cookie、API Key、数据库 URL、材料正文、完整 prompt、Provider 原始响应。
- 运行日志与业务审计分离；审计事件使用点分名词（`project.published`）。
- 日志、密钥、数据、报告和临时产物不得进入 Git。

## C-14: 依赖纪律

- 新增依赖前记录用途、替代方案、bundle/runtime 影响、维护状态和许可证。
- 不为一行工具函数引入大型依赖。
- 优先使用 Vue、Fastify、Kysely、TanStack Query、Element Plus 等框架已有能力。

## C-15: 注释纪律

- 公共 API、复杂状态机、数据库不变量和安全边界需要说明"为什么"和 spec/ADR 来源。
- TODO 格式：`TODO(SPEC-123/T045): reason and removal condition`。
- 禁止无编号 TODO、注释掉的代码和复制的历史实现。

## C-16: 门禁自动化

以下门禁在 G03 前建立并在后续持续执行：

1. ESLint：TypeScript/Vue、命名、未处理 Promise、禁止导入、复杂度
2. Prettier/Stylelint：格式、CSS 和 token 使用规则
3. TypeScript/Vue TSC：strict 类型检查
4. 依赖图检查：模块方向、循环依赖、深层导入
5. naming check：文件、目录、migration、测试、数据库对象
6. contract check：所有 API route 的请求/响应 schema
7. doc governance：受治理的目录/API/数据模型变化必须伴随设计和 changelog
8. artifact check：拒绝日志、诊断、coverage、测试报告、密钥和数据库数据进入 Git
9. size check：源文件 300 行软限/500 行硬限、前端 bundle、运行内存、服务数

任何 `eslint-disable`、类型忽略或门禁例外必须最小范围并引用 spec/task；全局关闭规则需要 ADR。

## C-17: 评审清单

每次评审必须回答：

1. 是否交付当前 spec 的用户结果？
2. 命名和模块边界是否表达业务语义？
3. 是否出现第二实现、无期限 fallback 或杂物桶目录？
4. 外部输入、权限、项目隔离、事务和副作用是否显式且 fail closed？
5. 前端是否重复保存服务端状态或全量加载重模块？
6. 是否新增不必要的依赖或运行服务？
7. 日志是否脱敏且不会进入 Git？
8. 测试是否覆盖成功、失败、权限和跨项目场景？
9. 设计、变更记录、任务、验证和结果是否同步？

## C-18: 产品不变量

- 多项目和项目成员/角色权限。
- `project_cards` / `project_card_links` 是版本化项目图唯一模型。
- `xugu-agentic-group` 作为业务项目 stable external ID 保留，名称不代表数据库技术。
- 材料、证据、问答、生成任务、审核、版本和权限按 `projectId` 隔离。
- LLM 只生成有来源的结构化 `ChangeProposal`。
- AI 不直接写 draft/published，不审核、不发布、不执行代码。
- 人工审核、copy-on-write draft、发布、直接前驱回滚和追加审计语义保留。
