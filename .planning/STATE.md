# 项目状态

最后更新：2026-07-22

- 项目状态：`active`
- 当前阶段：Phase 9 进行中——切片一（同单元 parentId 真实拆解链）已落地并全绿验证
- 当前结果：Phase 1–8 的低代码更新闭环、材料关键内容诊断、作战单元生命周期、生产追踪、诊断包、产品内测试中心，路线图五种受控视图（活动路线图、项目泳道、阶段卡片板、作战单元进度、依赖网络）、拖拽到结构化提案与卡片化审核，以及全自动 Playwright 浏览器 E2E 层已完成
- 已实现平台功能：数据底座、Xugu 迁移、认证/成员、项目切换、九类固定模块、材料证据问答、结构化提案、审核合并、发布回滚、材料 readiness、作战单元生命周期、运维诊断、自检中心、审计、备份恢复、项目导入导出、路线图五视图工作台（含项目泳道·双锚点·生命周期分带）与交互式受控提案
- 下一步：推进 Phase 9 后续切片（单元级分形生命周期 LIF-05、术语模板化 LIF-01、多源合并收口 LIF-04）；或进入内部单服务器试用
- 当前阻塞：无

## 2026-07-20 Phase 8 完成

- 路线图升级为四种受控视图，通过同一 Roadmap 路由的 `?view=` 切换：活动路线图（战略曲线 + 时间列）、阶段卡片板（状态泳道）、作战单元进度、依赖网络。视图只是同一版本化项目图的不同投影，不改变 published/draft/proposal 边界。
- 卡片板任务可拖拽，但拖拽只创建 `interaction` 模板 ChangeProposal，仍经审核与 copy-on-write 草稿合并；高影响字段必须引用本项目已就绪材料证据。
- 新增交互提案服务路径（`createInteractionProposal`），锁定当前 published、复用 validator、保存为 pending，不调用 LLM、不创建 generation job。
- 审核工作区把每项 change 呈现为审核卡片（字段差异、证据、置信度、警告、接受/驳回/编辑后接受）。
- 验证：148 项后台测试 + 26 项 Playwright E2E（含 Phase 8 的 8 项）全绿；新增 `test/interaction-proposal.test.mjs` 4 项交互提案服务层契约测试。

## 2026-07-20 交互修正

- Xugu 战役路线图当前节点的作战单元分支摘要已改为可点击/可键盘触发的轻量胶囊，点击后写入 `unit` 深链、选中胶囊，并将对应分支详情高亮置顶。
- 节点切换继续写入 `stage` 深链并清除旧 `unit/task` 选择，避免跨节点状态残留。

## 2026-07-20 Phase 8 产品方向已确认

- 用户确认路线图不应停留在单一曲线节点图：需要采用时间列活动路线图表达阶段、目标、作战单元分支与任务，并使用阶段卡片板推进执行工作。
- 四种固定视图确定为：活动路线图、阶段卡片板、作战单元进度、依赖网络。它们是同一项目版本图的不同投影，而非独立数据或可执行页面配置。
- 点击路线节点、分支、作战单元或任务必须立即给出就地详情、选中态与深链；禁止把结果默默放在页面很下方。
- 材料上传后的新增、更新、归档建议应以审核卡片呈现，卡片展示证据、字段差异、关键缺失、风险与审核动作。任务拖拽或状态移动也只能创建受证据、角色与审核保护的 `ChangeProposal`，不得直接写草稿或发布态。
- 详细实施上下文见 `.planning/phases/08-roadmap-visual-workbench/CONTEXT.md`；本方向尚未编码，不得作为已完成结果宣称。

## Phase 6 验收

- 迁移 006 保存审核项、合并记录和发布事件；复合外键与层级触发器阻止跨项目和错误层版本关系。
- 单项接受/驳回/字段编辑、整模块接受和 copy-on-write 合并均按项目管理员权限与 CSRF 控制；非法编辑不会留下审核决定或版本。
- 发布仅从当前草稿创建新发布版本和新草稿基线；回滚只允许直接前驱，版本指针和审计事件在同一事务中提交。
- 平台/项目管理员、编辑者和查看者角色矩阵、用户/成员安全 API、追加式审计、备份/恢复和导入/导出通过隔离测试。
- 10 项参考评估、17 个浏览器阻断用例、6 张哈希/尺寸机检截图通过；参考 Xugu 应用未变。
- 参考应用 HEAD、Git 状态和种子哈希未变。

## Phase 7 验收

- 迁移 007 保存材料 readiness 快照、生成任务材料 readiness、操作 trace、脱敏错误事件和产品测试运行记录。
- 六类更新模板在生成前检查关键内容覆盖；关键缺失阻止生成，非关键缺失以 warning 进入材料详情和生成上下文。
- 作战单元支持 active/archived/exited；归档或退出必须带生效日期、原因和证据，且不得留下未关闭任务引用。
- 所有 HTTP 响应提供 `x-request-id`，未知 5xx 记录可检索脱敏堆栈、错误指纹、用户/项目/路由和 trace 上下文。
- Materials 工作区新增管理员“运维自检”，可运行核心测试、查看历史运行和最近错误事件；查看者被统一 404 隔离。
- 148 项后台自动化测试 + 26 项 Playwright 全自动浏览器 E2E、统一验证和本机浏览器抽查通过；参考 Xugu 应用未变。

## 验证基线

```bash
npm run verify
```

## 2026-07-20 全自动浏览器 E2E

- 引入 Playwright + Chromium 全自动浏览器 E2E 层：自动启动临时数据库的 fixture server，覆盖登录与项目导航、路线图 stage/unit/task 深链与就地详情、材料→生成→审核→草稿合并→发布/回滚闭环，以及跨项目 404、角色矩阵、CSRF 隔离回归。
- 新增 `npm run test:e2e` 与 `npm run e2e:install`；E2E 接入 `npm run verify` 尾部，单条命令即可在可监听环境拿到 148 后台测试 + 26 E2E 全绿。
- `node --test` 显式限定 `test/*.test.mjs`，避免默认发现把 `test/e2e/fixtures/server.mjs` 当作测试文件阻塞。
- 本层为 Phase 8 路线图可视化工作台的浏览器测试奠定了 harness 基础；现有产品行为未改变。
当前命令执行 148 项后台自动化测试与 26 项 Playwright 全自动浏览器 E2E，并额外完成语法、Phase 3–6 浏览器证据哈希/尺寸、迁移、导入/导出、认证/模块/材料/提案/审核/发布/诊断/自检 API、备份恢复、跨项目安全、敏感运行文件和参考项目只读校验。

## 2026-07-20 路线图模块化重设计（粗主线 + 支线下钻）

- 活动路线图（timeline）展示层按 Aha（粗主线层级抽象）+ Trello（卡片→点击下钻）重做：SVG 只留阶段节点 + 模块摘要芯片（单元数/任务数/进度），节点详情改为模块检查器（阶段说明 + 摘要条 + 作战单元模块卡片网格，点击单元展开任务、点击任务就地展开详情）。
- 移除原分支胶囊、时间列与全展开分支图；四个视图、`?view=&stage=&unit=&task=` 正交深链、拖拽提案边界与 published/draft/proposal 隔离不变。
- 修复交互缺陷：摘要芯片移出 `route-node` 分组并禁用指针事件（节点点击落空）；任务按钮加 `stopPropagation`（点击冒泡清空 task 深链）。
- 修复 E2E 端口冲突：`03/04/05` 的 `BASE` 由硬编码 `4191` 改为读 `E2E_PORT`，`verify` 的 Playwright 步骤自动选空闲端口。
- `npm run verify` 全绿：148 后台测试 + 26 E2E（含 Phase 8）+ 浏览器证据；参考虚谷应用未变。
## 2026-07-21 路线图项目泳道视图（第 5 视图）

- Roadmap 模块新增第五种受控视图 `?view=swimlane`（项目泳道），与 timeline/board/units/network 共享同一版本化项目图投影，正交深链新增 `?anchor=`。
- 主泳道按时间轴铺排阶段（项目锚点·拆解），副泳道按作战单元铺排任务条（并行子任务自动 track 着色、`?unit=` 高亮、`?task=` 下钻），收口锚点（`closures.between`）落在两端阶段中点；顶部生命周期三带（事前/事中/事后）由 `stage.state` 派生。
- 修复展示层三处缺陷：`el()` 嵌套数组需展开（条状元素曾渲染为 `[object HTMLButtonElement]`）、粘性页头/导航拦截锚点点击（补 `scroll-margin-top:152px`）、早期阶段在时间轴上聚集导致站点水平互盖（按时间位置贪心分配 lane 行，时间位置不变、仅垂直错开）。
- 纯渲染层 + 派生：不改 published/draft/proposal 隔离、CSRF、角色、模板、数据库 schema、`loadRoadmap` 字段，不调用 LLM。
- `npm run verify` 全绿：148 后台测试 + 27 E2E（新增 swimlane 断言）+ 浏览器证据；参考虚谷应用未变。

## 2026-07-21 沉淀分形作战生命周期规划

- 把用户提出的"分形作战生命周期（事前/事中/事后，可下沉到作战单元）+ 主副泳道双锚点 + 多次拆解合并"沉淀为正式规划：DECISIONS.md D-022（为什么）、REQUIREMENTS.md LIF-01–05（要什么）、ROADMAP.md Phase 9（做什么，`planned`）。
- Phase 8 泳道视图（`?view=swimlane`）已落地范式可见层（纯投影，全绿验证）；Phase 9 将拆解关系、单元级分形、术语模板化、多次拆解合并深化到数据/提案/模板层。

## 2026-07-22 Phase 9 切片一：同单元 parentId 真实拆解链

- 方向 A（阶段作项目锚点、parentId 只管同单元拆解）已确认并落地。调研发现 DB/迁移/仓储/DTO/validator 五层早已支持 parentId，唯一缺种子数据与渲染器显式表达。
- 虚谷种子（published+draft 各 4 条）补真实同单元拆解链：研发 `rd-driver-productize→rd-core-assessment`、`rd-tool-rebuild→rd-driver-productize`；技术 `tech-company-knowledge-pilot→tech-kb-foundation`；财务 `finance-scale→finance-data-security`。
- 关键约束：`schemas.mjs validateTaskDag` 把 parentId 与 dependsOn 合并去重，故 parentId 不得与既有 dependsOn 重复（否则 MODULE_VALIDATION_FAILED）；4 条链均避开重复。
- 泳道渲染器升级：带 parentId 的子任务条加 `⇢` 拆解标记与橙色色带（`has-parent`）；选中任务时高亮整条拆解链（父链+子链，`chain` class），非链任务淡化（`dimmed`），图例新增「同单元拆解链」。
- 同步更新迁移来源基线：参考应用 `state.seed.json` 补相同 4 条 parentId 并提交（HEAD `d8224f30`），4 个 browser-evidence manifest 的 reference head/seedSha256 同步更新，fixture 与参考种子哈希重新等价。
- 纯渲染层 + 种子数据：不改 validator 跨单元禁令、不加 stageId、不改 schema/隔离/CSRF/角色/模板/loadRoadmap DTO 形状。
- 验证：`npm run verify` 全绿——149 后台测试（+1 拆解链种子校验）+ 28 E2E（+1 拆解链渲染断言）+ 4 组浏览器证据；参考虚谷应用基线已提交更新。
