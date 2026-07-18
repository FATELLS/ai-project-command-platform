# 交接

最后更新：2026-07-18

## 首先读取

1. `AGENTS.md`
2. `docs/RESULT.md`
3. `.planning/PROJECT.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/ROADMAP.md`
6. `.planning/STATE.md`
7. `AI-SPEC.md`
8. `.planning/phases/02-platform-shell-project-switching/VERIFICATION.md`

## 当前状态

- Phase 1–2 已实现并通过验收，平台版本为 `0.3.0`。
- 首个项目 `xugu-agentic-group` 与参考 v4.2 脱敏种子语义一致。
- `xugu-agentic-group` 是首个 Xugu Agentic Group Schedule 作战项目；详情页标题、Banner、状态提示、事实与模块标签均按项目模板/术语配置渲染，新增标准项目不得复用 Xugu 作战文案。
- 已有认证、基础角色、授权项目列表/检索/最近访问、项目切换、项目发布态概览和平台管理员生命周期 UI/API。
- 默认数据库为 `data/platform.sqlite`，测试与统一验证只使用临时目录。
- 参考项目位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，必须继续只读。

## 代码入口

- HTTP/静态：`server.mjs`、`src/http/app.mjs`、`src/http/static.mjs`
- 认证安全：`src/security/`、`src/services/auth-service.mjs`、`src/repositories/auth-repository.mjs`
- 项目服务：`src/services/project-service.mjs`、`src/repositories/project-repository.mjs`
- SQLite：`src/db/`、`src/db/migrations/`
- Xugu 迁移：`src/migration/legacy-project.mjs`
- 前端：`public/index.html`、`public/styles.css`、`public/app.js`；桌面视觉以 Xugu 稳定应用为基线，不得恢复深色侧栏式 SaaS 壳
- 项目表现配置：`public/app.js` 的 `projectPresentation` 只负责把服务端模板/术语映射到固定 UI 文案；项目 API 必须继续返回解析后的 `theme` 与 `terminology`，不得让项目注入页面代码。
- 验证：`scripts/verify.mjs`、`test/`、`.planning/evidence/`

## 运行与验证

首次运行需要服务端 `PLATFORM_BOOTSTRAP_PASSWORD`；已有管理员的数据库后续无需再次提供。

```bash
npm run verify
```

当前通过 30 项自动化测试、临时数据库/API/静态冒烟、Xugu 语义等价、敏感文件检查、三视口浏览器验收和参考项目只读校验。

## 风险和边界

- Phase 2 只有基础用户/成员数据模型，没有用户与成员管理 UI。
- 当前生命周期审计覆盖登录与项目创建/编辑/归档/恢复；材料、审核、发布和回滚审计待对应阶段实现。
- 项目详情只展示发布态概览；九类完整模块、路线/甘特/任务网络通用渲染属于 Phase 3。
- Secure Cookie 依赖部署时启用 HTTPS 与 `PLATFORM_SECURE_COOKIES=true`。
- 备份恢复、PostgreSQL、多机和生产级运维仍未实现。

## 下一步

- 规划 Phase 3：模块注册表、版本化模块 Schema、`campaign-map-v1` 与 `standard-project-v1`。
- 把 Xugu 路线、任务网络、甘特和成果视觉迁移为固定通用渲染器，不执行项目或 AI 代码。
- 保持 `/api/public` 为有限兼容入口，新功能继续使用项目级 URL。
