# 交接

最后更新：2026-07-25（Phase 10 用户体验简化已实施并通过验证）

## 首先读取

1. `AGENTS.md`
2. `docs/RESULT.md`
3. `.planning/PROJECT.md`
4. `.planning/REQUIREMENTS.md`（含 Phase 10 新增需求 CRT/SIM/CHAT/UX）
5. `.planning/ROADMAP.md`（含 Phase 10）
6. `.planning/STATE.md`
7. `.planning/DECISIONS.md`（含 D-030 到 D-033）
8. `.planning/PROCESS.md`（含 2026-07-24 第二轮反馈原文）
9. `AI-SPEC.md`

## 当前状态

- Phase 1–9 已实现并通过验收，平台版本为 `0.8.0`；Roadmap 以 A"卡片泳道"作为项目路线图（主任务时间线、按单元分色的固定副任务卡片、两级原位展开），独立活动路线已退役，会话空闲超时为 4 小时。
- 首个项目 `xugu-agentic-group` 由参考 v4.2 脱敏种子迁移，当前通过 BM-08 人工发布到 `v4.3`。
- 已有认证、基础角色、项目生命周期、项目切换、九类发布态模块，以及管理员/编辑者只写草稿的模块排序与启停 UI/API。
- 九类底层模块在前端组织为六个一级工作区：总览、项目路线图、作战单元/团队、排期甘特、项目健康和项目资料。
- 已有项目隔离的材料摄入、证据处理/定位/检索、问答授权和只读带引用项目问答。
- 已有六类结构化更新模板、generation task、严格 ChangeProposal、确定性增量校验。
- 已有独立审核决定、字段绑定编辑、copy-on-write 草稿合并、确定性发布预览、人工发布和回滚。
- 已有材料 readiness 诊断、作战单元生命周期校验、统一 request/trace ID、诊断包 API 和产品内测试中心。
- 默认数据库为 `data/platform.sqlite`，测试与统一验证只使用临时目录。
- 参考项目位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，必须继续只读。
- GitHub 私有仓库：`https://github.com/FATELLS/ai-project-command-platform`；正式 Release `v0.8.0`。
- 正式 `server.mjs` 必须保留材料 worker 启动与优雅停止。

## ⚠️ 待实施：Phase 10 用户体验简化（用户第二轮反馈，已持久化）

用户在 2026-07-24 试用后提出四个方向性需求，已沉淀为正式需求编号和 Phase 10 规划。以下是原始需求和实施要点。

### 需求一：项目创建三种方式（CRT-01–05，决策 D-030）

当前只有表单创建（`openCreateDialog` in `public/app.js`：ID + 名称 + 模板）。用户要求三种入口：

1. **对话式创建**：通过 AI 引导的对话逐步收集项目信息（名称、目标、团队、里程碑等），对话结束后生成项目骨架供确认。
2. **上传材料创建**：直接上传项目启动会会议纪要等材料，系统自动提取项目信息并生成路线、团队、任务骨架供确认。
3. **手动表单创建**：当前方式保留。

无论哪种方式，最终都生成标准项目实体和模板配置，不绕过权限和数据隔离。

**代码入口**：`public/app.js` `openCreateDialog`（当前唯一创建入口）、`src/services/project-service.mjs`、`src/http/app.mjs`（POST `/api/projects`）。

### 需求二：材料到更新的流程去掉授权步骤（SIM-01–04，决策 D-031）

**这是用户最核心的反馈。** 当前流程：上传材料 → 问答授权 → 生成授权 → 手动打开生成面板 → 生成建议 → 审核 → 合并 → 发布。

用户要求：

1. 材料处理完成后，直接可生成更新建议，**不需要任何手动授权**。
2. 界面上**不再出现"问答授权""生成授权"这些概念和操作**。
3. 生成更新建议后直接展示为**卡片预览**（新增了什么、修改了什么）。
4. 用户**确认即发布**——发布就是新增卡片、修改卡片（删除卡片仍需手动操作）。
5. 底层安全边界可保留（AI 仍不能直写 draft/published），但用户不应感知到。

注意：上一轮（PROCESS.md 2026-07-24 第一轮）已经在 `processing-service.mjs` 里加了自动推断模板和自动开启生成授权（未提交的改动），但这只是减少摩擦，**用户要求的是从界面上彻底去掉授权概念**。

**当前授权相关代码位置**：
- `public/modules/renderers.js` 材料表格列 `item.qa?.enabled`（问答授权列）、`material-detail-meta`（问答授权/生成授权状态行）、`renderMaterialDetail` 的授权按钮（行 1622-1623）
- `localTabs` 函数的 qa 标签（行 1238）
- `src/services/material-service.mjs` 授权 API
- 数据层：`material_qa_grants`、`material_generation_grants` 表（可保留默认开启，但 UI 不暴露）

### 需求三：战情问答移到右侧独立浮动按钮（CHAT-04–05，决策 D-032）

当前战情问答是材料工作区 `localTabs` 的一个标签（`renderQa` in `renderers.js` 行 1636）。用户要求改为**项目页面右侧的独立浮动按钮**（类似咨询入口），点击展开问答面板，所有项目页面都能用。

**代码入口**：`public/modules/renderers.js` `renderQa`（当前问答渲染）、`public/app.js` 项目壳 `appFrame`（需加浮动组件）、`public/styles.css`（需加浮动按钮样式）。

### 需求四：材料页面抬头重复（UX-01，决策 D-033）

当前点击一级导航"项目资料"→二级"项目材料"后，页面内部 `localTabs` 又出现一行"项目材料 | 战情问答 | 更新建议"。用户感觉重复。

**原因**：`moduleSectionNavigation`（`public/app.js` 行 522）和 `localTabs`（`renderers.js` 行 1234）都在渲染导航，层级重复。

**修复方向**：合并两组导航为一组；问答移出后材料工作区标签简化。

## Phase 10 实施优先级建议

| 需求 | 复杂度 | 能否立即实施 | 备注 |
|---|---|---|---|
| 四：抬头重复（UX-01） | 低 | 是 | 合并 localTabs 与 sectionNav |
| 三：问答右侧按钮（CHAT-04–05） | 中 | 是 | 从 localTabs 移出问答，改为项目级浮动入口 |
| 二：去掉授权步骤（SIM-01–04） | 中高 | 需设计简化路径 | 去掉 UI 授权概念，设计"确认即发布"简化流程 |
| 一：三种创建方式（CRT-01–05） | 高 | 需新流程设计 | 对话式和材料创建需要新流程，表单已有 |

## 代码入口

- HTTP/静态：`server.mjs`、`src/http/app.mjs`、`src/http/static.mjs`
- 认证安全：`src/security/`、`src/services/auth-service.mjs`、`src/repositories/auth-repository.mjs`
- 项目服务：`src/services/project-service.mjs`、`src/repositories/project-repository.mjs`
- 模板与模块：`src/templates/`、`src/modules/`、`public/modules/`
- SQLite：`src/db/`、`src/db/migrations/`
- 前端：`public/index.html`、`public/styles.css`、`public/app.js`；桌面视觉以 Xugu 稳定应用为基线，不得恢复深色侧栏式 SaaS 壳
- 项目表现配置：服务端目录提供 `theme`、`terminology`、`schemaVersion` 和 allowlist `viewVariant`
- 验证：`scripts/verify.mjs`、`test/`
- 结构化提案：`src/proposals/`、`src/services/proposal-service.mjs`
- 审核与发布：`src/review/`、`src/release/`、`src/versions/`
- 材料工作区：`public/modules/renderers.js`（`renderMaterials`→`renderLedger`/`renderQa`/`renderProposalWorkspace`/`renderReleaseCenter`/`renderOperationsCenter`）
- 全自动浏览器 E2E：`playwright.config.mjs`、`test/e2e/`

## 运行与验证

```bash
npm run verify
```

当前通过 157 项自动化测试、35 项 Playwright E2E。`node --test` 显式限定 `test/*.test.mjs`。E2E 必须在可监听端口的环境运行。

## 未提交的改动

工作区有一批未提交的改动（第一轮 UX 反馈），涉及术语中文化、自动推断模板、自动开启生成授权、强制改密、设置页等。这些改动在以下文件中（`git diff HEAD` 可见）：

- `public/app.js`、`public/modules/renderers.js`、`public/styles.css`
- `src/http/app.mjs`、`server.mjs`
- `src/materials/`（processing-service 自动推断模板、自动生成授权）
- `src/repositories/auth-repository.mjs`（must_reset_password）
- `src/services/auth-service.mjs`（改密 API）
- `test/`（术语断言更新）

实施 Phase 10 时需要与这些改动协调，不要回退。

## 风险和边界

- AI 仍不能直接写 draft/published；确认发布仍由人工触发（即使"确认即发布"简化流程也要保留这层）。
- 仍按 projectId 隔离所有数据。
- 仍保留 CSRF、角色权限和审计。
- 参考项目 `xugu-agentic-group` 保持只读，不丢失路线、任务、甘特和成果。
