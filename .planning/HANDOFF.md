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
8. `.planning/phases/05-structured-change-proposals/VERIFICATION.md`

## 当前状态

- Phase 1–5 已实现并通过验收，平台版本为 `0.5.0`。
- 首个项目 `xugu-agentic-group` 与参考 v4.2 脱敏种子语义一致。
- `xugu-agentic-group` 是首个 Xugu Agentic Group Schedule 作战项目；详情页标题、Banner、状态提示、事实与模块标签均按项目模板/术语配置渲染，新增标准项目不得复用 Xugu 作战文案。
- 已有认证、基础角色、项目生命周期、项目切换、九类发布态模块，以及管理员/编辑者只写草稿的模块排序与启停 UI/API。
- 已有项目隔离的材料摄入、证据处理/定位/检索、问答授权和只读带引用项目问答；provider 默认禁用且无密钥可验证。
- 已有六类结构化更新模板、锁定发布基准/材料/证据 manifest 的 generation task、严格 `ChangeProposal`、确定性增量校验、attempt/Token/成本与 Xugu/标准提案工作区；任何生成路径均不写 draft/published。
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
- 结构化提案：`src/proposals/`、`src/services/proposal-service.mjs`、迁移 `005_structured_change_proposals.sql`

## 运行与验证

首次运行需要服务端 `PLATFORM_BOOTSTRAP_PASSWORD`；已有管理员的数据库后续无需再次提供。

```bash
npm run verify
```

当前通过 120 项自动化测试、临时数据库/API/静态冒烟、Xugu 语义等价、Phase 3–5 共十三张浏览器证据哈希/尺寸机检、敏感文件检查和参考项目只读校验。

## 风险和边界

- Phase 2 只有基础用户/成员数据模型，没有用户与成员管理 UI。
- 当前审计覆盖登录、项目生命周期、材料/授权/问答和生成任务动作；审核、草稿合并、发布和回滚审计待 Phase 6 实现。
- 模块配置只写 `draft`，不会改变 `published` 导航；当前没有把草稿发布、合并或回滚的入口。
- Secure Cookie 依赖部署时启用 HTTPS 与 `PLATFORM_SECURE_COOKIES=true`。
- 备份恢复、PostgreSQL、多机和生产级运维仍未实现。

## 下一步

- 执行 Phase 6：按模块审核结构化差异，支持单项接受/驳回/编辑、事务合并草稿、预览清单、发布与回滚。
- 所有审核和版本动作继续按 `projectId`、角色与 CSRF 隔离，并写追加式审计；不得从提案直接越过草稿发布。
- 补齐备份恢复、项目导入导出、参考数据集/质量评估、跨项目安全测试和 Xugu 迁移 UAT。
