# Phase 5：LLM 结构化变更提案 - Research

**Researched:** 2026-07-18  
**Domain:** 严格结构化输出、项目增量校验、生成任务与成本治理  
**Confidence:** HIGH

## Scope and locked boundaries

- Phase 5 只把当前项目的已就绪材料转换为相对当前 `published` 的 `ChangeProposal`；生成、校验和保存提案的任何路径都不得写 `draft` 或 `published`。[VERIFIED: `AGENTS.md`, AIU-01–07, D-004]
- 路由、会话和数据库共同锁定 `projectId`。任务只能引用同项目、当前提取代际的 ready 材料与证据；客户端或模型返回的项目/版本/材料/证据 ID 都不是授权依据。[VERIFIED: Phase 4 repository/service boundary]
- 浏览器和模型都不能提供代码、组件路径、HTML/CSS/JavaScript、SQL、Shell、工具调用或任意 Schema。固定 renderer 和版本化模板仍是唯一页面边界。[VERIFIED: D-003, D-013]
- 六类更新模板固定为 `meeting-notes`、`project-plan`、`progress-report`、`metrics-data`、`outcome-archive`、`new-project-material`，版本均为 `1.0.0`。[VERIFIED: `src/services/material-service.mjs`, Phase 5 CONTEXT]
- 审核、接受/驳回/编辑、合并草稿、发布和回滚属于 Phase 6，不在本阶段实现。[VERIFIED: roadmap]

## Current implementation evidence

现有实现已经提供可复用的认证/CSRF/角色、统一 404、SQLite `IMMEDIATE` 事务、追加式审计、发布/草稿独立指针、固定模块 Schema、材料证据和 OpenAI-compatible provider。`material_update_selections` 已保存六类模板意图，`ai_usage_events.capability` 已将 `chat` 与 `generation` 分账；provider 默认 disabled、fake 只可测试注入，并禁止 tool calls。[VERIFIED: migrations 001–004, `src/ai`, `src/services/material-service.mjs`]

当前 `change_proposals` 只保存一个 JSON payload，且 `base_version_id` 的外键没有同时证明版本属于 `project_id`；也没有生成任务、材料/证据快照、attempt、Token/成本或规范化 change 行。因此 migration 005 必须把“任务输入”和“已验证提案”分离，并以复合外键/触发器补齐项目与版本归属。[VERIFIED: `src/db/migrations/001_initial.sql`]

## Recommended architecture

```text
authorized POST(projectId, selected material IDs, template)
  -> lock current published version/checksum
  -> lock ready materials + current evidence manifest
  -> reserve generation quota and enqueue idempotent job
  -> bounded lease worker builds server-authored context
  -> strict JSON-schema provider call (no tools, no stream)
  -> parse + schema + immutable-envelope checks
  -> deterministic project/evidence/graph/date/duplicate validation
  -> optional one bounded repair attempt
  -> transactionally persist validated proposal + changes + evidence refs
  -> audit aggregate outcome; never write draft/published
```

职责分离：catalog 定义模板 allowlist；schema 只验证精确 JSON 形状；validator 在当前发布图上模拟增量并校验语义；repository 只保存同项目关系；generation service 管理租约/provider/重试/配额。不要让 HTTP 层、provider adapter 或前端直接写 proposal 表。

## Migration 005 data model

| Entity | Required fields/invariants |
|---|---|
| `material_generation_grants` | project/material、enabled、granted_by/at；与问答授权独立，默认关闭，只有项目管理员可管理 |
| `generation_jobs` | project, locked published version, template/schema version, state, input fingerprint/idempotency key, creator/timestamps；base version 必须属于同项目且为当前 published |
| `generation_job_materials` | `(project_id, job_id, material_id)`；材料必须同项目、ready，并锁定 extraction version |
| `generation_job_evidence` | job/material/evidence 复合引用；锁定 evidence external ID、content hash 和 extraction version，禁止跨项目/旧代际 |
| `generation_attempts` | attempt number/result code、provider/profile/model、latency、input/output tokens、price version、nullable cost micros；不存 prompt/raw output/材料正文/上游错误体 |
| `change_proposals` | 继续作为提案 envelope，但补 job、template、base checksum、summary/warnings；只保存通过全部校验的 pending proposal |
| `change_proposal_items` | change ID、module/operation/target/semantic type、strict patch JSON、confidence、warnings；同一 proposal 内 change ID 唯一 |
| `change_proposal_evidence` | change 与 locked job evidence 的同项目复合引用，证明该项变化的直接来源 |

现有 `change_proposals` 数据应迁移而不是静默丢弃。若 SQLite ALTER 无法表达新的 CHECK/FK，采用新表复制、校验行数、替换表的迁移方式。所有子表都携带 `project_id` 并使用 `(project_id, id)` 复合键作防御纵深；只靠全局 UUID 不足以证明租户归属。

## `change-proposal-v1@1.0.0`

Top-level exact keys：`schemaVersion`, `projectId`, `baseVersionId`, `template`, `materialIds`, `summary`, `changes`, `warnings`。服务端在调用前生成/锁定全部 envelope 值，模型输出必须逐字相等；provider 无权选择目标项目、版本或材料。

每个 change exact keys：

- `changeId`：提案内稳定小写 ID；
- `module`：固定九模块中除 `materials` 外、且必须命中模板 allowlist；
- `operation`：`create|update|delete`，再受模板 allowlist 限制；
- `targetId`：update/delete 必须存在；create 必须符合稳定 ID 规则且不与当前图或同提案碰撞；
- `semanticType`：仅 `fact|plan|suggestion|unknown`；
- `patch`：按 entity/module 分支定义的精确字段对象，禁止额外属性、任意 JSON Pointer 和可执行内容；
- `evidenceIds`：本任务 locked evidence allowlist 的唯一 ID；
- `confidence`：0–1；
- `warnings`：有界稳定警告码数组。

输出最多 128 KiB、100 changes；数组/字符串/patch 均有独立上限。严格 provider JSON 只是第一层约束，服务端仍必须完整 parse 和本地校验。JSON Schema Draft 2020-12 支持用 `unevaluatedProperties:false` 关闭组合 Schema 的未知字段；对 strict-output provider 应使用其支持的 JSON Schema 子集，不能在 provider 不支持时回退到自由文本。[JSON Schema 2020-12](https://json-schema.org/draft/2020-12)

## Six template policies

| Template | Allowed intent | Default target modules/operations |
|---|---|---|
| meeting-notes | 决议、行动项、风险、明确进展 | tasks/risks，必要时 outcomes；create/update；不允许 delete |
| project-plan | 团队、路线、任务、依赖、风险、指标目标 | units/roadmap/tasks/risks/metrics；create/update；delete 需显式策略和警告 |
| progress-report | 任务进度/日期/风险/明确成果 | tasks/risks/outcomes/metrics；update 为主；进度和完成必须直接证据 |
| metrics-data | 指标值、单位、截至日期、目标和状态 | metrics create/update；数值/日期强校验 |
| outcome-archive | 已形成且可回证据的成果 | outcomes create/update；不得把计划产出归档为成果 |
| new-project-material | 初始化空项目壳的团队、路线、任务、风险、指标 | overview/units/roadmap/tasks/risks/metrics create-only；项目必须先由平台 API 创建，模型不能创建项目/模板/主题 |

模板目录应是不可变的 `id@version` 纯数据，并同时驱动上下文说明、Schema 分支和服务端 allowlist；不能只在 prompt 中声明限制。

## Context assembly

- 每任务 1–8 个材料，全部 ready、当前 extraction generation、同一 update-template 版本；创建任务时将 evidence ID、material ID、extraction version 和 content hash 锁入 manifest。
- published 摘要最多 32 KiB；证据正文最多 64 KiB、48 块。采用稳定顺序和每材料公平配额，任何裁剪记录 `CONTEXT_TRUNCATED`，不能假装已完整阅读材料。
- evidence 使用明确 `<untrusted_evidence>` 边界；材料中的“忽略规则、读取其他项目、调用工具、发布”等文字只是引用数据。
- 不把 draft、其他项目、原件路径、密钥、任意模板配置或问答历史送给 provider。

## Deterministic validation order

1. **Parse/shape:** 单一 JSON object、大小、schema version、精确 keys、长度与数量。
2. **Immutable envelope:** `projectId/baseVersion/template/materialIds` 与 job lock 完全一致。
3. **Project/evidence:** 每个 material/evidence 同项目、ready、当前代际、位于 job manifest；未知或跨项目引用拒绝。
4. **Template allowlist:** module/operation/patch 字段必须被所选模板版本允许；materials/module config/code fields 永不允许。
5. **Target simulation:** update/delete 目标存在，create 目标不存在；重复 change、重复 target+field 或互相冲突拒绝。
6. **Semantic/evidence:** 所有 fact 以及 progress/completion/status、owner、date、metric value、outcome 等高影响字段必须有字段级证据。`suggestion`/`unknown` 加 deterministic warning，不能伪装完成事实。
7. **Dates:** 真实 ISO 日期、start <= end；父子范围违例拒绝或按明确模板策略告警，不自行改日期。
8. **Graph:** 在 published 图 + 全部 proposal changes 上一次性模拟；parent/dependsOn 必须存在、无 self/missing/duplicate/cycle，且保持现有同作战单元依赖边界。
9. **Duplicates:** ID/规范化名称完全重复拒绝；近似标题只产生 `POTENTIAL_DUPLICATE`，不得静默合并。
10. **Version conflict:** 持久化事务再次比较当前 published pointer/checksum；不一致则 job=`stale`，不自动 rebase、不写 pending proposal。
11. **Atomic persist:** envelope、changes、evidence refs 和 succeeded attempt 同事务提交；任何失败都不留下部分 proposal。

“证据存在”不等于“证据语义支持主张”。结构校验保证可追溯，忠实性必须由 reference fixtures/eval 和 Phase 6 人工审核共同兜底，不能宣称确定性代码已证明自然语言蕴含。

## Provider, retry, usage and cost

- generation 使用独立 server-only provider profile；默认 disabled，fake 只接受测试注入。OpenAI-compatible 请求使用非流式 JSON object 模式、tools absent，并继续执行 HTTPS host allowlist、deadline 和响应体上限；严格版本化 Schema 始终由本地 parser/validator 强制执行，不能信任 provider 格式提示本身。
- 每任务最多一次 transient retry；结构/引用失败最多一次 repair。总 provider calls 必须有统一硬上限，repair 只发送稳定错误码、原 Schema 和同一 bounded context，不回显原始无效输出。
- 手工 retry 创建链接到原任务的新 job/attempt，不能覆盖原记录或绕过 quota。输入 fingerprint（project/base/template/schema/material generations/evidence hashes）保证普通重复 POST 幂等。
- `generation` 建议 4 次/用户+项目/分钟、100 次/项目/日；与 chat 分账但共享全局 provider 并发 2。所有尝试包括失败/repair 都计 token 和成本。
- 成本使用整数 micros 与版本化每百万 token 单价计算；usage 或价格缺失时为 `unpriced/estimated`，不能记成零成本。日志只记录摘要、error code、token、latency、cost，不记录 prompt、正文、raw response、密钥或路径。

## API and Phase 5 UI boundary

推荐 API：

```text
POST /api/projects/:projectId/generation-tasks
GET  /api/projects/:projectId/generation-tasks
GET  /api/projects/:projectId/generation-tasks/:taskId
POST /api/projects/:projectId/generation-tasks/:taskId/retry
GET  /api/projects/:projectId/change-proposals
GET  /api/projects/:projectId/change-proposals/:proposalId
```

创建/重试只允许 editor/admin/platform admin，写操作要求 CSRF；viewer 最多读取服务器已验证的提案摘要。跨项目 job/proposal/material/evidence 猜测统一 404。Phase 5 UI 只展示任务状态、Token/成本、结构化 changes、证据跳转、语义/置信度/警告和 stale/disabled/failure 状态；没有接受、驳回、编辑、合并、预览、发布或回滚控件。

## Implementation map and tests

建议新增 `src/proposals/{catalog,schema,validator,proposal-repository,generation-service,prompt-builder}.mjs`，generation provider 从现有 `src/ai` 共用安全 transport/配额但保持独立配置。实现顺序：

1. migration 005 + immutable catalog + strict schema；
2. pure deterministic validator（先测试所有攻击矩阵）；
3. repository/job leases/attempts/idempotency；
4. provider orchestration/repair/quota/token/cost；
5. authorized API + fixed safe DOM；
6. unified/browser/no-key/reference-integrity verification。

阻断测试必须覆盖：跨项目 job/material/evidence/baseVersion；旧 extraction generation；非法字段/代码/工具；无证据完成状态；计划冒充成果；日期逆序；missing/self/cyclic dependency；重复 ID/名称；并发重复任务；stale base；disabled/timeout/429/5xx/truncated/oversized/invalid JSON/invalid citation；repair 后仍失败；quota/cost；以及每条成功/失败路径前后 draft/published pointer 与内容哈希不变。

## Primary recommendation

先把 strict Schema 和 deterministic validator 做成 provider 无关的纯边界，再允许 provider 输出进入 repository。只有在同项目 evidence manifest、当前 published base 和完整增量图全部通过后，才在单事务中保存 normalized pending proposal；生成任务永远没有 draft/published 仓储能力。这样 Phase 6 可以安全消费同一份差异数据，而 Phase 5 的任何模型或网络失败都只影响任务本身。[VERIFIED: AIU-02–07, NFR-03]
