# AI 项目作战管理平台：系统设计索引

状态：`canonical`
版本：`1.0.0`
最后更新：2026-08-02

## 阅读顺序

1. `SYSTEM-SPEC.md`：产品目标、对象、边界和验收。
2. `ARCHITECTURE.md`：运行拓扑、数据流、事务和信任边界。
3. `TRACEABILITY.md`：需求到代码与测试的映射。
4. 各模块 `ADR.md` 与 `DESIGN.md`：模块级决策和契约。

## 模块

| 编号 | 模块 | 职责 |
|---|---|---|
| 01 | Runtime & Persistence | 虚谷连接、迁移、事务、Docker 生命周期与路径 |
| 02 | Identity & Project Access | 用户、会话、CSRF、角色、项目和成员 |
| 03 | Project Model & Rendering | 统一卡片图、模板、版本和固定 renderer |
| 04 | Materials & Evidence | 材料门阀、提取、证据、readiness 与 worker |
| 05 | AI Services | Provider、检索、提示、配额和结构校验 |
| 06 | Change Control & Release | 提案、审核、草稿合并、发布、回滚和审计 |
| 07 | Product Experience | 平台壳、工作区、响应式、无障碍和用户流程 |
| 08 | Operations & Delivery | 自检、脱敏日志、备份恢复、打包和发布 |

## 权威顺序

`AGENTS.md → PROJECT/REQUIREMENTS → DECISIONS → canonical design → phase spec → code/tests`

代码与设计冲突时，必须判断是实现缺陷还是已确认的新决策；不能默认以代码覆盖产品边界。

## 变更流程

`Intent → Requirement → Decision → Design → Code → Verification → Result`

- 数据真相、信任边界或发布边界变化时先更新决策。
- API、状态机、数据流或 UI 行为变化时先更新设计。
- 只有通过真实虚谷和风险相称测试的行为才进入 `docs/RESULT.md`。
