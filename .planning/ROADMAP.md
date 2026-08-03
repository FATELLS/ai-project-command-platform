# V1 Roadmap

## 已完成

### R1 平台与权限

- 多项目、项目切换、用户、成员、角色、会话、CSRF 和审计。

### R2 统一项目图

- `project_cards` / `project_card_links` 唯一模型。
- 导入、导出、clone、草稿、发布事实和 renderer 统一读取。

### R3 材料与 AI

- 材料门阀、提取、证据、readiness、问答、结构化提案和配额。

### R4 审核发布

- 逐项审核、copy-on-write 草稿、预览、发布、直接前驱回滚和审计。

### R5 虚谷完整栈

- 8 个迁移、ARM64 原生驱动、镜像归档、managed 生命周期、冷备恢复。
- 隔离虚谷集成和 UI 测试环境。

### R6 V1 工程收口

- 单一 server、配置、测试配置、迁移树、项目图和发布入口。
- 删除未支持发布目标和过时阶段报告。
- canonical design、运行文档和支持矩阵同步。

## V1.1 候选

- 拆分 HTTP、前端应用、renderer 和样式巨型模块。
- macOS CI 完整栈 smoke 与签名交付。
- 长期升级夹具、发布故障恢复编排和视觉回归。
- 注意力队列、全角色键盘矩阵和更细 ProjectSkeleton。
