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
