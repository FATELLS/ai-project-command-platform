# 交接

最后更新：2026-07-20

## 首先读取

1. `AGENTS.md`
2. `docs/RESULT.md`
3. `.planning/PROJECT.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/ROADMAP.md`
6. `.planning/STATE.md`
7. `AI-SPEC.md`
8. `.planning/phases/06-review-publish-operations/VERIFICATION.md`
9. `.planning/phases/07-release-hardening-material-readiness/CONTEXT.md`
10. `.planning/phases/08-roadmap-visual-workbench/CONTEXT.md`
11. `.planning/phases/08-roadmap-visual-workbench/SPEC.md`
12. `.planning/phases/08-roadmap-visual-workbench/VERIFICATION.md`

## 当前状态

- Phase 1–8 已实现并通过验收，平台版本为 `0.8.0`；Phase 8“路线图可视化工作台与卡片化审核”已交付（四视图、拖拽到受控提案、卡片化审核）。
- 首个项目 `xugu-agentic-group` 与参考 v4.2 脱敏种子语义一致。
- `xugu-agentic-group` 是首个 Xugu Agentic Group Schedule 作战项目；详情页标题、Banner、状态提示、事实与模块标签均按项目模板/术语配置渲染，新增标准项目不得复用 Xugu 作战文案。
- 已有认证、基础角色、项目生命周期、项目切换、九类发布态模块，以及管理员/编辑者只写草稿的模块排序与启停 UI/API。
- 已有项目隔离的材料摄入、证据处理/定位/检索、问答授权和只读带引用项目问答；provider 默认禁用且无密钥可验证。
- 已有六类结构化更新模板、锁定发布基准/材料/证据 manifest 的 generation task、严格 `ChangeProposal`、确定性增量校验、attempt/Token/成本与 Xugu/标准提案工作区；任何生成路径均不写 draft/published。
- 已有独立审核决定、字段绑定编辑与重新校验、整模块接受、copy-on-write 草稿合并、确定性发布预览、人工发布和直接前驱回滚；所有动作按角色/项目/CSRF 隔离并追加审计。
- 已有平台用户与项目成员管理 API、发布中心成员/审计只读区、一致 SQLite 备份和校验后离线恢复脚本、显式模板项目导入和脱敏导出。
- 已有材料关键内容 readiness 诊断、作战单元新增/归档/退出生命周期校验、统一 request/trace ID、脱敏堆栈错误事件、诊断包 API 和产品内测试中心。
- `campaign-map-v1@1.0.0` 与 `standard-project-v1@1.0.0` 共用九类固定渲染器；标准验收夹具为 3 团队、7 任务、4 里程碑、2 工作流。
- Xugu 战役路线图主图的作战单元分支胶囊不是装饰：它们必须保持可点击、可键盘触发、`unit` 深链、选中态和下方对应分支高亮置顶。
- Phase 8 将保留上述现有交互并扩展为四种固定视图：活动路线图、阶段卡片板、作战单元进度、依赖网络。活动路线图采用时间列内的阶段、目标、分支、任务卡；卡片板按状态泳道展示任务。所有选择必须就地展开并能恢复深链，不能把详情隐藏到远处页面。
- 材料生成后的建议需要以审核卡片展示新增、更新、归档与关键缺失。卡片移动、状态推进或字段变更只能创建/编辑既有 `ChangeProposal`，继续经过审核、copy-on-write 草稿合并和人工发布；绝不成为直写看板。
- 当前 Codex 任务的 built-in imagegen 出口对图像生成 endpoint 超时，未能生成 Phase 8 效果图；这仅是本会话工具环境问题，不能用本地截图替代，也不影响 Phase 8 的文档化需求或代码实现。
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
- 审核与发布：`src/review/`、`src/release/`、`src/versions/`、迁移 `006_review_publish_operations.sql`
- 运维与成员：`src/operations/database-backup.mjs`、`src/services/member-service.mjs`、`scripts/backup-database.mjs`、`scripts/restore-database.mjs`
- Phase 7 运维硬化：`src/materials/readiness-service.mjs`、`src/operations/observability.mjs`、`src/operations/product-test-service.mjs`、迁移 `007_release_hardening_readiness_observability.sql`
- 全自动浏览器 E2E：`playwright.config.mjs`、`test/e2e/`（spec 与 `fixtures/server.mjs` fixture server、`helpers.mjs`、`global-setup.mjs`）
- Phase 8 路线图工作台：`public/modules/renderers.js`（`renderRoadmap`/`renderRoadmapBoard`/`renderRoadmapUnits`/`renderRoadmapNetwork`、`activityTimelineColumns`、`openInteractionProposal`）、`src/modules/loaders.mjs`（units/tasks/edges 投影）、`src/services/proposal-service.mjs`（`createInteractionProposal`）、`src/proposals/catalog.mjs`（`interaction` 模板）、`test/interaction-proposal.test.mjs`、`test/e2e/05-roadmap-views.spec.mjs`

## 运行与验证

首次运行需要服务端 `PLATFORM_BOOTSTRAP_PASSWORD`；已有管理员的数据库后续无需再次提供。

```bash
npm run verify
```

当前通过 148 项自动化测试、临时数据库/API/静态冒烟、Xugu 语义等价、Phase 3–6 共十九张浏览器证据哈希/尺寸机检、备份恢复、诊断/自检接口、敏感文件检查和参考项目只读校验。

E2E（`npm run test:e2e`，首次需 `npm run e2e:install` 安装 Chromium）：自动启动临时数据库的 fixture server + Chromium，跑 26 个浏览器用例（登录导航、路线图深链与模块化下钻、材料→生成→审核→发布/回滚、隔离与安全），已接入 `npm run verify`。`node --test` 显式限定 `test/*.test.mjs`，避免默认发现把 fixture server 当作测试文件阻塞。`verify` 的 Playwright 步骤自动选空闲端口，避免与运行中实例冲突；`test/e2e/03|04|05` 的 `BASE` 读 `E2E_PORT`。受限沙盒如禁止监听 `127.0.0.1` 会报 `EPERM`，属环境限制非回归；E2E 必须在可监听端口的环境运行。

## 风险和边界

- 用户/成员已有安全 API，发布中心只展示当前成员；独立的完整用户目录管理 UI 留待试用反馈决定。
- 模块配置仍只写 `draft`；审核接受、草稿合并与人工发布是三个显式步骤，提案没有直达发布路径。
- Secure Cookie 依赖部署时启用 HTTPS 与 `PLATFORM_SECURE_COOKIES=true`。
- PostgreSQL、多机、实时协同和外部身份提供商仍未实现；首版备份恢复要求应用离线执行恢复。

## 下一步

- Phase 8 设计契约与验证见 `.planning/phases/08-roadmap-visual-workbench/SPEC.md` 与 `VERIFICATION.md`；后续可按试用反馈打磨视图信息密度与拖拽证据选择体验。
- 路线图模块化重设计（粗主线 + 支线下钻）已实现并全绿验证；timeline 视图主线改为阶段节点 + 模块摘要芯片，节点详情改为作战单元模块卡片下钻，移除原分支胶囊/时间列/全展开分支图。
- 进入内部单服务器试用完整材料→提案→审核→合并→发布→回滚流程，收集可用性、材料模板质量和角色运营反馈。
- 后续里程碑再评估完整成员管理 UI、外部身份提供商、部署自动化和 PostgreSQL 迁移需求。
- 保持 Xugu 参考项目只读，任何新增项目继续通过模板、数据、术语与主题配置表达差异。
