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
8. `.planning/phases/03-module-registry-project-templates/VERIFICATION.md`

## 当前状态

- Phase 1–3 已实现并通过验收，平台版本为 `0.3.0`。
- 首个项目 `xugu-agentic-group` 与参考 v4.2 脱敏种子语义一致。
- `xugu-agentic-group` 是首个 Xugu Agentic Group Schedule 作战项目；详情页标题、Banner、状态提示、事实与模块标签均按项目模板/术语配置渲染，新增标准项目不得复用 Xugu 作战文案。
- 已有认证、基础角色、项目生命周期、项目切换、九类发布态模块，以及管理员/编辑者只写草稿的模块排序与启停 UI/API。
- `campaign-map-v1@1.0.0` 与 `standard-project-v1@1.0.0` 共用九类固定渲染器；标准验收夹具为 3 团队、7 任务、4 里程碑、2 工作流。
- 默认数据库为 `data/platform.sqlite`，测试与统一验证只使用临时目录。
- 参考项目位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，必须继续只读。

## 代码入口

- HTTP/静态：`server.mjs`、`src/http/app.mjs`、`src/http/static.mjs`
- 认证安全：`src/security/`、`src/services/auth-service.mjs`、`src/repositories/auth-repository.mjs`
- 项目服务：`src/services/project-service.mjs`、`src/repositories/project-repository.mjs`
- 模板与模块：`src/templates/`、`src/modules/`、`public/modules/`
- SQLite：`src/db/`、`src/db/migrations/`
- Xugu 迁移：`src/migration/legacy-project.mjs`
- 前端：`public/index.html`、`public/styles.css`、`public/app.js`；桌面视觉以 Xugu 稳定应用为基线，不得恢复深色侧栏式 SaaS 壳
- 项目表现配置：服务端目录提供 `theme`、`terminology`、`schemaVersion` 和 allowlist `viewVariant`，`public/app.js` 与 `public/modules/` 只选择固定 UI；不得让项目注入组件路径或页面代码。
- 验证：`scripts/verify.mjs`、`test/`、`.planning/evidence/`

## 运行与验证

首次运行需要服务端 `PLATFORM_BOOTSTRAP_PASSWORD`；已有管理员的数据库后续无需再次提供。

```bash
npm run verify
```

当前通过 55 项自动化测试、临时数据库/API/静态冒烟、Xugu 语义等价、四张浏览器证据哈希/尺寸机检、敏感文件检查和参考项目只读校验。

## 风险和边界

- Phase 2 只有基础用户/成员数据模型，没有用户与成员管理 UI。
- 当前生命周期审计覆盖登录与项目创建/编辑/归档/恢复；材料、审核、发布和回滚审计待对应阶段实现。
- Phase 3 Materials 只是诚实边界页，不读取或上传材料，也没有问答、删除或 AI 操作。
- 模块配置只写 `draft`，不会改变 `published` 导航；当前没有把草稿发布、合并或回滚的入口。
- Secure Cookie 依赖部署时启用 HTTPS 与 `PLATFORM_SECURE_COOKIES=true`。
- 备份恢复、PostgreSQL、多机和生产级运维仍未实现。

## 下一步

- 执行 Phase 4：项目材料上传、预处理、证据定位与项目内只读问答。
- 保持材料、问答和未来生成任务按 `projectId` 隔离；上传原件、预处理材料和运行数据库不得进入 Git。
- 不提前实现 Phase 5 的 LLM `ChangeProposal` 或 Phase 6 的审核、发布与回滚。
