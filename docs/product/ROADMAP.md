# V2 Roadmap

> Migrated from `.planning/ROADMAP.md`. Updated for PostgreSQL + Vue 3 + Fastify architecture.

## V2 重构路线 (G00-G18)

### 已完成

- **G00** 目录锁定和迁移映射
  - 锁定目标 monorepo 目录树，218 文件迁移映射

### 进行中

- **G01** 跨 Agent 工程治理
  - Constitution、ADR、工程标准、AGENTS/README 重写

### 计划

- **G02** 冻结行为与资源基线
- **G03** Workspace walking skeleton（Node22/TS/workspaces/CI）
- **G04** PostgreSQL 数据基线
- **G05** Fastify 平台基础
- **G06** 身份与项目模块
- **G07** 项目图模块
- **G08** 材料与 AI 服务
- **G09** 变更治理模块
- **G10** 后端切换，删除虚谷
- **G11** Vue 壳和设计系统
- **G12** 认证与设置视图
- **G13** 项目工作区视图
- **G14** 材料与 AI 视图
- **G15** 治理视图
- **G16** 前端切换，删除旧前端
- **G17** 运维与发布
- **G18** 最终一致性审计

## V1 已完成（历史参考）

### R1 平台与权限

- 多项目、项目切换、用户、成员、角色、会话、CSRF 和审计。

### R2 统一项目图

- `project_cards` / `project_card_links` 唯一模型。
- 导入、导出、clone、草稿、发布事实和 renderer 统一读取。

### R3 材料与 AI

- 材料门阀、提取、证据、readiness、问答、结构化提案和配额。

### R4 审核发布

- 逐项审核、copy-on-write 草稿、预览、发布、直接前驱回滚和审计。

> **注**：V1 的 R5（虚谷完整栈）和 R6（虚谷工程收口）已被 V2 重构取代。PostgreSQL 替代虚谷是 ADR-001 的决定。
