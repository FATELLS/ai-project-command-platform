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

- 首版：单服务器 Node.js + SQLite。
- 后续多机部署：在仓储接口后迁移 PostgreSQL。
- AI Provider：通过统一网关适配，密钥仅服务端保存。
- 不在首版引入微服务、消息队列或任意代码插件。
