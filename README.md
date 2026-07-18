# AI 项目作战管理平台

独立的多项目作战管理平台。平台管理多个项目，每个项目管理多个作战单元或团队，并在项目级命名空间内保存独立的发布版与草稿版。

## 当前结果

Phase 1–2 已完成：

- Node.js + SQLite 项目域、规范化版本图与可校验迁移；
- scrypt 密码、HttpOnly 会话、CSRF、空闲/绝对过期和登录限流；
- 平台管理员、项目管理员、项目编辑者和查看者四类基础角色；
- 授权项目列表、搜索、筛选、最近访问、项目切换与发布态概览；
- 平台管理员创建、编辑、归档和恢复项目的事务 API/UI；
- `xugu-agentic-group` 脱敏夹具原子迁移，保留 7 个作战单元、29 项任务、6 个路线阶段和 4 条公司战线；
- 与 Xugu 稳定应用保持同一桌面骨架的本地响应式界面：白色顶部导航、暖色指挥背景、双栏目标 Hero 和章节卡片，无远程 UI 或可执行项目组件；
- 30 项自动化测试和 1440×900、1024×768、390×844 浏览器验收。

九类完整模块渲染器、材料与证据、AI 变更提案、差异审核、发布和回滚尚未实现。

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
PATCH  /api/projects/:projectId
POST   /api/projects/:projectId/archive
POST   /api/projects/:projectId/restore
GET    /api/public
```

除健康检查和登录外均需要有效会话；写操作还要求 CSRF 和平台管理员权限。未授权与不存在项目使用相同 404，避免泄露项目存在性。

## 数据与验证

```bash
npm run migrate
npm run import:xugu
npm run export:xugu
npm run verify
```

统一验证使用临时数据库运行全部测试、迁移、Xugu 语义等价导入/导出、认证 API、静态安全头和敏感文件检查，并确认参考项目的 HEAD、Git 状态和种子哈希未变。

## 项目原则

- LLM 只能生成带来源的结构化 `ChangeProposal`，不生成或执行页面代码。
- `proposal`、`draft` 和 `published` 三层分离，AI 不得绕过审核。
- 固定模块渲染页面，项目差异来自数据、模板、术语与主题配置。
- 现有 Xugu 应用保持只读，新平台仅迁移脱敏种子和已确认语义。
