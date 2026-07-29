# 项目过程

## 2026-07-18：项目初始化

状态：`accepted`

- 用户要求为多项目、模板化、LLM 辅助更新的项目管理平台新建独立项目。
- 新项目暂定名为“AI 项目作战管理平台”，目录为 `outputs/ai-project-command-platform/`。
- 现有虚谷项目不在原目录继续大规模重构，而是作为 `xugu-agentic-group` 首个迁移夹具。
- 已建立项目愿景、需求、路线图、状态、决策、AI 契约、架构、迁移说明和验证脚本。
- GSD 新项目技能引用的本机工作流文件缺失，因此按其要求的产物和门槛手工完成初始化。

## 2026-07-18：Phase 1 开始执行

状态：`accepted`

- 用户已明确授权开始实施，并指定 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/` 为参考项目。
- 参考项目保持只读；新平台仅读取其脱敏种子、已确认业务语义和 API 行为。
- 已确认 `fixtures/projects/xugu-agentic-group.json` 与参考项目 `data/state.seed.json` 的 SHA-256 完全一致。
- Phase 1 实施范围为项目域模型、SQLite 迁移、版本仓储、项目级 API、虚谷导入/导出和确定性验收。
- GSD 技能引用的 `gsd-core` 工作流文件仍未安装；继续按技能要求的研究、计划、检查、分波执行和验证门槛手工编排。

## 2026-07-18：Phase 1 实现完成

状态：`accepted`

- 研究、三个执行计划和验收门槛已写入 `.planning/phases/01-project-domain-data-foundation/`。
- 专用 GSD 研究、规划、检查、执行和阶段验证角色在本机均未能在限定时间内产出文件，已中止并由主 Agent 按同一产物和门槛完成实施与目标回溯验证。
- 实现 Node.js 内置 SQLite 迁移、规范化版本实体、项目仓储、旧夹具导入/导出、项目级读 API 和旧 `/api/public` 兼容入口。
- 通过 12 项自动化测试，覆盖迁移校验和、事务回滚、任务图、幂等导入、冲突拒绝、语义导出、两项目隔离和 API 路由。
- 统一 `npm run verify` 额外使用临时数据库完成导入/导出和 API 冒烟，并校验参考项目未变。
- 未实现或开放后续阶段的登录、UI、材料、AI 提案、审核、发布和回滚能力。

## 2026-07-18：Phase 2 开始执行

状态：`accepted`

- 用户在 Phase 1 完成后明确要求继续；`gsd-progress` 将当前工作路由到 Phase 2。
- 实施范围为登录与会话、基础项目角色、授权项目列表/搜索/筛选/最近访问、项目创建/编辑/归档/恢复、项目切换器和项目详情壳。
- 前端延续虚谷蓝、白、暖橙品牌语言，但平台级导航与单项目作战视觉保持层级区分。
- Phase 2 不提前实现 Phase 3 的九类模块渲染器，也不实现材料、AI 提案、发布或回滚。

## 2026-07-18：Phase 2 实现完成

状态：`accepted`

- 完成 scrypt 密码、摘要会话、CSRF、限流、空闲/绝对过期、四类基础角色与授权项目隔离。
- 完成项目列表、搜索、筛选、最近访问、项目切换、发布态概览以及创建、编辑、归档、恢复事务 API/UI。
- 平台前端只使用本地固定组件，延续 Xugu 蓝白暖橙语言；Phase 3 模块均明确标为“即将开放”。
- 30 项自动化测试全部通过；真实浏览器完成三视口、双项目切换、生命周期、查看者、会话过期与退出后 Back 验收。
- 浏览器证据保存在 `.planning/evidence/`；阶段目标回溯记录见 Phase 2 `VERIFICATION.md`。
- 参考 Xugu 应用保持只读，其 HEAD、Git 状态和种子哈希在统一验证前后完全一致。

## 2026-07-18：Phase 2 视觉方向修正

状态：`accepted`

- 用户确认当前平台壳过于接近通用 SaaS，要求桌面界面与 Xugu Agentic Group Schedule 稳定应用基本一致。
- 保留已经验证的认证、权限、项目检索、切换和生命周期逻辑；返工范围集中在平台页与项目壳的信息结构和视觉呈现。
- 桌面端改以 Xugu 的白色顶部导航、暖色指挥背景、目标 Hero、章节卡片和作战现场层级为基线，移除 72px 深色侧栏。
- 多项目能力收敛为顶部项目入口/切换和项目管理区域，不用新的平台视觉覆盖 Xugu 原有界面语言。
- 响应式继续保留为兼容能力，但不再作为桌面设计的主导方向。

## 2026-07-18：项目文案与 Banner 模板化

状态：`accepted`

- 用户要求项目页 Banner、标题、状态区、事实标签和模块名称随项目创建与模板变化，不得把 Xugu 文案硬编码为所有项目的页面。
- `xugu-agentic-group` 继续作为首个 Xugu Agentic Group Schedule 项目，使用作战项目话术。
- `campaign-map-v1` 使用作战单元、行动任务、战役路线、战果等术语；`standard-project-v1` 使用团队、任务、里程碑、交付物等标准项目术语。
- 平台级入口保持统一，进入项目后头部品牌、Hero、当前状态和模块导航由项目数据与模板术语共同驱动。

## 2026-07-18：Phase 3 规划启动

状态：`accepted for planning`

- Phase 2 已完成且无未结项，后续工作进入 Phase 3「模块注册表与项目模板」。
- 先完成实现研究与 UI 设计契约，再生成并检查可执行计划；本步骤不把规划内容提前写成已实现结果。
- 九类模块采用服务端白名单注册表和前端固定 renderer；模板只提供版本化数据配置。
- 模块启停与排序只写 draft，风险/指标建立最小规范化契约，材料能力仍留在 Phase 4。

## 2026-07-18：Phase 3 实现完成

状态：`accepted`

- 完成 `campaign-map-v1@1.0.0`、`standard-project-v1@1.0.0`、迁移 003、标准项目验收夹具和确定性种子脚本。
- 完成九类服务端注册表、版本化 Schema/视图 allowlist、项目/层级安全模块 API，以及只写草稿的完整列表配置事务。
- 完成九类仓库内固定渲染器；Xugu 使用作战路线/分支网络/甘特/战果视图，标准项目使用线性路线/依赖列表/泳道甘特/交付物语言。
- 55 项自动化测试全部通过；真实浏览器完成 16 个阻断用例和四张哈希/尺寸机检证据，三视口无页面级溢出，恶意文本未执行。
- 参考 Xugu 应用保持只读，HEAD、干净状态与种子哈希未变。
- Phase 3 只交付材料模块契约页，不包含上传或问答；AI 提案、审核、发布和回滚仍未实现。

## 2026-07-18：Phase 4 规划启动

状态：`accepted for planning`

- 用户授权离线期间继续完成后续路线图；当前先进入 Phase 4「项目材料与证据层」。
- 材料摄入采用项目隔离的流式 staging、服务端门阀、两阶段登记、可恢复处理任务和类型化证据定位。
- 问答采用本仓库确定性 FTS5 检索、受控上下文、引用 allowlist 和无工具 provider；默认无密钥也可完成全部非联网验证。
- ClamAV/CDR 为部署强化 hook，不作为当前内部单机验收的强制依赖；若配置为必需则不可用时 fail closed。
- 更新模板选择在本阶段只记录用途意图；`ChangeProposal`、审核、草稿合并、发布和回滚继续留在 Phase 5–6。

## 2026-07-18：Phase 4 实现完成

状态：`accepted`

- 完成迁移 004、流式安全摄入、项目材料台账、处理租约、证据代际/FTS、问答授权、独立配额和 provider 并发控制。
- 完成手工文本与常见文本/Office/PDF/图片的有界提取契约，保留段、页、幻灯片、单元格、边界框或 OCR 定位；失败不发布部分代际。
- 完成只读项目 RAG：当前发布事实与显式授权材料同项目过滤，证据视为不可信数据，输出引用必须命中 allowlist；无证据或 provider 未配置时诚实拒绝。
- Xugu 和标准项目通过同一固定材料 renderer 显示各自模板术语；人工材料、证据导航、禁用态问答和项目切换已通过真实浏览器验收。
- 94 项自动化测试、15 个 Phase 4 浏览器用例、四张哈希/尺寸机检截图和统一验证全部通过；参考 Xugu 应用未被修改。
- Phase 4 未创建提案，也未写入 draft/published；下一阶段进入结构化 `ChangeProposal`。

## 2026-07-18：Phase 5 规划启动

状态：`accepted for planning`

- 生成任务锁定项目、当前发布版本、模板、材料和证据代际；只生成相对当前 `published` 的结构化增量。
- `ChangeProposal` 使用仓库内版本化 Schema、六类 allowlist 模板与固定模块/操作；模型输出不能选择代码、项目或执行路径。
- 服务端独立验证证据、语义、日期、任务依赖 DAG、重复项和 base version 冲突，任何失败都不会写入 `draft`/`published`。
- generation 配额、并发、attempt、token 和 cost 与 chat 分账；浏览器只展示结构化任务/提案，不提前提供 Phase 6 审核或发布动作。

## 2026-07-18：Phase 5 实现完成

状态：`accepted`

- 完成迁移 005、六类不可变更新模板、`change-proposal-v1@1.0.0`、规范化生成任务/attempt/提案/证据关系和项目复合约束。
- 完成锁定发布基准与当前证据 manifest 的生成编排、独立 provider/配额、幂等、stale、一次修复、重试 lineage、Token/成本记录和稳定失败状态。
- 完成确定性 envelope、项目/证据、模板/字段、目标、语义、日期、依赖 DAG、重复与版本冲突校验；仅完整通过的提案原子保存，任何路径均不写 draft/published。
- 完成 Xugu/标准项目提案工作区、任务/提案详情、置信度/警告、精确来源回跳和无密钥诚实降级；未提前开放 Phase 6 动作。
- 120 项自动化测试、15 个 Phase 5 浏览器用例、5 张哈希/尺寸机检截图和统一验证全部通过；参考 Xugu 应用未被修改。

## 2026-07-18：Phase 6 规划启动

状态：`accepted for planning`

- 审核决定与 proposal item 分离保存；编辑值复用锁定证据 envelope 和确定性 validator。
- 接受项通过 copy-on-write 新 draft version 事务合并，验证成功后才切换 draft pointer。
- 发布从当前 draft 创建新 published 和新 draft 基线；回滚只允许当前发布版本的直接前驱。
- 审核、合并、发布、回滚、备份恢复和导入导出均纳入项目权限、CSRF、追加审计与跨项目测试。

## 2026-07-18：Phase 6 实现完成

状态：`accepted`

- 完成迁移 006、审核决定/合并/发布事件实体、copy-on-write 版本复制、受控字段应用和完整图验证。
- 完成逐项接受/驳回/编辑、整模块接受、事务草稿合并、发布预览清单、人工发布和直接前驱回滚 API/UI；AI 没有任何审核、草稿或发布写路径。
- 浏览器 UAT 发现审核编辑的未知 `unitId` 未在保存时拒绝，已将 `TASK_UNIT_NOT_FOUND` 校验前移并增加回归测试；再次验收通过。
- 浏览器 UAT 发现版本元数据时间戳被误算为 Overview 业务差异、发布后外层版本标题未刷新，均已修正并重新截图。
- 完成用户/成员安全 API、追加式项目审计、SQLite 一致备份/校验/离线恢复、显式模板导入、10 项参考评估与跨项目安全矩阵。
- 138 项自动化测试、17 项 Phase 6 浏览器用例、6 张哈希/尺寸机检证据与统一验证全部通过；参考 Xugu HEAD、状态和种子哈希未变。

## 2026-07-20：Phase 7 规划启动

状态：`accepted for planning`

- 用户指出“上传材料即可更新项目”还需要覆盖作战单元新增、归档和退出，并同意规划 Phase 7。
- 当前代码已支持 `units` 的新增/更新提案，但未把归档、退出、关键缺失诊断和单位生命周期引用校验做成产品能力。
- Phase 7 范围确定为发布前硬化：材料关键内容覆盖检查、作战单元生命周期提案、生产请求追踪、脱敏错误堆栈、诊断包和产品内测试中心。
- `gsd-plan-phase` 技能已读取；其引用的本机 `gsd-core` 工作流文件缺失，因此按仓库既有 GSD 产物和门槛手工补充 Phase 7 规划。

## 2026-07-20：Phase 7 实现完成

状态：`accepted`

- 完成迁移 007、材料 readiness 规则/快照、生成上下文阻断、生成任务 readiness 记录和 Materials UI 关键内容标记。
- 完成作战单元 `active / archived / exited` 生命周期字段、提案目录/Schema/validator、copy-on-write 应用和完整图校验；单位删除失败关闭。
- 完成 requestId/traceId、脱敏 5xx 错误事件、诊断包 API、项目管理员访问控制和产品内“运维自检”中心。
- 新增材料 readiness、作战单元生命周期、observability/product-test 三组回归测试，并把迁移 007 纳入数据库、备份和统一验证清单。
- `npm test` 144 项通过；`npm run verify` 通过语法、自动化测试、Phase 3–6 浏览器证据、迁移、隔离、Xugu 等价和参考只读校验。
- 本机浏览器抽查确认可登录、进入 `xugu-agentic-group` Materials 模块，并在“运维自检”运行 `core · passed`、`5/5 通过`。

## 2026-07-20：战役路线图节点交互修正

状态：`accepted`

- 用户指出 Xugu 战役路线图不能降级为不可点击的普通可配置模块，需要保持路线图表达，并能切换到具体战役节点。
- 修正 Roadmap DTO，传出阶段预览标题、说明和本地预览资源；固定 renderer 仍只读取受控项目数据，不执行项目代码。
- 修正战役路线 SVG 与文本替代列表，阶段节点均可点击/键盘触发并写入 `?stage=...` 深链；详情面板展示对应战役节点。
- 浏览器验证点击“试点验证攻坚”后 URL 为 `/projects/xugu-agentic-group/modules/roadmap?stage=pilot`，详情切换为该节点。
- `npm test` 与 `npm run verify` 均通过，参考 Xugu 应用保持只读未变。

## 2026-07-20：战役路线图分支与列表修正

状态：`accepted`

- 用户指出路线图上多出两个小黄点、下方完整阶段列表不应展示，并要求考虑多作战单元多任务分支。
- 移除路线主图中的闭环 marker，主路线只保留 6 个战役节点；闭环仍保留在成果/闭环数据中，不再冒充路线节点。
- 移除可见阶段列表，改为点击路线节点后在下方显示节点详情。
- 在节点详情中按战役时间窗口推断并展示作战单元分支任务；分支任务可点击并写入 `task` 深链，详情显示负责人、日期、状态、预期产出和任务网络跳转。
- 浏览器验证 `stage=launch` 下无 `.closure-marker`、无 `.stage-alternative`，分支任务按作战单元显示；点击“财务数据治理与安全分类”后 URL 为 `?stage=launch&task=finance-data-security` 并显示任务详情。
- `npm run verify` 通过，参考 Xugu 应用保持只读未变。

## 2026-07-20：路线图与作战单元就地展开修正

状态：`accepted`

- 用户指出分支任务应体现在主线路线图中，且作战单元/支线任务点击后必须在当前交互位置展开详情，避免用户滚动很久才发现变化。
- 主线路线图在当前战役节点处增加作战单元分支摘要标签，显示分支单元名与任务数；主图仍保持简洁，不把所有任务标题塞入 SVG。
- 作战单元卡片点击后改为卡片内展开，展示该单元覆盖的战役节点、节点内任务、任务网络/甘特入口。
- 战役路线分支任务与作战单元路线任务点击后均在原任务卡片下方就地展开详情，并保留 URL 深链。
- 浏览器验证路线图 `stage=launch` 显示 6 个分支摘要标签；点击“财务数据治理与安全分类”在该任务下方展开详情；作战单元页点击研发单元后卡片内展开路线，点击“驱动与语言框架产品化”在原位展开任务详情。
- `npm test` 与 `npm run verify` 均通过，参考 Xugu 应用保持只读未变。

## 2026-07-20：战役路线分支胶囊视觉与点击修正

状态：`accepted`

- 用户指出主线路线图中的分支摘要视觉突兀且无法明显点击。
- 将当前战役节点的作战单元分支摘要改为更轻量的胶囊分流：连接线绕开节点标题/日期，胶囊尺寸更小，选中态使用蓝色高亮。
- 分支胶囊现在是 SVG 内可点击、可键盘聚焦的 button 语义元素，点击写入 `?stage=...&unit=...`，并把下方对应作战单元分支高亮置顶；切换主路线节点时会清除旧 `unit`。
- 增加客户端回归测试，约束 `data-unit-id`、`aria-pressed`、`.branch-chip.selected` 与 `.stage-branch-lane.selected`。
- 浏览器验证 `stage=launch` 下点击“财务作战单元”后 URL 为 `?stage=launch&unit=finance`，分支胶囊选中，下方“财务作战单元”高亮置顶；点击“跨单元扩展作战”后 URL 切换为 `?stage=scale` 且旧 `unit` 清除。
- `npm test` 144 项通过；`npm run verify` 通过，参考 Xugu 应用保持只读未变。

## 2026-07-20：Phase 8 路线图可视化与卡片工作台方向

状态：`accepted for planning`

- 用户在审阅现有路线图后确认，产品需要从单一曲线概览升级为能同时表达战略阶段、作战单元分支、执行进度和材料审核的工作台。
- 确认采用 Aha 式时间列活动路线图与 Trello 式状态卡片板的信息组织原则，但不复制其品牌、Logo 或页面；桌面端继续保持 Xugu 白色顶部导航、暖色指挥背景和作战语言。
- 固定视图确定为活动路线图、阶段卡片板、作战单元进度、依赖网络；它们读取同一版本化项目数据，以稳定 ID、深链、选中态和就地详情互相定位。
- 确认“拖拽卡片”不等于直写看板：任何状态、日期、负责人或作战单元变化仍必须形成受权限、证据、Schema、依赖图与审核保护的 `ChangeProposal`，随后才可能合并草稿与发布。
- 确认材料更新后应以 proposal item 审核卡片呈现新增、更新、归档和关键缺失，卡片中必须可见字段差异、证据、风险、诊断与接受/编辑后接受/驳回动作。
- 详细上下文已固化到 `.planning/phases/08-roadmap-visual-workbench/CONTEXT.md`；当前没有实现 Phase 8 代码，也没有把产品方向误记为完成结果。
- 本会话 Codex imagegen 多次调用均在图像生成 endpoint 超时，未生成效果图；该工具环境问题已记录在交接与 Context，不影响后续设计和编码。
- 文档固化后在可监听本机环境执行 `npm run verify`：144/144 自动化测试、浏览器证据、迁移、隔离、Xugu 等价与参考只读检查均通过。受限沙盒中的同命令因 `127.0.0.1` 监听权限报 `EPERM`，不是产品回归。

## 2026-07-20：引入全自动浏览器 E2E（Playwright）

状态：`accepted`

- 用户确认现有测试为后台驱动 + 静态源码断言 + 预录证据哈希校验，不存在实时浏览器自动化；要求建立全自动端到端测试。
- 方向（默认模式合理假设，可随时修正）：采用 Playwright + Chromium；首轮覆盖登录、项目检索/切换、路线图深链与就地详情、材料→生成→审核→草稿合并→发布/回滚的核心闭环，以及跨项目 404、角色矩阵、CSRF 等隔离回归。
- 接入方式：新增 `npm run test:e2e`，并在 `scripts/verify.mjs` 尾部串联，保持 `npm run verify` 单条命令全绿。
- 本阶段不改变已完成的 Phase 1–7 产品行为；E2E 仅新增测试层与可复用的浏览器 fixture 启动约定。
- 已完成：4 个 spec、18 个浏览器用例在可监听环境一次跑通；接入 `npm run verify`；`npm run verify` 现在可监听环境输出 144 后台测试 + 18 E2E 全绿。

## 2026-07-20：Phase 8 实施

状态：`accepted / delivered`

### 设计决策

- Roadmap 模块承载四种受控视图，通过同一路由的 `?view=` 查询参数切换：`timeline`（活动路线图）、`board`（阶段卡片板）、`units`（作战单元进度）、`network`（依赖网络）；保留 `?stage=&unit=&task=` 深链与选中态，view 参数与对象参数正交。默认 view 由模板 viewVariant 决定，现有曲线 SVG 作为 timeline 视图的战略概览保留。
- 扩展 `loadRoadmap` DTO：在 stages/closures/workstreams 基础上投影 units/tasks/edges，让活动路线图的时间列、卡片板的任务卡、单元进度和依赖网络共享同一数据源（VIS-05）。
- 卡片板拖拽不直写 draft/published。拖拽生成一个 manual `ChangeProposal`：`POST /api/projects/:id/change-proposals`。该 API 复用现有 validator（Schema、证据、日期、依赖 DAG、重复、版本冲突），锁定当前 published 版本，保存为 pending 后进入既有审核流。与 generation 不同，manual proposal 无 jobId，来源标记为 interaction。
- 证据边界遵守 validator 现有规则：state/progress/owner/dates 等高影响字段必须引用本项目已就绪材料证据；纯 plan 类（如非完成状态、非高影响字段的计划调整）允许无证据。拖拽表单从项目已就绪材料加载证据供勾选引用，高影响字段必选证据后才可提交。
- 审核卡片：在现有提案详情基础上，proposals 列表页以 proposal-item 卡片呈现新增/更新/归档/关键缺失，复用既有接受/编辑后接受/驳回/合并/发布边界。
- 桌面端保持 Xugu 白色顶部导航、暖色指挥背景、作战语言；工作画布采用浅蓝灰底、深海军蓝文字、蓝色主操作、浅绿目标卡、浅橙关键缺失/风险卡。

### 完成记录

- 四视图渲染、视图切换器、阶段卡片板状态泳道、作战单元进度（含点击/键盘 unit= 深链）、依赖网络与共享 DTO（`loadRoadmap` 投影 units/tasks/edges）全部落地，视图只投影同一版本图、不改变 published/draft/proposal 边界。
- 交互提案服务 `createInteractionProposal` 落地：锁定当前 published、复用 validator、保存为 pending，不调用 LLM、不创建 generation job；引用证据必须属于本项目已就绪材料，跨项目/不存在证据返回 EVIDENCE_NOT_ALLOWED。
- 卡片板拖拽表单改为证据引用式：从项目已就绪材料加载证据供勾选，高影响字段（state）必选证据后才提交，仍经审核与 copy-on-write 草稿合并。
- 验证：148 项后台测试 + 26 项 Playwright E2E（含 Phase 8 的 8 项）在可监听环境全绿；新增 `test/interaction-proposal.test.mjs` 4 项交互提案服务层契约测试；参考虚谷应用未变。
- 文档：`.planning/phases/08-roadmap-visual-workbench/SPEC.md`、`VERIFICATION.md` 已写入；RESULT/STATE/HANDOFF/ROADMAP 已把 Phase 8 标记完成，平台版本升至 `0.8.0`。

## 2026-07-20：路线图模块化重设计（粗主线 + 支线下钻）

状态：`accepted for implementation`
### 完成记录

- 已落地：`roadmapSvg` 移除分支胶囊、节点下挂模块摘要芯片（`N 单元 · M 任务 · X%`，`pointer-events:none` 不拦截节点点击）；`renderRoadmap` 移除时间列与全展开分支图，改为模块检查器 + 作战单元模块卡片网格下钻；新增 `stageModuleSummary` 聚合 helper。
- 修复两个交互缺陷：摘要芯片原先内嵌在 `route-node` 分组里导致节点点击落空——已移到 svg 层并禁用指针事件；任务按钮点击原先冒泡到单元卡片的 `selectUnit`（清空 `task`）——已加 `stopPropagation`。
- 修复 E2E 端口冲突：`test/e2e/03|04|05` 把 `BASE` 硬编码为 `4191`，导致 API 登录打到遗留进程的 5 次/15 分钟限流；改为读取 `E2E_PORT`。`scripts/verify.mjs` 的 Playwright 步骤改为自动选空闲端口，避免与运行中实例冲突。
- 验证：`npm run verify` 全绿——148 项后台测试 + 26 项 Playwright E2E（含 Phase 8 全部视图与下钻）+ Phase 3–6 浏览器证据；参考虚谷应用未变。
- 状态更新：`implemented and verified`。

### 背景
用户在审阅活动路线图后指出：当一个项目有很多支线（作战单元）时，主线不必那么细，应当粗一点、模块化——把支线做成可下钻的模块，而非把所有分支与任务都堆在主线和详情里。

之前的 Phase 8 已确立"采用 Aha 式时间列活动路线图与 Trello 式状态卡片板的信息组织原则"。本次重设计把这个原则落到活动路线图（timeline）视图的**展示层**。

### 问题（当前活动路线图三重密度）
1. SVG 曲线的选中节点上挂最多 6 个作战单元分支胶囊。
2. 曲线下方的时间列（activity-timeline）对每个阶段列出归入该窗口的全部任务。
3. 节点详情里的分支图（stage-branch-map）又把全部作战单元分支及其全部任务再展开一遍。

结果：29 个任务在时间列与分支图各出现一次，加上 SVG 分支胶囊，主线信息过密。

### 设计决策（Aha + Trello 模型）
- **粗主线（Aha 式层级抽象）**：SVG 只保留阶段节点；移除节点上的分支胶囊。每个节点下方放一个紧凑**模块摘要芯片**，显示该阶段窗口内 `N 个作战单元 · M 个任务 · X%`，让主线一眼可扫到每个阶段的模块重量与进度。
- **支线下钻（Trello 式卡片→点击展开）**：节点详情改为**模块检查器**——阶段说明 + 模块摘要条 + 作战单元**模块卡片网格**。点击单元模块卡片写入 `unit=` 深链，只展开该单元的任务列表；点击任务写入 `task=` 深链，就地展开任务详情（复用 `taskInlineDetail`）。同一时间只展开选中的单元，避免全展开。
- **移除冗余**：移除 activity-timeline 时间列与全展开 stage-branch-map，二者由模块检查器的下钻替代。
- **保留契约**：四个视图（timeline/board/units/network）、`?view=&stage=&unit=&task=` 正交深链、选中态、就地详情、键盘可访问、Trello 式卡片板拖拽提案边界全部不变；board/units/network 视图已符合模块化原则，本次不改。

### 实施范围
- `public/modules/renderers.js`：`roadmapSvg`（移除分支胶囊、加模块摘要芯片）、`renderRoadmap`（移除时间列与全展开分支图、新增模块检查器与单元模块卡片下钻）、新增 `stageModuleSummary` 聚合 helper。
- `public/styles.css`：新增 `.module-summary-chip`(SVG)、`.module-inspector`、`.module-summary-strip`、`.unit-module-grid`、`.unit-module-card`；移除 `.branch-chip`/`.route-branch-summary` 相关样式。
- `test/module-ui-server.test.mjs`、`test/e2e/02-roadmap-deeplinks.spec.mjs`：把分支胶囊断言改为单元模块卡片下钻断言。
- 本方向只改展示层，不改 published/draft/proposal 边界、不改 loadRoadmap DTO、不调用 LLM。

---

## 2026-07-21 路线图模块整体重设计（看板为中心）

**方向状态：待确认（尚未落代码）。** 本节是对前一次"Aha + Trello 展示层改造"的取代，不是增量调整。上一版仍在以四视图（timeline/board/units/network）和 SVG 曲线节点为骨架，把 Trello 只当成其中之一；本次明确：**Trello 式看板是路线图模块的中心范式，其余表达收敛为它的辅件**。确认后才动代码。

### 起因（为什么上一版方向不对）

1. 把 Trello 当成四视图之一，而不是中心范式——导致看板与 timeline/units/network 并列竞争，模块仍偏"路线图"而非"工作台"。
2. 上一版在 SVG 曲线节点上继续叠加摘要芯片/分支下钻，主线仍是"节点曲线"，与"卡片推进工作"的 Trello 心智不一致。
3. 任务数据里普遍没有显式状态文本（只有 progress），上一版的 board 状态泳道近乎空。

### 设计原则

- **抽象层用通用 PMP**：项目 / 时序阶段 / 分工支线（group）/ 任务 / 交付物 / 依赖；渲染器只绑定这个通用结构。
- **术语层保留作战语言**：作战单元 = group（项目拆解的支线分工），战役阶段 = phase，任务卡 = task，战果闭环 = deliverable（phase 边界产出）。多项目靠术语/主题配置表达差异，**不注入布局或代码**。
- **Trello 范式作主面**：卡片/泳道/拖拽是任何项目都成立的通用交互，因此把它作为路线图模块的中心，而非次级视图。

### 通用 schema（渲染器只认这个）

| 概念 | 字段 | 术语 |
|---|---|---|
| Project | goal, status, overallProgress, currentPhase | 项目 / 战役 |
| Phase | id, title, state, dateLabel, expectedOutput | 阶段 / 战役阶段 |
| Group | id, name, owner, objective, currentWork | 作战单元（group） |
| Task | id, groupId, phaseId, title, owner, status, progress, dates, dependsOn, expectedOutput | 任务卡 |
| Status | todo / in-progress / in-review / done | 待启动 / 进行中 / 待审核 / 已完成 |
| Deliverable | id, title, between:[phaseA,phaseB], result, evidence | 战果闭环 |
| Dependency | from→to | 依赖 |

**Status 来源规则（待确认）**：现有 task 普遍只有 `progress`（0–100）无显式状态。派生规则——`progress=100 → done`、`>0 → in-progress`、`空 → todo`；`in-review` 仅当数据显式给出时才显示。旧项目零改动即可上板，新项目可直接填状态。

### 视觉范式：看板为中心 + 阶段主脊

**主脊（Phase Spine）= 看板的表头**
- 一条顺序阶段条带，`currentPhase` 标"当前战役"。
- 点阶段 → 把看板筛选到该阶段（写入 `?phase=`）；不与看板竞争，只锚定它。
- 战果闭环锚定在它所连接的两个阶段之间（数据 `between` 的本义），带证据数徽标。

**看板（Board）= 主面**
- 列 = 通用状态带（待启动 / 进行中 / 待审核 / 已完成）。
- 卡片 = 任务卡：标题、作战单元、负责人、进度/日期、证据数、关键缺失/风险。
- 泳道分组（可切换）：默认按**作战单元**分泳道，可切到按**战役阶段**分。两者都是通用项目轴。
- 拖动换列 = 状态变更 → 走既有 `interaction` 模板 `ChangeProposal`，仍经审核 + copy-on-write + 人工发布；**不直写 draft/published**。
- 高影响字段必须引用本项目已就绪材料证据（`EVIDENCE_REQUIRED` / `EVIDENCE_NOT_ALLOWED`），缺 CSRF 返回 403、viewer 返回 404——沿用 Phase 8 既有服务层。

**卡片检查器（侧栏 / 就地）**
- 点卡片就地展开：owner、进度、依赖上下文（本地小图，非全局网）、证据、提案入口。
- 可深链，不滚到页底；键盘可访问。

### 对现有四视图的收敛

| 旧视图 | 处置 |
|---|---|
| timeline（活动路线图） | 收敛为**看板顶部的阶段主脊**（不再独立） |
| board（阶段卡片板） | 升格为**主面**，泳道可切（作战单元 / 阶段） |
| units（作战单元进度） | 降级为**泳道分组维度之一**（按作战单元分泳道）+ 卡片检查器里的单元信息 |
| network（依赖网络） | 降级为**卡片检查器里的本地依赖上下文**（聚焦、不画全局交叉线） |

### 深链与状态机

- `?view=` 退役；保留旧值做**向后兼容映射**（board→默认、timeline→默认、units→泳道按组、network→忽略并聚焦任务）。
- 状态机改为 `?phase= / ?group= / ?task=` 正交深链；切换 phase 清除旧 group/task 选择。
- 泳道维度（group/phase）作为 `?lanes=` 独立参数，与焦点正交。

### 落地范围（纯渲染层 + 投影层，不碰数据边界）

- `src/modules/loaders.mjs` `loadRoadmap`：补 group 的 `currentWork/nextPlan`、task 的 `status/taskType/schedule/startMonth/span`、deliverable 的 `previewImages/sourceFile`；新增 `companyWorkstreams` 投影与 task→phase 归属。
- `public/modules/renderers.js`：重写 `renderRoadmap` 为「阶段主脊 + 可切泳道看板 + 卡片检查器」；移除 board/units/network 顶层视图（逻辑下沉为泳道维度与检查器 facet）；**保留** `openInteractionProposal` 与正交状态机、键盘可访问、就地详情。
- `public/styles.css`：看板列/泳道/卡片/主脊样式；作战语言标签沿用既有 Xugu 暖色指挥背景。
- `test/e2e/05-roadmap-views.spec.mjs` 改写：主脊阶段筛选、状态带渲染、泳道切换、拖拽提案仍受控、深链恢复。
- `published/draft/proposal` 隔离、CSRF、角色、固定渲染器、projectId 隔离**全部不动**；不调用 LLM。

### 验证目标（落代码后）

- `npm run verify` 全绿（148 后台 + Playwright E2E，E2E 用例随设计改写）。
- 看板拖拽仍只造提案、不改版本指针；跨项目证据/缺 CSRF 行为不变。
- 参考虚谷应用 HEAD 与脱敏种子哈希不变。

### 待确认（阻塞落代码）

1. 看板为中心 + 阶段主脊做表头：**已确认（要主脊）**。
2. Status 来源规则（progress 派生 + 待审核仅显式）：默认采纳，用户未明确反对即按此实现。

## 2026-07-21：分形生命周期 + 主/副泳道（真实推进范式）

状态：`accepted for design`（用户在另一 session 提出，并要求继续执行；本方向是上一段「看板为中心 + 阶段主脊」的演进，而非冲突）

### 用户诉求（逐条还原）

1. 项目推进时目标持续变化，确定大目标与大阶段的地方应当是**通用范式**（事前/事中/事后为例，可更优）。准备阶段由不同作战单元拆解任务；执行阶段每个作战单元相当于又走一次全阶段动作；研发、销售链路皆是如此。
2. 主路线图存在**多次拆解与合并**。项目泳道 = 一条主泳道 + 多条作战单元副泳道（类甘特）。从主泳道拆到副泳道时有**项目锚点**；收尾回归时有**收口锚点**；一个作战单元可同时干不止一个子任务。需考虑主泳道拆给不同作战单元的不同子任务。

### 设计模型：分形生命周期 + 主/副泳道 + 双锚点

**通用生命周期范式（事前/事中/事后，分形）**：不新造字段，直接从既有 `stage.state` 派生三带，且可作用于项目级（阶段分组）与单元级（当前单元所处节律），无需改 schema、模板或数据库：

| 生命周期带 | 来源 `state` | 语义 |
|---|---|---|
| 事前·待启 `prepare` | 计划战役 / planned | 目标对齐、拆解、单元编组 |
| 事中·当前 `active` | 当前战役 / active | 各单元并行执行 |
| 事后·已交付 `converged` | 已完成 / done | 收口、复盘、锚定 |

- 「目标持续变化」靠**多轮拆解/合并**承载（见下），不靠单一线性阶段表。
- 分形：项目三带是宏观节律；单元在「事中」内部再走自己的待启→进行→收口（由该单元任务的进度/状态体现），无需重复建模。

**主泳道（main lane）= 阶段主脊，按真实日期时间轴定位**

- 阶段（`stages`）按 `dateLabel` 解析出的时间窗口，定位到与副泳道**共享的时间轴**上；无窗口阶段排到尾部，不冒充时间。
- 每阶段标注其生命周期带；`currentStage` 高亮。
- **项目锚点（拆解锚点 / D-anchor）**= 每个阶段的起点：主目标在此拆给各作战单元。

**副泳道（sub lanes）= 每个作战单元一条，类甘特**

- 复用 `loadGantt` 已有的 per-unit lanes；任务按 `startDate/endDate` 在共享时间轴上成条。
- **并行子任务**：同一单元时间重叠的任务自动分配到不同 track（贪心区间着色），多个 track 上下堆叠 → 视觉上「一个单元同时干多个子任务」。
- **任务→阶段归属**：按任务起点落入哪个阶段窗口推断（`parseStageWindow` + 起点 containment，回退到区间重叠）；这是「主泳道拆给副泳道」的投影载体。

**收口锚点（C-anchor）= 战果闭环 `closures`**

- `closure.between:[a,b]` 天然锚定在两阶段之间，就是「收尾回归到主泳道」的具体锚点；带证据/结果/日期。
- 视觉上作为穿过副泳道区、连接其 `between` 两阶段的竖向锚点线。

**拆解/合并的视觉表达**

- 每个阶段起点的**拆解引导线**自主泳道向下贯穿副泳道区，凡归属该阶段的任务条在其轨道内被引导线穿过/着色 → 「主→副拆解」。
- 收口锚点处的**收口标记**自下而上映回主泳道 → 「副→主合并」。
- 由此多次拆解/合并在同一张图上可读。

### 与「看板为中心」的关系（两个正交轴，不互斥）

| 轴 | 视图 | 回答的问题 | 改变边界？ |
|---|---|---|---|
| 规划/时间轴 | **泳道路线图** `?view=swimlane`（本段） | 大目标如何拆给各单元、何时收口、谁在何时并行 | 否（纯投影+渲染） |
| 执行/状态 | 阶段卡片板 `?view=board` | 现在谁在干什么、状态如何推进 | 拖拽只造提案（既有） |

- 看板（执行）与泳道（规划）共享同一版本化项目图的不同投影；两者都不直写 `draft/published`。
- `stage`（阶段选择）/`unit`/`task` 深链沿用既有正交状态机；新增 `anchor` 深链用于收口锚点。

### 数据映射（证明零边界改动）

| 用户概念 | 既有实体 | 现状 |
|---|---|---|
| 通用生命周期带 | `stage.state` | ✅ 已有（已完成/当前战役/计划战役） |
| 主泳道阶段 | `stages` + `dateLabel`（迁移自 `date`） | ✅ 已有 |
| 副泳道（每单元） | `loadGantt.lanes` / `task.unitId` | ✅ 已有 |
| 拆解字段（主→子任务） | `task.parentId` | ⚠️ schema 已支持，Xugu 当前为空 → 本期靠任务→阶段归属投影表达拆解；parentId 待后续数据填充 |
| 项目锚点（拆解） | 阶段起点 | ✅ 派生 |
| 收口锚点（合并） | `closures.between` | ✅ 已有 |
| 并行子任务 | 同单元多任务不同日期 + track 着色 | ✅ 已有数据（如市场单元 5 任务并行） |
| 跨单元战线 | `companyWorkstreams` | ✅ 已有（本期不展开） |

### 落地范围（纯渲染层 + 派生，不碰边界）

- `public/modules/renderers.js`：新增 `renderRoadmapSwimlane(context)` + 视图切换项；timeline 仍为默认，swimlane 为新增受控视图。
- `public/styles.css`：主泳道/副泳道/任务条/双锚点/拆解引导线/生命周期分带样式；沿用既有 Xugu 暖色指挥语言。
- `test/e2e/05-roadmap-views.spec.mjs`：新增 `?view=swimlane` 渲染主泳道+副泳道+锚点的断言。
- **不动**：published/draft/proposal 隔离、CSRF、角色、固定渲染器注册、模板（不可变 @1.0.0）、数据库、`loadRoadmap` 字段（已有 dateLabel/state）；**不调用 LLM**。

### 验证目标

- `npm run verify` 全绿（148 后台 + Playwright E2E，含新增 swimlane 断言）。
- 泳道视图不改变版本指针、不写 draft/published；既有 timeline/board/units/network 视图与深链行为不变。
- 参考虚谷应用 HEAD 与脱敏种子哈希不变。

### 待确认（不阻塞首版落地，留作演进）

1. **生命周期术语**是否随模板术语配置（事前/事中/事后 vs PDCA 等）——首版用固定中文术语 + state 派生，后续可进模板 config。
2. **`parentId` 拆解字段**是否在虚谷数据里补真实主任务→子任务关系（目前靠任务→阶段窗口归属投影，已能表达拆解）。
3. swimlane 是否升为路线图默认视图（首版保持 timeline 默认，避免破坏既有深链预期）。

## 2026-07-22 Phase 9 切片一：同单元 parentId 真实拆解链（已落地，全绿验证）

### 背景（调研结论）

方向 A 已确认：**阶段作项目锚点，parentId 只管同单元内拆解**。调研发现 DB/迁移/仓储/DTO/validator 五层早已支持 parentId——schema `parent_external_id` 带外键、`legacy-project.mjs` 搬运、`project-repository.mjs` 读写、`loaders.mjs` 投影、`project-validator.mjs` 校验环并禁止跨单元。虚谷种子 29 任务 parentId 全空，泳道靠 `phaseOf()` 时间窗口推断。

### 子决策：不加显式 stageId，保持窗口投影

阶段→单元任务归属用 `phaseOf()` 时间窗口投影已能正确表达（29 任务都落到正确阶段窗口）。加 stageId 要改 schema/仓储/迁移/loader/validator/种子，风险大收益小。本切片聚焦"同单元 parentId 真实拆解链"一个最小可见价值点。

### 切片范围（最小可见）

1. **虚谷种子补真实同单元拆解链**——挑有自然父子关系的任务填 parentId（同单元内，不碰 validator 跨单元禁令）：
   - 财务：`finance-pilot`→`finance-scale`→`finance-deepen`（时序深化链）
   - 技术：`tech-company-knowledge`→`tech-company-knowledge-pilot`（方案→试点）
   - 研发：`rd-core-assessment`→`rd-driver-productize`（评估→产品化）
2. **泳道渲染器升级**——副泳道用 parentId 显式表达拆解：子任务条标记 `data-parent` 并加拆解指示（缩进/连点），`?stage=` 选中时拆解链高亮。
3. **测试**——种子校验 parentId 引用合法、渲染拆解标记 E2E、validator 同单元允许/跨单元禁止不变。

### 边界（不动）

- validator 跨单元 parentId 禁令不变（方向 A）。
- 不加 stageId 字段、不改 schema/迁移。
- published/draft/proposal 隔离、CSRF、角色、模板、loadRoadmap DTO 形状不变。

## 2026-07-22 Phase 9 切片二（LIF-01）：生命周期术语模板化（已落地）

### 设计

- 三带术语原硬编码在渲染器 `SWIMLANE_BAND_LABEL`（事前/事中/事后）。发现 `projectPresentation`（app.js）已有 terminology→presentation 映射机制（campaign/standard 两套），只是缺生命周期带术语。
- 在两套 presentation 各加 `lifecyclePrepare/Active/Converged` 键：campaign 保持作战语言（事前/事中/事后），standard 用通用项目管理语言（规划/执行/交付）。项目层 terminology JSON 可覆盖。
- 渲染器从 `context.presentation` 读 `bandLabels`（带默认回退），删除模块级硬编码常量。图例、阶段站点 meta、详情面板统一用 presentation 术语。

### 边界

- 纯展示层 + 配置：不改 schema/validator/数据模型/隔离/CSRF/角色/模板种子/DTO 形状。

## 2026-07-22 Phase 9 切片三（LIF-04）：多源合并收口（已落地）

### 设计

- 收口锚点位置原只取 `between` 前两个阶段中点（`const [a,b] = closure.between`），超过 2 个的 stage 被忽略。
- 升级为取**所有** between 阶段位置的平均值，支持一个收口锚点跨多个阶段（多对多）。
- 调研发现数据层早已支持多元素 between（schema validator 遍历 `closure.between` 数组逐个校验、loader `between: [...closure.between]` 保留全部），仅渲染器只用了前两个。纯渲染层升级。
- 种子补一条 3 元素 between 收口（report-1/launch/pilot）验证多对多收口；参考基线同步提交。

### 边界

- 纯渲染层 + 种子数据：不改 schema/validator（多元素 between 早已合法）/隔离/CSRF/角色/模板/DTO 形状。


## 2026-07-22 Phase 9 切片四（LIF-05）设计契约：单元级分形生命周期

### 设计张力与方向选择

"单元级分形生命周期"有两个实现方向：

- **方向 X（unit 加独立 stage 集）**：每个 unit 拥有自己的子阶段序列（研发：评估→产品化→重构），各带自己的事前/事中/事后。问题：与项目级 stage 窗口语义重叠，真实数据无独立 unit-stage 定义，数据模型扩展大、风险高。
- **方向 Y（从 unit 任务时序派生，投影无新数据）**：每个 unit 的生命周期带由它自己任务的状态/日期派生——同一"事前/事中/事后"范式下沉到 unit 层，但不带独立 stage 数据。

**选方向 Y**。理由：符合 D-022"范式分形下沉"本质（同一范式下沉，非给每 unit 造独立 stage 体系）；零数据模型扩展（不碰 schema/迁移/validator）；真实业务里"研发链路、销售链路的完整阶段动作"就是该 unit 任务集合的状态演进，无需独立 stage 定义；与项目级 phaseOf（任务→项目阶段窗口）正交——unit 级带看 unit 自身进展，项目级带看战略阶段。

### 派生规则（unit 生命周期带判定）

- 全部任务完成（progress>=100 或 state∈done/completed/完成/已完成）→ **converged（事后·已交付）**
- 有进行中任务（state∈进行/in-progress/active/当前）或 有任务落在当前日期窗口（startDate<=今天<=endDate）→ **active（事中·当前）**
- 否则（全部待启/未来）→ **prepare（事前·待启）**

### 切片范围（最小可见）

1. 渲染器：副泳道行头（`swimlane-rail`）显示该 unit 的生命周期带标记（带色点 + 带标签），复用 bandLabels 术语；点击 unit 仍走 `?unit=` 深链（不变）。
2. unit 级带标记复用项目级三带配色（prepare 灰/active 橙/converged 绿），视觉上表明"同一范式分形下沉"。
3. 测试：E2E 断言副泳道行头有 unit 级生命周期标记，且不同 unit 因任务进展不同显示不同带。

### 边界（不动）

- 不给 unit 加独立 stage 集、不加 schema/迁移/validator。
- unit 级带是纯投影派生，不引入新数据字段、不进 DTO（loadUnits 不变）。
- published/draft/proposal 隔离、CSRF、角色、模板、loadRoadmap DTO 形状不变。
- 派生规则用既有 task 的 state/progress/日期，无新状态机。

## 2026-07-22 用户反馈：会话时长与路线图泳道化

### 来源
用户在另一 session 提出五点要求：

1. 会话时间太短 → 调到 4 小时。
2. 战役路线图应按泳道方式画，而不是"一根线"（默认曲线视图）。
3. 第三个节点（launch，多作战单元）点击展开效果出问题。
4. 先做 #2 的规划；设计 #3 时规避该问题。
5. 期望的泳道形态：主泳道全展开=卡片、全折叠=横向多 tag 主脊；副泳道=作战单元（也由多个 tag 组成，可展开/收起）；平时副泳道连卡片都不展现，只有主泳道点开某张卡片且涉及该单元时，对应单元卡片才出现在其副泳道（有涉及才展示）；副泳道卡片再次点击=浮在泳道最上层的展开，带"单独打开这一页面"和"关闭"按钮。

### 决定（已确认方向，待实现后写入 RESULT）

- **#1（会话）**：空闲超时 `DEFAULT_IDLE_TIMEOUT_MS` 30min → 4h；绝对超时保持 8h 作为硬上限。仅改默认常量，不动 schema/迁移/DTO。
- **#2/#5（泳道化）**：把"项目泳道"设为路线图默认视图（`?view=swimlane`），原"活动路线图"曲线视图保留为可切换视图。泳道改为反应式模型：
  - 主泳道=阶段 tag 主脊（常显），点击某阶段 tag 展开为该阶段"主卡片"（说明/产出/涉及单元/任务进度）；点击同一 tag 收起。
  - 副泳道=作战单元行（行头常显，带单元级生命周期带）；**无主卡片打开时全部休眠（不渲染任务条）**；打开某主卡片时，仅"涉及该阶段"的单元行显示其任务条（显示该单元完整排期，主卡片阶段内任务加重、其余淡化），即"有涉及才展示"。
  - 默认打开当前战役阶段（launch）以提供有内容的首屏，用户可一键收起回到纯主脊。
  - 副泳道任务条点击 → 浮在泳道最上层的卡片浮层（`position:fixed`、最高层），含任务/单元详情、"单独打开"（深链到 Units 模块 `?unit=`）与"关闭"（清 `?task=`）按钮。
- **#3（多单元展开 bug）**：根因是 timeline 视图 `buildModuleInspector` 在多作战单元阶段（launch 含 6 单元 20 任务）展开卡片栅格时布局错乱；新泳道默认用"每单元一行 + 浮层"模型，从结构上规避栅格展开错乱。timeline 视图保留，其交互断言（深链/就地详情）经 E2E 覆盖。

### 边界（不动）
- 不改 schema/迁移/validator/loadRoadmap DTO 形状、published/draft/proposal 隔离、CSRF、角色、模板。
- 深链正交性保持：`?view=`/`?stage=`/`?unit=`/`?task=`/`?anchor=`。
- 拆解链高亮、多源收口锚点、单元级分形生命周期带在可见行上继续生效。
- 受影响 E2E：`02-roadmap-deeplinks`（改用 `?view=timeline` 进入曲线视图）、`05-roadmap-views` 泳道用例（打开阶段卡片后再断言任务条/拆解链）。

## 2026-07-23 用户反馈：泳道语义认可，视觉表达需要重做（探索中）

### 来源

用户确认当前泳道表达的业务含义大致正确，但认为成品视觉质量不足，要求重新考虑。

### 现状诊断

- 项目头、模块头、视图切换、阶段大卡、图例、时间轴和待排期任务同时争夺首屏，路线主体出现得太晚。
- 主泳道节点、收口锚点和任务条都使用高对比描边/高饱和蓝，视觉语法过多但层级不足。
- 一个阶段展开后同时展示长说明、全部涉及单元、全部任务和完整半年时间轴，信息密度在纵向与横向同时失控。
- 时间轴跨度远大于当前阶段任务窗口，右侧形成大面积无意义空白；任务文字被长条裁切，难以快速扫描。
- “状态、所属单元、任务层级、选中态”主要依赖同一蓝色深浅表达，颜色承担的语义过载。

### 本轮探索边界

- 保留已经确认的业务语义：阶段主脊、作战单元副泳道、任务排期、拆解/收口、深链和任务详情浮层。
- 不修改正式 renderer、schema、数据库、提案审核边界或 published/draft/proposal 隔离。
- 在 `.planning/sketches/swimlane-visual-redesign/` 制作三种一次性对比稿：
  1. **指挥台**：紧凑阶段主脊 + 当前阶段聚焦 + 中性甘特条，推荐方向。
  2. **阶段聚焦**：把当前阶段作为叙事主角，只显示涉及单元，降低认知负担。
  3. **阶段矩阵**：阶段列 × 作战单元行，以任务卡替代长甘特条，强调扫描与协同。
- 方案未经用户确认，不写入 `docs/RESULT.md`，不视为正式实现。

### 2026-07-23 用户校正：路线本身就是泳道

- 用户指出不应先画一条独立路线，再在下方另画一张泳道；这会把同一项目阶段结构重复表达两次。
- 修正后的统一模型：
  - 同一张时间画布、同一条时间坐标轴；
  - 第一行就是项目主泳道，阶段按真实时间窗口铺在其中；
  - 后续行是作战单元副泳道，任务与上方阶段共用横向坐标；
  - 主→副拆解、父子任务和副→主收口直接发生在同一画布内；
  - 当前阶段说明放入右侧态势区或任务详情，不再单独占一张“路线大卡”。
- A「指挥台」探索稿按此约束修改；B/C 保留用于比较，但不再作为默认泳道的候选结构。

### 2026-07-23 用户手绘确认：主任务时间线 + 副任务卡片集合

- 用户通过手绘图进一步确认：
  1. 主泳道就是按时间推进的主任务线；
  2. 副任务不做甘特条，只在所属主任务的起始位置显示缩小卡片；
  3. 未点击主任务时，所有副泳道任务隐藏；点击主任务后，主卡片原位展开说明，并显示相关作战单元的副任务缩小卡片；
  4. 点击副任务卡片后在原位展开详情，再次点击收起；首版只做主任务→副任务两级；
  5. 主任务、副任务和作战单元名称必须来自实际项目数据与术语配置。
- 副泳道按作战单元使用稳定差异色；超时、风险和闭环用状态、徽标和提示表达，不用卡片时间长度表达。
- A 探索稿从“中性甘特”改为“卡片泳道”。完整持久化契约见 `.planning/design/ROADMAP-CARD-SWIMLANE.md`；该方向已确认但尚未写入正式 renderer。

### 2026-07-23 方案选择

- 用户正式选择 **A「卡片泳道」**，评价“不错”。
- A 状态从探索中更新为 `selected / ready-for-implementation`。
- B「阶段聚焦」与 C「阶段矩阵」冻结为历史对比，不进入默认泳道实现。
- 本次选择只完成设计收口；正式 renderer、CSS 和 E2E 尚未修改。

## 2026-07-23 A 卡片泳道正式实现

状态：`accepted / implemented`

- 用户明确授权“开始实现”，正式改造 `renderRoadmapSwimlane` 与对应样式。
- 主任务卡直接组成横向时间路线；无 `stage/task` 选择时不渲染作战单元行或副任务卡片。
- 选中主任务后在原卡片显示说明和预期产出，并只投影该阶段涉及的作战单元；再次点击清除 `stage/unit/task` 并收起。
- 副任务改为固定宽度 Trello 式卡片，仅锚定阶段列，不使用 `endDate` 计算宽度；独立 Gantt 模块继续承担精确工期表达。
- 七色受控调色板按稳定单元顺序分配；完成、超时、风险同时显示文字或底边提示。
- 副任务点击后在原卡片位置展开详情，再次点击收起；`task` 深链可反推并恢复所属主任务。
- 保留 `parentId` 同单元拆解链、多源收口、生命周期模板术语和 `stage/unit/task/anchor` 深链；未修改 schema、loader DTO、数据库、提案、审核或发布边界。
- 浏览器实测确认主任务/副任务列对齐、差异色和原位展开可用；`test/e2e/05-roadmap-views.spec.mjs` 14/14 通过。

## 2026-07-23 卡片泳道密度收敛

状态：`accepted / implemented`

- 用户反馈主泳道和副泳道卡片仍然过大，折叠状态应尽量只显示标题，以便看清全貌。
- 主任务未展开时改为单行标题标签；日期、生命周期、任务数、说明和预期产出只在选中后出现。
- 选中主任务单独增高，其他主任务不再被同一网格行拉伸成等高空白卡片。
- 副任务未展开时改为单行标题卡；状态、负责人、日期、进度、产出与拆解说明只在原位展开详情中出现。
- 主阶段列宽从 196px 收敛到 146px，单元行最小高度从 92px 收敛到 52px，副任务卡最小高度从 116px 收敛到 42px。
- 正式页面浏览器视觉检查通过；模块静态契约 8/8、路线图 Playwright 回归 21/21 通过。

## 2026-07-23 项目路线图收敛

状态：`accepted / implemented`

- 用户确认卡片泳道本质上就是项目路线图，要求删除重复的“活动路线图”。
- 路线图视图切换器移除“活动路线图”，并把“项目泳道”重命名为“项目路线图”；保留阶段卡片板、作战单元进度和依赖网络三个辅助视图。
- `renderRoadmap` 不再分派 timeline 投影；旧 `?view=timeline` 和未知 view 安全回落到卡片项目路线图。
- 删除活动路线的 SVG 路线渲染、阶段模块摘要和模块检查器代码；任务精确工期仍由独立 Gantt 模块承担。
- `stage/unit/task/anchor` 深链、卡片原位展开、生命周期、拆解/收口和提案审核边界不变。

## 2026-07-23 项目导航信息架构收敛

状态：`accepted / implemented`

- 用户要求继续检查“战役路线”之后各入口是否必要，并确认采用收敛方案。
- 核对后确认：作战单元承担责任与编组，排期甘特承担精确工期，均保留一级；Task Network 与路线图依赖网络重复，退出一级；风险和指标合并为项目健康；战果、材料台账和更新提案合并为项目资料。
- 一级导航从九个技术模块收敛为六个用户工作区：作战总览、项目路线图、作战单元、排期甘特、项目健康、项目资料。
- 项目健康提供风险台账/效果指标二级切换；项目资料提供战果档案/材料台账/更新提案二级切换，Materials 内原有问答、审核发布和运维自检继续按角色展示。
- 底层九模块注册、服务端 API、published/draft/proposal 隔离、角色和历史深链全部保留；本次只调整安全前端的信息架构和显示名称。
- 全量 `npm run verify` 通过：151 项自动化测试、33 项 Playwright E2E、19 张既有浏览器证据和参考项目只读检查全部通过。

## 2026-07-23 非标准项目材料 UI Benchmark

状态：`completed`

- 按用户要求建立 `.planning/benchmarks/project-progression-ui/`，用合成周会 DOCX、跨单元 XLSX 台账、群聊 TXT、邮件转发链 TXT、供应商 JSON 和不支持 EML 模拟项目推进材料。
- Benchmark 严格从“项目资料 → 材料台账”操作：五个正向材料通过页面上传、选择模板、查看处理状态与证据详情；EML 和重复 DOCX 也从同一上传界面验证。
- UI 实际结果为 5/5 正向材料“证据已就绪”；DOCX 50、XLSX 113、群聊 14、邮件链 33、JSON 25 个证据块。JSON readiness 因缺少可识别截至日期/状态而如实阻断生成，没有补造事实。
- 运行中发现并修复正式服务未启动材料 worker、XLSX namespace 解析、单元格定位遗漏、UI/门阀文本格式不一致、门阀错误中文映射缺失、生成能力 readiness 缺失六项问题，并增加对应自动化测试。
- DOCX 从 UI 授权生成后，生成面板正确显示 `v4.2` 基准、`48/48` 证据锁定和 provider 未启用；生成按钮禁用，未创建伪提案，发布路线图仍为 `v4.2`。
- `npm run verify` 全绿：154 项后台测试、33 项 Playwright E2E、19 张既有浏览器证据、迁移/安全检查与参考项目只读校验全部通过。
- 完整运行记录见 `.planning/benchmarks/project-progression-ui/RESULT.md`。

## 2026-07-24 真实 GLM-5.2 UI 生成与发布闭环

状态：`completed`

- 用户提供真实 BigModel OpenAI-compatible endpoint、API Key 和 GLM-5.2 模型，并授权 Codex 充当 UI 审核与发布角色。
- 密钥只写入 Git 忽略且权限为 0600 的 `.env.local`；启动脚本自动读取 `.env`/`.env.local`，示例环境文件只保留空配置项。
- 首轮大 DOCX 真实生成依次暴露 120 秒网络超时、思考输出干扰 JSON、提示词未给出内部字段契约三个问题。三次失败均在生成边界内终止，没有提案、草稿或发布副作用。
- 增加 5 分钟有界生成超时、allowlist `reasoning_effort=none`、精确输出契约和对应单元测试；同时修正“证据总数大于 48 就前端禁用”与服务端安全截断策略不一致的问题。
- 通过产品“填写人工材料”UI 创建 BM-08 项目计划，授权后提交真实生成。任务 `1267c566-207d-42cb-837e-f49aedc2bc89` 一次成功、4317 Token；提案 `a13eb85a-f827-441a-9d33-c27ccbb7d234` 恰好生成 3 个 roadmap create 项。
- 在 UI 逐项核对标题、日期、状态、说明和证据后接受 3/3；随后事务合并为 `draft-review-2`，发布中心四项检查通过，人工发布 `v4.3`。
- 最终项目路线图显示三个新主任务节点；展开态和无副任务空态正常。完整记录见 `.planning/benchmarks/project-progression-ui/RESULT.md`。

## 2026-07-24 路线图末端展开卡片越界修正

状态：`completed`

- 用户截图指出通过 `stage` 深链打开靠近路线末端的主任务时，展开卡片被横向滚动容器右边界裁切。
- 根因为泳道画布宽度没有计入标签列间距、阶段间距和两侧 padding；同时深链恢复只设置选中态，没有把末端选中卡片滚入可视安全区。
- 画布现在按桌面/移动端真实列宽确定最小宽度；恢复或切换主任务后，仅当选中卡片超出安全区时调整局部横向滚动，不影响页面纵向位置。
- 真实 `v4.3` 页面复测确认 GLM 节点及其右侧“人工审核与发布验收”节点均完整显示。新增窄视口末端深链回归后，完整验证为 155 项后台测试、34 项 Playwright E2E 全绿。

## 2026-07-24 主副任务覆盖式展开

状态：`accepted / implemented`

- 用户确认展开卡可以覆盖左右相邻卡片，以换取更宽、更低的详情阅读区域；副任务采用同一原则。
- 主任务展开宽度提升到约三列，但保持原时间锚点和时间线网格不变；中间节点居中覆盖，首尾节点向画布内部展开。
- 副任务详情宽卡在所属阶段列上方覆盖相邻列；任务栈显式固定为单列网格，确保其他折叠副任务仍维持单列宽度。
- 主任务或副任务深链恢复后，局部滚动优先把实际展开的详情卡带入安全区；不移动页面纵向位置。
- 真实 `v4.3` 页面完成主任务与副任务视觉复测；完整验证为 155 项后台测试、35 项 Playwright E2E 全绿。

## 2026-07-24 覆盖卡轻透视觉优化

状态：`accepted / implemented`

- 用户希望覆盖式详情卡略带透明感，增强与被覆盖邻卡的空间关系。
- 主任务宽卡使用 90–94% 实色渐变，副任务详情使用 90–92% 实色背景；两者增加 7px 轻微 backdrop blur。
- 透明只作用于卡片背景，正文、边框和操作链接保持清晰；未采用整体 `opacity`，避免文字一起变淡。
- 真实 `v4.3` 主任务/副任务覆盖页面完成视觉复测。

## 2026-07-24 主任务聚焦层级与副任务紧凑网格

状态：`accepted / implemented`

- 主任务打开后，路线画布增加 18% 深蓝灰遮罩；选中的主任务和它的副任务面板提升到前景，其余区域统一降亮。
- 主任务玻璃背景增强为约 76–84% 实色并使用 9px backdrop blur，正文和控件保持完全不透明。
- 副任务统一收纳进与主任务展开卡同宽的 420px 面板；每个作战单元的折叠任务采用两列网格，减少纵向冗余。
- 二级任务详情在所属面板内横跨两列展开，不突破主卡左右边界。
- 静态渲染契约与 4 条针对性 Playwright 回归通过；真实 `v4.3` 页面已完成主卡、折叠子卡和二级展开视觉复测。
- 全量 `npm run verify` 通过：155 项后台测试、35 项 Playwright E2E、浏览器证据、迁移/安全检查和参考项目只读校验全部通过。

## 2026-07-24 平滑拆解坡线与 Windows/Linux 分发

状态：`completed / released`

- 用户指出作战单元不应继续占据子任务区左侧整列，主卡向下拆解也不应使用生硬竖线。
- 作战单元名称、生命周期和差异色收成每组顶部小色标；任务网格使用完整宽度并从两列升级为三列，5 个任务呈现 `3+2`。
- 主卡到副任务面板之间改为对称 SVG 贝塞尔双坡线，移除扩展区横向硬分割和面板垂直连接线；真实 `v4.3` 页面完成折叠、展开与二级详情视觉复测。
- 新增 Windows x64 ZIP、Linux x64 tar.gz 与 RHEL 系 x64 RPM 分发；三种包自带固定 Node.js 运行时，RPM 创建 systemd 服务并在安装后自动启动。
- Release 采用运行文件白名单，明确排除 `.planning`、`fixtures`、`test`、数据库、材料、日志和密钥；全新数据库不再自动导入 Xugu 项目，只有显式 `PLATFORM_SEED_FIXTURE` 才执行脱敏迁移。
- README 增加私有 GitHub Release 下载、RPM 一行安装、Windows/Linux 启停、数据目录、密钥和备份说明。
- 全量 `npm run verify` 通过：157 项后台测试、35 项 Playwright E2E、浏览器证据、迁移/安全/分发检查和参考项目只读校验全部通过。
- 私有仓库已创建为 `FATELLS/ai-project-command-platform`；PR #1 合并正式功能，PR #2 修正原生 runner 暴露的 Windows npm 调用和 RPM 路径/清单问题。
- `v0.8.0` 原生构建全部通过并发布：Windows x64 ZIP、Linux x64 tar.gz、x86_64 RPM 与 `SHA256SUMS.txt`。Windows 与 Linux portable 都在 runner 上实际启动并通过 `/health`，RPM 在 x64 runner 上构建成功。
- Release：`https://github.com/FATELLS/ai-project-command-platform/releases/tag/v0.8.0`

## 2026-07-24：用户体验改进（五个问题）

状态：`accepted`

### 问题四：首次部署默认 admin/admin123 + 强制改密

- 首次启动未配置 `PLATFORM_BOOTSTRAP_PASSWORD` 时，默认创建 `admin / admin123`。
- 迁移 008 添加 `must_reset_password` 标记；默认管理员账号标记为必须改密。
- 登录后如果 `mustResetPassword = 1`，强制跳转改密页面，不允许访问其他功能。
- 改密后清除标记。`server.mjs` 保留 `PLATFORM_BOOTSTRAP_PASSWORD` 环境变量覆盖。
- `hashPassword` 增加 `skipValidate` 选项，允许短默认密码（仅 bootstrap 场景）。
- 新增 `/api/account/password` API 和前端改密页面。
- 登录页提示更新为"默认账号 admin / admin123"。

### 问题五：平台设置页

- 迁移 009 添加 `platform_settings` 表。
- 新增 `settings-service.mjs`，提供 AI Chat 和 Generation provider 的读写与 `buildProviderEnvironment` 方法。
- `app.mjs` 在创建 chat/proposal 服务时使用 DB settings 优先于 env 的环境。
- 新增 `/api/settings`、`/api/settings/ai-chat`、`/api/settings/ai-generation` API（仅平台管理员）。
- 前端新增 `/settings` 路由和 `renderSettings` 页面，包含 AI 配置、账号安全和平台信息。
- 顶部导航栏增加"设置"入口（仅平台管理员可见）。

### 问题三：材料上传入口前置

- Overview 模块在项目无任务时显示醒目的"开始使用项目"引导卡片。
- 编辑者及以上角色可看到直接"上传项目材料"按钮。
- 卡片使用浅蓝渐变背景，圆圈编号图标。

### 问题一：通篇黑话清理

- UI 文案术语映射：证据→内容片段、证据已就绪→已处理完成、可定位证据→可追溯内容、材料台账→项目材料、更新提案→更新建议、结构化提案→结构化建议/更新建议、readiness→内容完整性、关键内容缺失→缺少必要信息。
- 英文 eyebrow 全部中文化：BATTLE MATERIAL INTAKE→项目材料、STRUCTURED CAMPAIGN UPDATE→作战更新 等 15 处。
- 材料门阀报错从英文全部翻译为中文（25 条）。
- 审核/生成/校验报错信息清理（约 20 处）。
- 同步更新所有 UI server 测试中的术语断言。

### 问题二：上传→生成→发布流程简化

- 材料处理完成后自动推断更新模板（基于文件名和扩展名匹配关键词）。
- 材料处理完成后自动开启生成授权（无需用户手动 PATCH）。
- 审核面板新增"全部接受"快捷按钮（仍保留逐项和按模块接受）。
- 审核与发布中心英文标题和术语中文化。

### 安全边界

- AI 仍然不能直接写 draft/published，仍需人工审核确认。
- 仍然按 projectId 隔离所有数据。
- LLM 配置 API 仅平台管理员可访问，CSRF 保护。
- 自动模板推断和自动生成授权不绕过审核流程，只是减少操作摩擦。

## 2026-07-24：产品方向反馈（第二轮）

状态：`direction` — 待确认后实施

用户在试用后提出四个方向性反馈，涉及项目创建、材料→更新流程、问答入口和材料页面冗余。

### 反馈一：项目创建三种方式

当前只有表单创建（ID + 名称 + 模板）。用户要求三种入口：

1. **对话式**：通过 AI 引导的对话逐步收集项目信息（名称、目标、团队、里程碑等），自动生成项目结构。
2. **上传材料创建**：直接上传项目启动会会议纪要等材料，系统自动提取项目信息并生成项目骨架（路线、团队、任务）。
3. **手动输入**：当前的表单创建方式，保留。

### 反馈二：材料→更新流程太重，去掉授权步骤

当前流程：上传材料 → 问答授权 → 生成授权 → 手动打开生成面板 → 生成建议 → 审核 → 合并 → 发布。

用户反馈：**问答授权和生成授权这两步是多余的审批**，不应让用户手动操作。应该：

1. 材料处理完成后，直接可生成更新建议，不需要任何手动授权。
2. 生成更新建议后直接展示为**卡片预览**（新增了什么、修改了什么）。
3. 用户**确认即发布**——发布就是新增卡片、修改卡片（删除卡片仍需手动操作）。
4. 界面上不应再出现"问答授权""生成授权"这些概念。

安全边界：AI 仍不能直接写 draft/published；确认发布的动作仍由人工触发。

### 反馈三：战情问答移到右侧独立按钮

当前战情问答是材料工作区的一个 local tab。用户要求改为**项目页面右侧的独立浮动按钮**（类似咨询入口），点击展开问答面板，不占用一级导航或材料工作区 tab。

### 反馈四：项目材料页面抬头重复

当前点击一级导航"项目资料"的二级 tab"项目材料"后，材料页面内部 `localTabs` 又出现一行"项目材料 | 战情问答 | 更新建议"。用户感觉重复：上方已有"项目资料→项目材料"的面包屑和分区导航，内部再放一行 tab 是多余的。

### 评估

| 反馈 | 复杂度 | 能否立即实施 | 备注 |
|---|---|---|---|
| 四：抬头重复 | 低 | 是 | 合并 localTabs 与 sectionNav，去掉重复 |
| 三：问答右侧按钮 | 中 | 是 | 从 localTabs 移出问答，改为项目级浮动入口 |
| 二：去掉授权步骤 | 中高 | 部分 | 可先去掉 UI 授权按钮和列；"确认即发布"需设计简化路径 |
| 一：三种创建方式 | 高 | 需设计 | 对话式和材料创建需要新流程，表单创建已有 |

## 2026-07-25：Phase 10 用户体验简化实施

状态：`accepted / implemented`

### 完成记录

**UX-01：抬头重复消除**
- 移除 `renderers.js` 的 `localTabs` 函数及其全部 15 处调用。
- 增强 `app.js` 的 `moduleSectionNavigation`：现在覆盖全部材料子视图（材料/更新建议/审核发布/运维自检），按角色显示对应入口。
- 进入项目材料后不再出现重复的内部标签行。

**CHAT-04-05：战情问答浮动按钮**
- 新增 `createFloatingChat` 组件，固定在所有项目页面右下角。
- 点击展开问答面板（对话区 + 建议问题 + 输入框），支持引用来源跳转。
- 问答从材料工作区 localTabs 完全移出，`renderMaterials` 不再分发 `?view=qa`。
- 浮动按钮适配桌面和移动端（窄屏面板撑满宽度）。

**SIM-01-04：材料流程去授权化**
- 材料表格移除"问答授权"列（9 列→8 列）。
- 材料详情元数据移除"问答授权"和"生成授权"行。
- 材料详情页移除"授权用于问答"和"授权用于生成"按钮。
- 生成条件不再检查 `generation.enabled`（processing-service 已自动开启生成授权，用户无感）。
- 底层安全边界不变：AI 仍不能直写 draft/published，审核合并仍需人工。

**CRT-01-05：项目创建三种方式**
- 新建项目入口改为三选一卡片：上传材料创建（推荐）、对话式创建（AI 引导）、手动填写创建。
- 上传材料创建：`POST /api/projects/from-material` 解析上传文档提取项目信息，填入确认表单。
- 对话式创建：4 步引导对话收集项目信息，`POST /api/projects/suggest` 生成建议，确认后创建。
- 手动填写创建：保留原有表单流程。
- 新增 `parseMultipart` 辅助函数处理 multipart/form-data 上传。

### 验证

- 后台测试：159 项通过（1 项预存在 flaky test `chat-provider deadline` 取消，与本次改动无关）。
- Playwright E2E：35 项全部通过。
- 语法检查：app.js、renderers.js、app.mjs 全部通过 `node --check`。
- 测试更新：material-ui-server 测试适配新导航结构和移除的授权 UI；E2E 导航测试适配新标签名。

## 2026-07-29：更新后验证修复

状态：`accepted / implemented`

### 修复记录

- 恢复九模块契约中的 `outcomes`：模板目录、模板 validator、服务端模块 registry/loader、前端 registry/renderer 和“项目资料”导航均重新包含成果/交付物模块。
- 恢复登录 IP 窗口限流，成功登录后清除当前来源的失败窗口。
- PDF/图片材料提取保留多模态 vision provider 路径，同时在无 provider 但有本地能力时回退到受限 `pdftotext`/`tesseract` 子进程适配器。
- 同步迁移 008–010 的备份测试与 `scripts/verify.mjs` 统一验证白名单。

### 验证

- `npm run verify` 通过：160 项后台测试、44 项 Playwright E2E、Phase 3–6 浏览器证据和 Xugu 等价校验全部通过。

## 2026-07-29：Phase 11 工作流优先 UI 规格化

状态：`accepted / specified / not implemented`

- 用户要求把流程审计、UI 友好度审计和视觉审计合并，并进一步从大的改造要求下沉到模块级 ADR 与 Design，采用 spec-driven coding 方法。
- 新增 WUI-01–18，锁定首屏有效性、角色可见性、材料状态机、业务化审核、受控发布编排、移动端等价投影、视觉与无障碍验收。
- 新增 `.planning/phases/11-workflow-first-ui/11-SPEC.md` 和 `UI-SPEC.md`。
- 按八个模块分别建立 ADR 与 DESIGN：平台壳与项目入口、项目总览、项目创建、材料摄入、审核发布、路线图工作区、项目问答、平台设置。
- 新增 D-034–D-041 记录跨模块关键取舍。
- 本轮只完成规划与设计契约，没有修改产品代码、数据库、API 或已发布结果；不得宣称 Phase 11 已实现。

## 2026-07-29：全项目 spec-driven 系统设计补全

状态：`accepted / documented`

- 用户指出 Phase 11 只覆盖 UI 演进，不能替代整个项目的 ADR 和 Design；原范围判断已修正。
- 新增 `.planning/design/system/` 作为 canonical system design，覆盖系统总 SPEC、架构、追踪矩阵以及八个长期模块的 ADR/DESIGN。
- 八模块为：运行与持久化、身份与项目权限、项目模型与固定渲染、材料与证据、AI 服务、变更控制与发布、产品体验、运维与交付。
- 项目级设计明确了单进程模块化单体、SQLite 事务核心、projectId 隔离、版本图、材料证据、AI 不可信边界、proposal/draft/published、固定 renderer、可观测和无数据默认交付。
- 新增 D-042，明确阶段文档记录演进、系统设计记录长期架构；Phase 11 被重新定位为 Product Experience 模块的计划演进。
- 本轮只补文档体系，没有修改产品行为或已实现结果。

## 2026-07-29：Phase 11 第一实施切片

状态：`implemented / verified / phase remains open`

### 实施

- 为四个用户旅程建立 `11-01-PLAN.md` 至 `11-04-PLAN.md`，把系统设计和 WUI-01–18 下沉到文件、行为与验证任务。
- 平台入口与项目壳改为紧凑工作台；项目内只保留六个一级工作区，消除重复 H1、本地导航和查看者可见的技术标识。
- 总览、材料和审核页面按工作优先顺序重排；材料上传、处理状态和列表进入首屏，统计与配额折叠；审核卡以业务对象、变化、影响、证据为主，Schema、UUID 和字段路径进入技术详情。
- 三种项目创建方式统一进入项目骨架确认；创建弹窗补焦点陷阱、Esc 关闭与焦点恢复。
- 平台设置补连接状态、Chat/Generation/Vision 测试连接、正确的表单 autocomplete 语义和高级参数折叠；测试端点继续只允许平台管理员且不返回密钥。
- 移动端恢复路线图核心内容的可滚动投影，统一正文、导航、控件和 44px 点击目标，降低 Hero、阴影和圆角的视觉权重。

### 验证

- 新增 `test/workflow-first-ui.test.mjs` 与 `test/settings-service.test.mjs`，并更新材料、提案、审核发布和 Playwright 契约。
- `npm run verify` 通过：168 项后台测试、46 项 Playwright E2E、三组目标视口、浏览器证据、Xugu 等价和参考来源只读校验全部通过。
- 逐项结论记录于 `.planning/phases/11-workflow-first-ui/11-VERIFICATION.md`。WUI-03、05、06、08、11、16、18 仍为部分完成，因此 Phase 11 不标记 complete。

## 2026-07-29：多文档到路线图 UI 复跑

状态：`implemented / browser verified`

- 在隔离临时数据库中，使用正式材料 worker 和当前已配置 generation provider，只通过产品 UI 重跑项目推进材料 Benchmark。
- DOCX、XLSX、群聊 TXT、邮件链 TXT、供应商 JSON 均成功归档并提取；EML 和重复 DOCX 分别被不支持格式与重复内容门阀拦截。
- 专用项目计划 TXT 经 UI 生成 3 个带来源的 roadmap 变更，逐项人工接受、应用到草稿、通过发布检查并发布；发布后的路线图可以看到并展开三个新节点。
- 复跑发现连续上传按钮未恢复和 roadmap `date` 未投影为 `dateLabel` 两项回归，已修复并补服务/静态契约测试。详细证据见 `.planning/benchmarks/project-progression-ui/RESULT.md`。
- 修复后 `npm run verify` 通过：169 项后台测试、46 项 Playwright E2E、浏览器证据、Xugu 等价和参考来源只读校验全部通过。

## 2026-07-29：平台关闭设计与总览更新入口

状态：`accepted / implemented / focused verified`

- 用户要求明确后台运行后的关闭方法，并特别指出还有一套虚谷数据库；从所有权出发，将平台进程、材料 worker、平台数据库连接与外部数据库服务区分。
- 新增 NFR-08、D-043，并同步 Runtime、Operations、Product Experience 三个系统模块 Design。
- 源码运行新增 `start:background / status / stop / restart`。平台只向自己登记的 Node PID 发送 SIGTERM，等待 HTTP、worker 和连接优雅收尾；不执行 Docker 或虚谷数据库启停。
- 总览主 CTA 从“上传项目材料”改为“项目更新”。路由仍指向材料台账，使入口能同时承接上传、处理状态和已有更新建议，而非把业务动作误缩窄为一次上传。
- 生命周期集成测试使用隔离端口和临时数据目录，已验证后台启动、健康查询和优雅停止；工作流静态契约已验证新文案。
- `npm run verify` 通过 171 项后台测试和 46 项既有 Playwright 流程；随后补充定向点击用例，验证“项目更新”进入 `materials?view=ledger`。

## 2026-07-29：项目更新模板与异常材料 UI 闭环

状态：`accepted / implemented / verified`

- 从创建和项目更新是一条连续材料输入链路出发，新增 MAT-06、CRT-06、WUI-19–20 与 D-044；长期 Materials & Evidence、Product Experience 设计同步更新。
- 六类 Markdown 模板统一为共享静态目录：会议纪要、项目计划、进展汇报、指标数据、成果归档、项目创建材料。创建入口、总览“项目更新”、材料台账、上传/人工录入、单项/批量生成、更新建议和材料详情均提供就近下载。
- 项目创建材料 API 复用空文件、扩展名/MIME 和内容签名门阀；文本材料缺少明确项目名称或目标时不进入骨架确认。补测时发现 Markdown 标题曾被误取单字符，已修为提取完整标题。
- 新增隔离异常材料 Playwright 套件，覆盖空文件、伪装 PDF、未知格式、缺少创建要素、重复材料、阶段用途不匹配和真实模板下载；失败后不增加项目、材料或生成任务。
- `npm run verify` 通过：173 项后台/静态测试、47 项主流程 Playwright、8 项异常材料 Playwright、全部浏览器证据、Xugu 等价和参考来源只读检查。
- 真实 4173 页面检查确认总览模板入口与“项目更新”主次层级清楚，上传侧栏模板控件位于用途选择与备注之间，无遮挡或溢出。

## 2026-07-29：AI 生成项目节点预览与路线图投影

状态：`accepted / implemented / verified`

- 用户确认普通界面不应继续以“更新建议 / 提案”作为主心智，应统一表达为“AI 生成项目节点预览 / 节点预览”；`ChangeProposal` 仅保留为后端领域、安全和技术详情术语。
- 节点预览页面必须在变更卡片下方默认展示只读路线图投影，让用户直接判断 AI 新增或修改的阶段/任务位于哪一段路线、以何种卡片样式出现。
- 投影以当前 published graph 为基准，在内存中应用当前预览选择；待决定与已接受项进入投影，已驳回项退出投影，编辑后接受使用审核后的值。投影不得写入 draft/published。
- “AI 生成项目节点预览”必须成为项目资料中的固定可发现入口，不再依赖先进入材料详情或生成任务后才能找到。
- 本方向新增 REV-07、WUI-21 和 D-045。

### 实施结果

- 项目资料固定二级入口、工作区标题、生成面板、任务详情和审核详情统一使用“AI 生成项目节点预览 / 节点预览”；后端路由、Schema 和数据库继续保留 `ChangeProposal`。
- 节点预览卡片下方默认加载只读路线图投影；AI 新增为蓝色、修改为橙色、当前节点为中性色，选中节点明确高亮。
- 任务按阶段日期窗口只归入一个位置；日期不足的 AI 卡片进入“待排期卡片”，历史待排期节点折叠为数量摘要，避免淹没本次变化。
- 待决定与已接受项进入投影，编辑后接受使用 edited patch，已驳回项退出；服务测试确认投影前后版本指针和项目图未改变。
- 修复手动录入材料与上传材料生成资格不一致：手动材料及模板选择在内部自动开启 generation grant，界面继续不暴露授权步骤。

### 验证

- `npm run verify` 全绿：175 项后台/静态测试、47 项主流程 Playwright E2E、9 项隔离异常与节点预览 E2E。
- UI 点击用例从人工材料归档开始，经自动生成、任务详情、节点预览到路线图定位完整通过；AI 新卡片只出现一次并落入正确阶段或待排期区。
- 四组浏览器证据、Xugu 等价和参考来源只读检查继续通过。

## 2026-07-29：路线图卡片受控编辑与节点预览局部编辑

状态：`accepted / implemented / verified`

- 新增 REV-08、WUI-22 和 D-046。正式路线图与 AI 节点预览复用同一字段驱动编辑器，但按对象所有权采用不同提交语义。
- 正式路线图的阶段和任务卡片均提供“编辑”；保存创建 `interaction` ChangeProposal，关键字段变化与删除必须选择当前项目的可用材料证据，绝不直接修改 draft/published。
- 编辑字段覆盖阶段标题、日期、状态、描述、预期产出，以及任务标题、目标、负责人、状态、日期、进度、健康度、所属单元、父任务、依赖、相关方、交付物、风险、验收标准、决策、预期产出和来源。
- 节点预览仅对当前 proposal 的 added/modified 卡片显示编辑入口；既有发布节点只用于位置参照，使用降亮蒙层效果并显示“当前节点 · 只读”，不能通过预览越权修改。
- 节点预览编辑保存 edited patch 并即时重算路线投影，不自动接受；后续接受未显式提交新 patch 时会保留已保存编辑。删除预览卡片等价于驳回当前 change item。
- 两种删除均必须精确输入“确认删除”才启用。正式路线删除仍需材料证据并进入审核，节点预览删除不会影响正式路线。
- 修复标准项目阶段由任务派生时缺少真实目标的问题：路线 DTO 携带 `sourceTaskId`，阶段编辑映射回来源任务，避免 interaction proposal 验证报 target not found。

### 验证

- `npm run verify` 全绿：180 项后台/静态测试、48 项主流程 Playwright E2E、9 项隔离异常材料与节点预览 E2E。
- 主路线 E2E 验证编辑后进入新的节点预览且 published 标题不变；异常套件验证本次生成卡片可编辑、既有节点降亮无编辑按钮，以及删除按钮只有精确短语才可用。
- 四组浏览器证据、Xugu 等价和参考来源只读检查继续通过。

## 2026-07-29：项目资料与项目更新拆分并统一路线图 renderer

状态：`accepted / implemented / verified`

- 用户指出项目资料与项目更新被错误混合，且项目更新页同时存在生成控制台、统计、预览列表、任务列表和第二套路线图，形成重复流程与重复视觉。
- 新增 WUI-23 和 D-047：六个内容工作区保持不变，项目更新是独立流程动作；项目资料只保留战果档案与项目材料。
- 新增 `/projects/:projectId/updates`、`/updates/proposals/:proposalId` 和 `/updates/release`；旧 `materials?view=proposals|release` 深链只做兼容重定向。
- 项目更新页只选择最近一次待审核更新并显示一张“更新后的项目路线图”。该视图直接调用正式 `renderRoadmapSwimlane`，preview mode 只注入变更 marker、编辑 capability、审核链接和重载回调。
- 本次 added/modified 卡片高亮且可编辑；其他发布节点降亮并标为“当前节点 · 只读”。没有日期的节点进入同一 renderer 的待排期区，不再由专用预览组件另画一次。
- 删除旧 `ai-preview-stage-card`、`ai-preview-task-card` 等 DOM 与整套遗留 CSS；更新页移除生成统计、批量生成、提案列表、生成任务列表和材料模板控制台。
- 异常 UI 流程改为先在项目资料归档材料，再从生成任务进入项目更新；验证本次卡片编辑、精确输入“确认删除”和只读节点无编辑按钮。
- `npm run verify` 全绿：180 项后台/静态测试、48 项主流程 Playwright E2E、9 项异常材料与节点预览 E2E，全部浏览器证据、Xugu 等价和参考来源只读检查通过。

## 2026-07-29：共享图标语言与卡片操作位视觉收敛

状态：`accepted / implemented / verified`

- 用户指出可见“编辑”按钮生硬，顶栏与路线图多处图标像临时贴入，要求把视觉设计和卡片流程一起重新审视。
- 新增 WUI-24 与 D-048：熟悉工具统一由安全线性 SVG 目录渲染；纯图标提供 `aria-label` 与 `title`，高风险操作继续使用文字。
- 顶栏配置、问答、设置、退出，模块滚动，路线图状态/图例/锚点，项目创建方式和卡片编辑均改为同源线性图标；移除 Emoji、文本三角和创建方式的 `↑ / ··· / +`。
- 路线图编辑改为卡片内侧右上角的弱化铅笔工具位。展开主卡按实际网格列宽定位；窄任务卡修复最小内容宽度溢出，并把标题、AI 状态和徽标改为稳定纵向布局。
- 浏览器实测确认主卡与任务卡编辑按钮均位于对象边界内、无可见“编辑”文字，创建方式三张卡各只包含一个共享 SVG 图标。
- `npm run verify` 全绿：181 项后台/静态测试、48 项主流程 Playwright E2E、9 项异常材料与节点预览 E2E，全部浏览器证据、Xugu 等价和参考来源只读检查通过。

## 2026-07-29：项目更新回归材料起点并形成四步主流程

状态：`accepted / implemented / verified`

- 用户明确项目更新的主流程应为“上传材料 → 生成预览 → 人工审核 → 发布”，任何通用项目更新按钮都不能默认打开最近一次 proposal。
- 新增 WUI-25 与 D-049：通用 `/projects/:projectId/updates` 固定落在“本次材料”；历史待处理更新仅作为次级继续入口，不得替代新更新起点。
- 更新工作区展示“本次材料 → 处理与生成 → 模拟路线图 → 审核与发布”四步。上传完成后绑定 materialId，生成任务使用独立 task 路由，成功后进入绑定 proposalId 的模拟路线图，再进入同一 proposal 的逐项审核与发布。
- 旧 `materials?view=proposals` 兼容入口改为跳到材料起点；正式路线图交互产生的 proposal 仍直接进入其具体预览，避免丢失交互上下文。
- Playwright 覆盖总览点击项目更新后直接打开材料上传面板、通用入口不渲染路线图、历史更新次级续办、具体预览只渲染一张正式 renderer 路线图，以及异常材料生成后的具体预览跳转。
- `npm run verify` 全绿：182 项后台/静态测试、49 项主流程 Playwright E2E、9 项异常材料与节点预览 E2E，全部浏览器证据、Xugu 等价和参考来源只读检查通过。
