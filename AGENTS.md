# AI 项目作战管理平台：Agent 工作规则

> **版本**: 2.0 (重构中)
> **适用**: 整个工程。任何人员或 Agent 在设计、编码、测试或交接前必须先阅读。

---

## 当前状态

- **重构进行中**：正在从 V1（vanilla JS + XuguDB）迁移到 V2（TypeScript + Fastify + Vue 3 + PostgreSQL）。
- **执行合同**：`docs/REFACTOR-PLAN.md`（G00-G18，19 个串行 Goal）。
- **当前 Goal**：见 `docs/changes/EXECUTION-STATE.md`。
- 唯一数据库：**PostgreSQL**（ADR-001）。
- 架构：**模块化单体**（ADR-002），app + PostgreSQL 两服务（ADR-003）。

## 强制阅读顺序

每个 Goal 开始前依次读取：

1. `AGENTS.md`（本文件）
2. `docs/REFACTOR-PLAN.md`（执行合同）
3. `.specify/memory/constitution.md`（工程宪法）
4. `docs/architecture/PROJECT-STRUCTURE.md`（目标目录树）
5. `docs/architecture/MIGRATION-MAP.md`（文件迁移映射）
6. 相关 `docs/adr/` ADR
7. 当前 Goal 的 `specs/<goal-id>-<slug>/spec.md`、`plan.md`、`tasks.md`
8. `docs/changes/DESIGN-CHANGELOG.md`、`EXECUTION-STATE.md`、`HANDOFF.md`

任何未写入版本化文档的会话结论都视为**未确认**。

## 权威顺序

```
AGENTS → REFACTOR-PLAN → constitution → accepted ADR → architecture → feature spec/plan/tasks → code/tests
```

代码与设计冲突时，必须判断是实现缺陷还是已确认的新决策；不能默认以代码覆盖产品边界。

## 产品不变量

- 多项目和项目成员/角色权限。
- `project_cards` / `project_card_links` 是版本化项目图唯一模型。
- `xugu-agentic-group` 作为业务项目 stable external ID 保留（名称不代表数据库技术）。
- 材料、证据、问答、生成任务、审核、版本和权限按 `projectId` 隔离。
- LLM 只生成有来源的结构化 `ChangeProposal`。
- AI 不直接写 draft/published，不审核、不发布、不执行代码。
- 人工审核、copy-on-write draft、发布、直接前驱回滚和追加审计语义保留。

## 工程边界

- **PostgreSQL 是唯一数据库**；不得引入第二套持久化实现、迁移树或测试后端（ADR-001）。
- **模块化单体**：一个应用部署单元（ADR-002）。
- **运行服务上限 2**（app + PostgreSQL），外部 DB 时上限 1（ADR-003）。
- 不引入 Redis、MQ、对象存储或 Kubernetes。
- 代码中不得硬编码供应商特定的 URL、模型名称、域名或端点路径。
- 配置在启动边界解析一次；密钥只存未跟踪配置或运行时数据库。
- 禁止 `utils/`、`helpers//`、`common/`、`misc/` 杂物桶目录。

## 工作生命周期

```
Intent → Spec → Contract → Design → Tasks → Code → Verification → Result
```

1. 按强制阅读顺序加载上下文。
2. 确认当前 Goal 的 Objective、允许/禁止边界和成功/失败定义。
3. 写 spec.md / plan.md / tasks.md（如果 Goal 尚未创建）。
4. 实现，执行验证。
5. 写 VERIFICATION.md，更新 DESIGN-CHANGELOG / EXECUTION-STATE / HANDOFF。
6. 用户确认后解锁下一个 Goal。

## 强制留痕

每次会话/Goal 结束前必须更新：

| 文件 | 内容 |
|---|---|
| `docs/changes/DESIGN-CHANGELOG.md` | 改了什么、为什么改、影响什么、如何回滚 |
| `docs/changes/EXECUTION-STATE.md` | 当前 Goal 状态、进度表、环境信息 |
| `docs/changes/HANDOFF.md` | 下一个 Agent 的精确起点 |
| `.workbuddy/memory/YYYY-MM-DD.md` | 简短技术日志 |

架构变化同时更新 `docs/adr/`。

## Git 与安全

- 每个 Goal 使用清晰原子提交组，commit 引用 Goal ID 和 task ID。
- **禁止提交**：API Key、运行卷、上传原件、预处理材料、日志、测试报告、诊断包。
- `package.json` 必须保持 `private: true` 与 `license: UNLICENSED`。
- 不覆盖用户已有未提交修改；不使用破坏性 Git 命令覆盖他人工作。
- `git diff --check` 必须通过。

## 文档索引

| 文档 | 位置 |
|---|---|
| 执行合同 | `docs/REFACTOR-PLAN.md` |
| 工程宪法 | `.specify/memory/constitution.md` |
| 产品定义 | `docs/product/PRODUCT.md` |
| 需求 | `docs/product/REQUIREMENTS.md` |
| 路线图 | `docs/product/ROADMAP.md` |
| 目标目录树 | `docs/architecture/PROJECT-STRUCTURE.md` |
| 迁移映射 | `docs/architecture/MIGRATION-MAP.md` |
| 系统规范 | `docs/architecture/SYSTEM.md` |
| 需求追踪 | `docs/architecture/TRACEABILITY.md` |
| 架构决策 | `docs/adr/` |
| 测试标准 | `docs/engineering/TESTING-STANDARDS.md` |
| 性能预算 | `docs/engineering/PERFORMANCE-BUDGETS.md` |
| 安全标准 | `docs/engineering/SECURITY-STANDARDS.md` |
| 变更记录 | `docs/changes/` |
| Goal 工件 | `specs/<goal-id>-<slug>/` |
