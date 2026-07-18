# 目标架构

状态：`accepted design`

## 系统边界

```text
Browser
  ├─ 登录与项目检索
  ├─ 项目切换与项目详情
  ├─ 固定模块渲染器
  └─ AI 更新审核中心
          │
Node.js Application
  ├─ Auth / Project API
  ├─ Template & Module Registry
  ├─ Material & Evidence Pipeline
  ├─ Proposal Validation & Review
  ├─ Publish / Rollback / Audit
  └─ Project-scoped AI Gateway
          │
SQLite
  ├─ users / roles / project_members
  ├─ projects / project_versions
  ├─ units / stages / tasks / modules
  ├─ materials / evidence_chunks
  ├─ generation_jobs / change_proposals
  └─ audit_events
```

## 状态层

- `published`：前台当前可见版本。
- `draft`：人工编辑或审核接受后的待发布状态。
- `proposal`：LLM 生成但尚未审核的增量变化。

三层必须分离。LLM 不能直接写入前两层。

## 模块注册表

首版固定模块：项目概览、作战单元、路线、任务网络、甘特、成果、风险、指标和材料。

模块由平台代码实现，并拥有版本化 Schema 和固定渲染器。项目模板只配置模块、术语、字段、主题和校验，不注入可执行代码。

## 项目模板

- `campaign-map-v1`：继承当前虚谷路线、分支、汇合和作战话术。
- `standard-project-v1`：使用项目、团队、任务、里程碑和交付物话术。

## API 方向

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId/public
GET    /api/projects/:projectId/draft
POST   /api/projects/:projectId/materials
POST   /api/projects/:projectId/generation-jobs
GET    /api/projects/:projectId/proposals/:proposalId
POST   /api/projects/:projectId/proposals/:proposalId/review
POST   /api/projects/:projectId/publish
POST   /api/projects/:projectId/rollback
```

所有项目 API 都必须验证项目权限；不得通过客户端传入路径直接定位文件。

## 技术选择

- 首版：单服务器 Node.js 24.15+ + 内置 `node:sqlite`。
- 后续多机部署：在仓储接口后迁移 PostgreSQL。
- AI Provider：通过统一网关适配，密钥仅服务端保存。
- 不在首版引入微服务、消息队列或任意代码插件。

## 已实现数据边界

- `projects` 通过两个显式指针分别定位当前 `published` 和 `draft` 版本。
- `project_versions` 下按版本分离存储模块、作战单元、路线节点、闭环、任务、依赖和公司级战线。
- 任务父子和前置依赖既经确定性图校验，也使用 SQLite 外键持久化。
- `change_proposals`、`proposal_review_items`、`proposal_merges` 和 `publication_events` 分离保存模型建议、人工决定、草稿结果和版本事件。
- 审核编辑复用锁定 generation context 和确定性 validator；任务所属单元、日期、证据、依赖和重复在保存决定前再次检查。
- 合并复制当前草稿为新版本，应用全部接受项并完成外键/完整图校验后才切换指针；事务失败不保留复制版本。
- 发布复制当前草稿为新发布版本并创建新草稿基线；回滚只接受最新发布事件的直接前驱。AI 不拥有任何审核或版本动作。

## 已实现平台与运营边界

- `users`、`sessions`、`project_members`、`recent_project_access` 和追加式 `audit_events` 提供认证、授权与追踪基础。
- 会话原始 token 只存在于 HttpOnly Cookie，数据库只保存摘要；CSRF token 由认证会话端点返回并仅保存在浏览器内存。
- 项目仓储先按平台管理员或成员关系筛选，再读取版本图；越权与不存在项目返回统一 404，失败读取不写最近访问。
- 项目创建、编辑、归档和恢复均由服务层事务包裹，并与成员授予、审计事件共同提交或回滚。
- HTTP 层只提供固定静态资源和明确 SPA 路由，使用 CSP、`nosniff`、`DENY`、`no-referrer` 与 `no-store`。
- 平台 UI 使用九类固定 renderer，并在 Materials 工作区内提供提案审核与发布中心；项目数据只能驱动受控字段和术语。
- 平台/项目管理员、编辑者和查看者分别获得明确能力；用户/成员、审核、合并、发布与回滚动作写追加式审计。
- SQLite 运行备份使用一致快照；恢复在应用离线时校验完整性、外键和迁移后替换，并保留恢复前备份。
