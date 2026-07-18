# AI 项目作战管理平台

独立的多项目作战管理平台。平台管理多个项目，每个项目管理多个作战单元或团队，并在项目级命名空间内保存独立的发布版与草稿版。

## 当前结果

Phase 1–3 已完成：

- Node.js + SQLite 项目域、规范化版本图与可校验迁移；
- scrypt 密码、HttpOnly 会话、CSRF、空闲/绝对过期和登录限流；
- 平台管理员、项目管理员、项目编辑者和查看者四类基础角色；
- 授权项目列表、搜索、筛选、最近访问、项目切换与发布态概览；
- 平台管理员创建、编辑、归档和恢复项目的事务 API/UI；
- `xugu-agentic-group` 脱敏夹具原子迁移，保留 7 个作战单元、29 项任务、6 个路线阶段和 4 条公司战线；
- 与 Xugu 稳定应用保持同一桌面骨架的本地响应式界面：白色顶部导航、暖色指挥背景、双栏目标 Hero 和章节卡片，无远程 UI 或可执行项目组件；
- `campaign-map-v1@1.0.0` 与 `standard-project-v1@1.0.0` 版本化目录，以及九类服务端白名单模块和固定客户端渲染器；
- Xugu 作战路线/任务网络/甘特/战果与标准项目线性路线/依赖列表/泳道甘特/交付物共用同一套固定代码；
- 管理员和编辑者可事务性调整草稿模块顺序/启停，发布态不受影响，查看者无配置入口；
- 55 项自动化测试、16 个真实浏览器阻断用例和四张 SHA-256/尺寸机检证据。

材料页当前只声明 Phase 4 边界，不提供上传或问答。材料与证据、AI 变更提案、差异审核、发布和回滚尚未实现。

## 环境

- Node.js 24.15 或更高版本；
- 无第三方 npm 运行依赖；
- 默认数据库：`data/platform.sqlite`（Git 忽略）；
- 可用 `PLATFORM_DATA_DIR` 指定独立运行目录。

## 首次运行

首次启动必须通过服务端环境变量提供管理员密码，密码不会写入仓库或返回浏览器：

```bash
PLATFORM_BOOTSTRAP_PASSWORD='请替换为强密码' npm start
```

默认账号为 `admin`，默认地址为 `http://127.0.0.1:4173`。首次启动会迁移数据库，并在不存在 `xugu-agentic-group` 时导入已提交的脱敏夹具。后续启动已有管理员时不再需要启动密码。

可选环境变量见 `.env.example`。对外启用 HTTPS 时设置 `PLATFORM_SECURE_COOKIES=true`。

## 当前 API

```text
GET    /health
POST   /api/login
GET    /api/session
POST   /api/logout
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId/public
GET    /api/projects/:projectId/draft
GET    /api/projects/:projectId/public/modules
GET    /api/projects/:projectId/public/modules/:moduleType
GET    /api/projects/:projectId/draft/modules
GET    /api/projects/:projectId/draft/modules/:moduleType
PATCH  /api/projects/:projectId/draft/modules
PATCH  /api/projects/:projectId
POST   /api/projects/:projectId/archive
POST   /api/projects/:projectId/restore
GET    /api/public
```

除健康检查和登录外均需要有效会话；写操作要求 CSRF 以及对应角色。项目生命周期写操作要求平台管理员；草稿模块配置允许项目编辑者及以上角色。未授权与不存在项目使用相同 404，避免泄露项目存在性。

## 数据与验证

```bash
npm run migrate
npm run import:xugu
npm run export:xugu
npm run verify
```

统一验证使用临时数据库运行全部测试、迁移、Xugu 语义等价导入/导出、认证/模块 API、静态安全头、浏览器证据哈希/尺寸和敏感文件检查，并确认参考项目的 HEAD、Git 状态和种子哈希未变。

## 项目原则

- LLM 只能生成带来源的结构化 `ChangeProposal`，不生成或执行页面代码。
- `proposal`、`draft` 和 `published` 三层分离，AI 不得绕过审核。
- 固定模块渲染页面，项目差异来自数据、模板、术语与主题配置。
- 现有 Xugu 应用保持只读，新平台仅迁移脱敏种子和已确认语义。
