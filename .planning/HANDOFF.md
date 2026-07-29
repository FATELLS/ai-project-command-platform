# 交接

最后更新：2026-07-29（项目更新四步主流程已验证）

## 首先读取

1. `AGENTS.md`
2. `docs/RESULT.md`
3. `.planning/PROJECT.md`
4. `.planning/REQUIREMENTS.md`（含 Phase 11 WUI-01–25）
5. `.planning/ROADMAP.md`（含 Phase 11）
6. `.planning/STATE.md`
7. `.planning/DECISIONS.md`（含 D-034 到 D-049）
8. `.planning/PROCESS.md`（含 2026-07-29 Phase 11 规格化记录）
9. `.planning/design/system/README.md`
10. `.planning/design/system/SYSTEM-SPEC.md`
11. `.planning/design/system/ARCHITECTURE.md`
12. `.planning/design/system/TRACEABILITY.md`
13. `.planning/phases/11-workflow-first-ui/README.md`
14. `.planning/phases/11-workflow-first-ui/11-SPEC.md`
15. `.planning/phases/11-workflow-first-ui/UI-SPEC.md`
16. `.planning/phases/11-workflow-first-ui/TRACEABILITY.md`
17. `.planning/phases/11-workflow-first-ui/11-VERIFICATION.md`
18. `AI-SPEC.md`

## 当前状态

- Phase 1–9 已实现并通过验收，平台版本为 `0.8.0`；Roadmap 以 A"卡片泳道"作为项目路线图（主任务时间线、按单元分色的固定副任务卡片、两级原位展开），独立活动路线已退役，会话空闲超时为 4 小时。
- Phase 10 已实现并通过验证；全项目 canonical system design 已按八个长期模块建立；Phase 11 是 Product Experience 模块的 `implementation in progress` 演进，第一实施切片已验证。
- Phase 11 后多文档 UI 复跑已从 DOCX/XLSX/TXT/JSON 走到真实生成、逐项审核、草稿合并、人工发布和路线图验收；连续上传按钮与路线日期投影回归已修复，证据见 `.planning/benchmarks/project-progression-ui/RESULT.md`。
- 首个项目 `xugu-agentic-group` 由参考 v4.2 脱敏种子迁移，当前通过 BM-08 人工发布到 `v4.3`。
- 已有认证、基础角色、项目生命周期、项目切换、九类发布态模块，以及管理员/编辑者只写草稿的模块排序与启停 UI/API。
- 九类底层模块在前端组织为六个一级工作区：总览、项目路线图、作战单元/团队、排期甘特、项目健康和项目资料。
- 已有项目隔离的材料摄入、证据处理/定位/检索、问答授权和只读带引用项目问答。
- 已有六类结构化更新模板、generation task、严格 ChangeProposal、确定性增量校验。
- 项目资料负责长期战果和材料台账；独立 `/updates` 流程从本次更新材料开始，再进入处理与生成、模拟路线图、人工审核和发布，并直接复用正式路线图 renderer。AI 新增/修改高亮，本次之外的发布节点降亮只读。
- 正式路线图阶段/任务卡片均提供受控编辑并生成 interaction proposal；节点预览只允许编辑本次生成卡片，既有节点降亮并明确只读，删除均要求精确输入“确认删除”。
- 顶栏、路线图、卡片编辑和项目创建方式使用共享线性图标目录；纯图标具备可访问名称与 tooltip，卡片工具不遮挡内容。
- 已有独立审核决定、字段绑定编辑、copy-on-write 草稿合并、确定性发布预览、人工发布和回滚。
- 已有材料 readiness 诊断、作战单元生命周期校验、统一 request/trace ID、诊断包 API 和产品内测试中心。
- 默认数据库为 `data/platform.sqlite`，测试与统一验证只使用临时目录。
- 参考项目位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，必须继续只读。
- GitHub 私有仓库：`https://github.com/FATELLS/ai-project-command-platform`；正式 Release `v0.8.0`。
- 正式 `server.mjs` 必须保留材料 worker 启动与优雅停止。
- 源码后台运行使用 `npm run start:background/status/stop/restart`；只管理平台 Node PID，严禁把虚谷数据库或 Docker 容器加入平台 `stop`。
- 总览主操作为“项目更新”，进入独立 `/updates` 四步流程；通用入口先上传或选择本次材料，项目资料仍保留长期材料台账。
- 创建与项目更新入口共享六类材料模板；创建 API 与材料 gate 对空文件、类型和签名保持对称校验。
- 独立 `test:e2e:abnormal` 覆盖异常创建/更新、阶段用途不匹配和 UI 节点预览定位，并已纳入 `npm run verify`。

## Phase 11 当前进展

Phase 11 的实现输入位于 `.planning/phases/11-workflow-first-ui/`：

- `11-SPEC.md`：WUI-01–25、用户流程、状态映射、验收和 ambiguity gate。
- `UI-SPEC.md`：页面骨架、首屏、字号、色彩、间距、响应式和无障碍契约。
- `TRACEABILITY.md`：需求到模块、代码面和验证证据的映射。
- `11-VERIFICATION.md`：第一实施切片的逐项结论、证据和剩余缺口。
- `modules/*/ADR.md`：八个模块的关键取舍。
- `modules/*/DESIGN.md`：页面层级、状态机、角色、数据契约和验收。

已完成：

1. 平台壳、项目入口、六工作区导航和单 H1 层级。
2. 总览、材料、审核发布、创建确认和平台设置的第一轮工作流重排。
3. 移动端核心内容保留、44px 点击目标和三视口自动化。
4. 设置连接测试服务与前端状态反馈。
5. 创建与全部更新入口的统一模板下载，以及异常材料无部分状态验证。
6. AI 节点预览固定入口、业务化文案和默认路线图位置投影；人工材料生成资格保持无感自动开启。
7. 正式路线图和节点预览共享卡片编辑器；正式节点变更走审核，预览仅本次卡片可编辑，删除采用精确短语确认。
8. 项目资料与项目更新拆分；更新页仅保留一张复用正式 renderer 的路线图，旧专用预览 DOM/CSS 与重复控制台已删除。
9. 共享线性图标语言和对象内卡片工具位；窄卡布局、移动触控与可访问名称已验证。
10. 项目更新通用入口固定从本次材料开始；生成任务、具体 proposal 预览、逐项审核和人工发布组成可追踪四步流程，历史更新仅作为次级继续入口。

下一切片按此顺序实施：

1. 收紧查看者直接读取提案的服务端边界，并更新既有角色契约。
2. 建立总览“需要处理 / 当前进展 / 近期变化”的确定性聚合投影。
3. 扩展 `ProjectSkeleton` 到团队、阶段和任务，并完成三入口 E2E。
4. 编排可恢复的“确认并发布”，覆盖 merge 成功但 publish 失败。
5. 补齐尚未覆盖的 worker 终态失败动作、全弹窗键盘 UAT和两模板×四角色视觉矩阵。

Phase 11 不改变 `proposal / draft / published`、固定九模块、六工作区、projectId 隔离、CSRF、审计和模板术语边界。

## 全项目系统设计

`.planning/design/system/` 是长期设计事实入口：

- `SYSTEM-SPEC.md`：整个产品目标、角色、核心对象、系统能力、不变式、信任边界和系统级验收。
- `ARCHITECTURE.md`：模块依赖、运行时、数据架构、主要数据流、版本模型、故障和安全语义。
- `TRACEABILITY.md`：需求、中央决策、阶段、代码和测试映射。
- `modules/*/ADR.md` 与 `DESIGN.md`：八个系统模块的关键取舍和完整设计。

Phase 目录仍保留，用于记录历史演进和下一次实施输入；不能用单个 Phase 文档代替全项目设计。

## Phase 10 历史上下文（已实施）

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

当前通过 180 项后台/静态测试、48 项主流程 Playwright E2E 和 9 项隔离异常材料与节点预览 E2E。`node --test` 显式限定 `test/*.test.mjs`。E2E 必须在可监听端口的环境运行。

## 未提交的改动

当前未提交改动为 2026-07-29 更新后验证修复，主要涉及：

- 九模块契约恢复 `outcomes`：`src/templates/`、`src/modules/`、`public/modules/`、`public/app.js`
- 登录限流恢复：`src/http/app.mjs`
- PDF/图片无 vision provider 时的本地工具 fallback：`src/materials/extractors/pdf.mjs`、`src/materials/extractors/image.mjs`
- 迁移 008–010 验证基线同步：`test/database-backup.test.mjs`、`scripts/verify.mjs`
- 路线图/节点预览卡片编辑：`public/modules/renderers.js`、`public/styles.css`、`src/review/`、`src/proposals/`、`src/http/app.mjs`
- 状态与结果文档同步：`docs/RESULT.md`、`.planning/STATE.md`、`.planning/PROCESS.md`、`.planning/HANDOFF.md`

## 风险和边界

- AI 仍不能直接写 draft/published；确认发布仍由人工触发（即使"确认即发布"简化流程也要保留这层）。
- 仍按 projectId 隔离所有数据。
- 仍保留 CSRF、角色权限和审计。
- 参考项目 `xugu-agentic-group` 保持只读，不丢失路线、任务、甘特和成果。
