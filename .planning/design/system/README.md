# AI 项目作战管理平台：系统设计索引

状态：`canonical design`
最后更新：2026-07-29

本目录是整个项目长期有效的 spec-driven design 入口。阶段目录记录某次演进，本文档集记录系统现在是什么、必须保持什么、各模块如何协作以及未来变化应落在哪里。

## 阅读顺序

1. `SYSTEM-SPEC.md`：产品目标、角色、能力、边界和系统级验收。
2. `ARCHITECTURE.md`：运行时、模块依赖、数据流、信任边界和故障语义。
3. `TRACEABILITY.md`：需求、决策、模块、代码、测试和阶段的映射。
4. 各模块 `ADR.md`：本模块关键取舍及被拒方案。
5. 各模块 `DESIGN.md`：当前实现契约、接口、状态、数据和演进点。

## 系统模块

| 编号 | 模块 | 主要职责 |
|---|---|---|
| 01 | Runtime & Persistence | 启动、SQLite、迁移、事务、路径和单进程运行 |
| 02 | Identity & Project Access | 用户、会话、CSRF、角色、项目生命周期和成员 |
| 03 | Project Model & Rendering | 模板、固定模块、版本图、任务关系、术语和只读投影 |
| 04 | Materials & Evidence | 上传门阀、对象存储、提取、证据、readiness 和 worker |
| 05 | AI Services | Provider、提示构建、检索问答、生成上下文、配额和输出校验 |
| 06 | Change Control & Release | ChangeProposal、审核、草稿合并、发布、回滚和审计 |
| 07 | Product Experience | 平台壳、工作区、用户流程、响应式和无障碍 |
| 08 | Operations & Delivery | 可观测性、自检、备份恢复、迁移、打包和发布 |

每个模块目录包含：

- `ADR.md`：为什么这样设计。
- `DESIGN.md`：系统如何工作。

## 文档权威顺序

发生冲突时按以下顺序处理：

1. `AGENTS.md` 的安全和工作规则。
2. `.planning/PROJECT.md` 与 `.planning/REQUIREMENTS.md` 的产品目标和正式需求。
3. `.planning/DECISIONS.md` 与模块 ADR 的已接受决策。
4. 本目录的系统与模块 Design。
5. 当前阶段 SPEC、UI-SPEC 和实施 Plan。
6. 代码和测试。

代码若与更高层设计不一致，不自动以代码为准；必须判断是实现缺陷还是设计已变化，并先更新相应规格。

## Spec-driven 变更流程

`Intent → Requirement → ADR → Design → Plan → Code → Verification → Result`

- 新产品能力先进入 REQUIREMENTS。
- 改变模块边界、数据真相或安全模型先写 ADR。
- 改变 API、状态机、数据流或 UI 行为先改 Design。
- 只有 Plan 才拆文件、提交和实施顺序。
- Verification 必须回链到需求。
- 只有完成验证的行为才能进入 `docs/RESULT.md`。

## 当前实现与计划

- Phase 1–10：已实现，当前平台版本 `0.8.0`。
- Phase 11：仅完成 UI SPEC/ADR/DESIGN，尚未实现。
- 本系统设计同时描述已实现基线和已接受的未来约束；模块 Design 必须明确区分两者。
