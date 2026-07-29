# 项目状态

最后更新：2026-07-25（Phase 10 用户体验简化已实施并通过验证）

- 项目状态：`active`
- 当前阶段：Phase 10 已实施；用户体验简化四项需求全部落地
- 当前结果：Phase 1–10 全部实施完毕；材料流程去授权化、问答浮动化、抬头重复消除和项目创建多样化已实现；159 项后台测试 + 35 项 Playwright E2E 全绿
- 已实现平台功能：数据底座、Xugu 迁移、认证/成员、项目切换、九类固定模块、材料证据问答、结构化提案、审核合并、发布回滚、材料 readiness、作战单元生命周期、运维诊断、自检中心、审计、备份恢复、项目导入导出、路线图五视图工作台（卡片泳道默认·双锚点·生命周期分带·分形作战模型）与交互式受控提案
- 下一步：收集卡片泳道与真实材料模板的试用反馈；补充 provider 价格配置与生产密钥轮换/托管方案
- 当前阻塞：无

## 2026-07-22 泳道化与调优（用户反馈）

- 会话空闲超时 30min → 4 小时（`DEFAULT_IDLE_TIMEOUT_MS`），绝对超时仍保持 8 小时硬上限。
- 路线图默认视图由「活动路线图」曲线改为「项目泳道」（`?view=swimlane`），原曲线视图保留为可切换。
- 泳道改为反应式模型：主泳道为阶段 tag 主脊（常显），点击某阶段展开主卡片（说明/产出/涉及单元/任务进度），再点收起回主脊（`spine=1`）；无主卡片时副泳道全部休眠不渲染任务条，打开主卡片后仅涉及该阶段的单元显示任务条（有涉及才展示）。
- 副泳道任务条点击 → 浮在泳道最上层的卡片浮层（`position:fixed` 最高层），含任务/单元详情、「单独打开」（深链到 Units 模块）与「关闭」按钮。
- 多作战单元展开错乱（launch 节点）从结构上规避：泳道用「每单元一行 + 浮层」模型替代原 timeline 栅格展开。
- 验证：149 项单元测试 + 34 项 Playwright E2E 全绿（含新增泳道默认反应式与任务浮层用例），浏览器证据与参考项目只读校验通过。

## 2026-07-23 A 卡片泳道正式实现

- 主任务本身组成横向时间路线，不再额外重复画一条路线和一张泳道。
- 无 `stage/task` 选择时隐藏全部副任务；点击主任务后，主卡片原位展示说明/产出，只渲染相关作战单元。
- 副任务按主任务阶段列锚定为固定宽度卡片，不以 `endDate` 或工期决定宽度；需要持续时间时继续使用独立甘特模块。
- 七色受控调色板稳定区分作战单元，完成/超时/风险同时提供文字或视觉提示。
- 点击副任务在原位置展开详情，再次点击收起；`stage/unit/task/anchor` 深链可恢复。
- 保留生命周期模板术语、同单元 `parentId` 拆解链、多源收口锚点和全部 published/draft/proposal 安全边界。
- 路线图定向 E2E 14/14 通过，并完成正式页面浏览器视觉检查。
- `npm run verify` 全绿：151 项自动化测试、33 项 Playwright E2E、19 张既有浏览器证据与参考项目只读校验全部通过。
- 后续密度反馈已落地：主/副任务折叠态均为单行标题，主阶段列宽 146px、副任务卡高 42px；定向静态契约 8/8、路线图 E2E 21/21 通过。
- 项目路线图语义已收敛：移除“活动路线图”入口和 timeline 投影，“项目泳道”改名“项目路线图”；旧 timeline 深链兼容回落。

## 2026-07-23 项目导航收敛

- 一级导航固定为六个工作区：作战总览、项目路线图、作战单元、排期甘特、项目健康、项目资料。
- 任务网络不再独占一级入口，依赖浏览统一使用项目路线图的“依赖网络”视图；旧模块仍保留在安全注册和 API 中。
- 项目健康二级入口为风险台账、效果指标；项目资料二级入口为战果档案、材料台账、更新提案。
- 显示层分组不会改变九类底层模块、发布/草稿版本、角色授权、提案审核或历史深链。

## 2026-07-23 非标准项目材料 UI Benchmark

- 新增可重复使用的 DOCX、XLSX、群聊、邮件链、JSON 和 EML 合成材料及其构建/视觉 QA 资产。
- 从真实 UI 完成 5 个正向上传和 2 个负向摄入用例；正向材料全部证据就绪，发布路线图保持 `v4.2`。
- 正式服务现在随 Web 进程启动串行材料 worker；XLSX namespace、单元格定位、文本类上传策略、门阀中文提示和生成面板 readiness 均已修正。
- generation provider 当前禁用，因此本轮只验证到生成准入面板；没有创建 proposal，也没有修改 draft/published。
- 全量验证通过 154 项后台测试、33 项 Playwright E2E、19 张既有浏览器证据及参考项目只读检查。
- 详细结果：`.planning/benchmarks/project-progression-ui/RESULT.md`。

## 2026-07-24 真实 GLM-5.2 生成、审核与发布 Benchmark

- 通过忽略的 `.env.local` 配置 OpenAI-compatible generation provider 与 `glm-5.2`；密钥未进入 Git、文档、日志或前端。
- 提示构建器新增精确 `ChangeProposal` 输出契约；provider 支持受控 `reasoning_effort=none`，减少思考文本干扰 JSON 输出。
- 通过产品 UI 创建并授权 BM-08 项目计划材料；生成任务一次成功，4317 Token，形成恰好 3 个带同一证据引用的 roadmap create 项。
- 平台管理员从 UI 逐项核对并接受 3/3，事务合并到 `draft-review-2`，发布检查 4/4 通过后人工发布 `v4.3`。
- 发布后的项目路线图显示三个新主任务节点；“GLM-5.2 结构化路线提案”展开态的日期、状态、说明和无副任务空态正常。
- 此闭环没有给 provider 审核、合并或发布权限；三步仍分别由人工 UI 动作完成。
- 修复路线末端主任务展开后被右边界裁切：画布完整计入列间距/padding，选中末端节点会自动滚入安全区。
- 主任务与副任务详情改为覆盖相邻列的宽卡展开：不挤宽时间线，首尾向内展开，其他折叠卡宽度不受影响。
- 打开主任务时，路线画布使用 18% 深蓝灰遮罩降亮非当前区域；选中主卡与同宽副任务面板保持前景。
- 主任务玻璃背景增强为约 76–84% 实色与 9px 模糊；副任务在 420px 面板内按三列紧凑排列，作战单元收成组顶部小色标，二级详情横跨整组但不越界。
- 主卡到副任务面板采用对称 SVG 平滑双坡线，已移除垂直硬连接与横向分割线。
- 版本提升到 `0.8.0`；Windows/Linux portable 和 RPM 分发、私有 GitHub Release 工作流、运行白名单与空数据库首次启动边界已实现。
- `FATELLS/ai-project-command-platform` 私有仓库与 `v0.8.0` Release 已发布；Windows/Linux 原生 x64 runner 启动冒烟和 RPM 构建全部通过。
- 全量 `npm run verify` 通过：157 项后台测试、35 项 Playwright E2E、浏览器证据、迁移/安全/分发检查和参考项目只读校验全部通过。

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

## 2026-07-22 Phase 9 切片二（LIF-01）：生命周期术语模板化

- 泳道生命周期三带术语（原硬编码事前/事中/事后）改为随项目模板配置：`projectPresentation` 的 campaign/standard 两套各加 `lifecyclePrepare/Active/Converged` 默认值。
- 虚谷（campaign 模板）保持作战语言「事前 · 待启 / 事中 · 当前 / 事后 · 已交付」；标准项目（standard 模板）用通用项目管理语言「规划 · 待启动 / 执行 · 进行中 / 交付 · 已完成」。项目层 terminology JSON 可覆盖。
- 渲染器 `renderRoadmapSwimlane` 从 `context.presentation` 读 bandLabels（带默认回退），删除模块级硬编码常量 `SWIMLANE_BAND_LABEL`；图例、阶段站点 meta、详情面板统一用 presentation 术语。
- 纯展示层 + 配置：不改 schema/validator/数据模型/隔离/CSRF/角色/模板种子/DTO 形状。
- 验证：`npm run verify` 全绿——149 后台测试 + 29 E2E（+1 术语随模板断言，验证标准项目泳道显示通用术语、虚谷显示作战术语）+ 4 组浏览器证据。

## 2026-07-22 Phase 9 切片三（LIF-04）：多源合并收口

- 收口锚点渲染从「只取 between 前两个阶段中点」升级为「所有 between 阶段位置的平均值」，支持一个收口锚点跨多个阶段（多对多收口）。数据层早已支持多元素 between（schema/loader 无长度限制），仅渲染器只用了前两个。
- 虚谷种子（published+draft）新增一条 3 元素 between 收口 `launch-pilot-convergence`（report-1/launch/pilot 三阶段多源合并），验证多源收口渲染；迁移来源基线 `state.seed.json` 同步并提交（HEAD `90bcc64`），4 个 browser-evidence manifest 的 reference head/seedSha256 更新。db-foundation/project-migration 测试的 closures 计数 2→3。
- 收口详情面板已用 `between.join(" → ")` 显示全部关联阶段（无需改），3 元素收口显示 `report-1 → launch → pilot`。
- 纯渲染层 + 种子数据：不改 schema/validator（多元素 between 早已合法）/隔离/CSRF/角色/模板/DTO 形状。
- 验证：`npm run verify` 全绿——149 后台测试 + 30 E2E（+1 多源收口断言）+ 4 组浏览器证据；参考虚谷基线已提交更新。

## 2026-07-22 Phase 9 切片四（LIF-05）：单元级分形生命周期（Phase 9 收官）

- 选方向 Y（从 unit 任务时序派生，零数据扩展）而非方向 X（unit 加独立 stage 集）：同一「事前/事中/事后」范式分形下沉到 unit 层，由 unit 自己任务的状态/progress/日期派生，不给 unit 造独立 stage 体系。
- 派生规则：全部任务完成→converged（事后）；有进行中任务或有排期任务→active（事中）；否则→prepare（事前）。
- 副泳道行头（swimlane-rail）显示 unit 级生命周期带标记：色点 + 左边框 + 带标签（复用 bandLabels 术语与三带配色），视觉表明同一范式下沉。platform（1 个无排期任务）→ 事前·待启，研发（有进行中任务）→ 事中·当前。
- 纯投影派生：不改 schema/迁移/validator/DTO/loadUnits，不引入 unit-stage 数据字段。
- 验证：`npm run verify` 全绿——149 后台测试 + 31 E2E（+1 单元级分形生命周期断言）+ 4 组浏览器证据。

**Phase 9 完成**：LIF-01..05 全部落地，分形作战生命周期与双锚点拆解模型从 Phase 8 的纯投影可见层深化到数据/术语/渲染完整闭环。

## 2026-07-24 产品方向反馈（第二轮）已持久化

- 用户试用后提出四个方向性反馈，已沉淀为正式需求编号和 Phase 10 规划。
- 需求：CRT-01–05（三种项目创建方式）、SIM-01–04（材料流程去授权化）、CHAT-04–05（问答右侧浮动入口）、UX-01（材料页面冗余消除）。
- 决策：D-030（三种创建入口）、D-031（去掉手动授权步骤）、D-032（问答浮动化）、D-033（消除导航重复）。
- 路线图：Phase 10 已加入，状态 `planned`。
- 当前阻塞：无；等待实施优先级确认。
