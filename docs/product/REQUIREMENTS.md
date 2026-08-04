# V2.0 Requirements

> Migrated from `.planning/REQUIREMENTS.md`. Updated for PostgreSQL architecture.

## 产品与项目

- **PROJ-01** 平台必须管理多个项目，每个项目包含多个团队或作战单元。
- **PROJ-02** 项目 ID、卡片 external ID 和版本 ID 必须稳定。
- **PROJ-03** 总览、路线图、作战单元、甘特、健康和资料工作区必须由固定 Vue 视图提供。
- **PROJ-04** `xugu-agentic-group` 导入导出必须语义等价（作为业务 ID，不依赖 Xugu 数据库）。

## 数据

- **DATA-01** PostgreSQL 是唯一数据库后端。
- **DATA-02** `project_cards` 与 `project_card_links` 是唯一项目图读写模型。
- **DATA-03** 所有业务查询与写入必须使用参数化 SQL（Kysely）和明确事务。
- **DATA-04** 所有项目数据必须按 `projectId` 隔离并由数据库关系与服务权限共同保护。
- **DATA-05** UTF-8 中文、JSONB、空值、数值和日期必须无损往返。

## 材料与 AI

- **MAT-01** 材料原件、提取结果和证据按项目与代际隔离。
- **MAT-02** 生成前必须通过 readiness，并锁定材料、证据、模板和基准版本。
- **AI-01** Provider 只能接收有界上下文，不能调用工具。
- **AI-02** 输出只接受结构化 `ChangeProposal` 和允许的证据引用。
- **AI-03** AI 不得写草稿、发布态、审核决定或发布事件。
- **AI-04** Provider 仅允许 HTTPS 与主机白名单，凭据必须脱敏。

## 变更治理

- **GOV-01** 提案逐项接受、拒绝或编辑后才能合并。
- **GOV-02** 合并创建新的不可变 draft 版本，不修改 published。
- **GOV-03** 发布必须使用有效预览 token、用户确认和版本标签。
- **GOV-04** 回滚只能回到直接前驱，并写追加式审计。

## 身份与安全

- **SEC-01** 登录、会话、密码修改、CSRF 和登录限流必须启用。
- **SEC-02** 平台管理员、项目管理员、编辑与查看者执行最小权限。
- **SEC-03** 未授权项目应表现为不存在，避免信息泄漏。
- **SEC-04** API Key、连接密码和原始异常不得出现在客户端、日志或报告。

## 运行与发布

- **OPS-01** 应用启动时连接 PostgreSQL，失败则不宣称健康。
- **OPS-02** compact 模式：app + PostgreSQL 两个服务；external DB 模式：仅 app。
- **OPS-03** 背景任务（材料提取、AI 生成）在进程内运行，不引入外部 worker。
- **OPS-04** 冷备份必须可校验（pg_dump）；恢复前必须保留当前数据库。
- **REL-01** portable 包必须包含 Node runtime（PostgreSQL 由系统安装或 bundled）。
- **REL-02** 发布包不得含项目数据、材料、密钥、日志、测试或规划文档。
- **REL-03** 发布目标：Linux ARM64/x86_64、Windows amd64、macOS Apple Silicon。

## 验证

- **TEST-01** 数据库集成必须使用隔离 PostgreSQL 实例、独立数据库。
- **TEST-02** UI 全功能测试必须通过真实 server、PostgreSQL 和 Chromium 执行。
- **TEST-03** 覆盖认证、角色、跨项目隔离、材料、生成、审核、发布、回滚、异常输入和响应式。
- **TEST-04** 代码门禁必须拒绝第二数据库、第二迁移树和不兼容 SQL 方言残留。
