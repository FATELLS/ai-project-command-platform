# Phase 9：分形作战生命周期与拆解模型

状态：`implemented`
最后更新：2026-07-22

## 起源（来自用户另一个 session）

用户提出两条核心思想，要求路线图反映真实项目推进：

1. **分形生命周期范式**：项目推进时目标持续变化，大目标和阶段划分应该是通用范式（事前/事中/事后）。准备阶段不同作战单元拆解任务，执行阶段每个作战单元各自走自己的完整阶段动作（研发、销售链路同理）。生命周期范式可分形下沉到作战单元。

2. **主泳道多次拆解合并**：主路线图存在多次任务拆解与合并，符合真实推进。主泳道 + 多个作战单元副泳道（类似甘特图），主→副拆解有项目锚点，副→主收尾有收口锚点。一个作战单元可同一时间并行多个子任务。

这两条思想先沉淀为 D-022 决策 + LIF-01..05 需求 + Phase 9 路线图（2026-07-21），再于 2026-07-22 分四个切片落地。

## 与 Phase 8 的关系

Phase 8 泳道视图（`?view=swimlane`）已用纯投影层落地范式的**可见层**：三带、主副泳道、双锚点、并行子任务。但拆解关系靠任务→阶段时间窗口归属推断（`phaseOf()`），缺真实数据链。

Phase 9 把范式从"可见投影"深化到"数据 + 术语 + 渲染完整闭环"：真实拆解链、模板化术语、多源收口、单元级分形，全部落到可追溯的数据与渲染层。

## 关键设计决策（思考过程）

### 决策 1：方向 A — 阶段作项目锚点，parentId 只管同单元拆解

**张力**：LIF-04 要求"一个阶段拆解出子任务分发给不同作战单元"（跨单元拆解），但 `project-validator.mjs:61` 硬性禁止跨作战单元的 parentId（`linked.groupId !== task.groupId` 直接 fail）。两者直接矛盾。

**选项**：
- 方向 A：阶段作为项目锚点，parentId 仅表达同单元内主→子拆解；跨单元的"阶段拆解"由阶段本身作为锚点表达（所有落在该阶段窗口内的各单元任务都是它的拆解产物）。
- 方向 B：放开 validator 允许跨单元 parentId，引入无 unit 的"拆解根任务"。

**选 A**：不破坏既有约束、改动最小、符合 D-022"拆解锚点是阶段起点"语义。拆解关系不再靠时间窗口推断，而是显式 parentId，但仅限同单元。

**调研发现**：DB/迁移/仓储/DTO/validator 五层早已支持 parentId（schema `parent_external_id` 带外键、迁移器搬运、仓储读写、loader 投影、validator 校验环+跨单元禁止）。唯一缺的是种子数据与渲染器显式表达。

### 决策 2：不加显式 stageId，保持窗口投影

阶段→单元任务归属用 `phaseOf()` 时间窗口投影已正确（29 任务都落到正确阶段窗口）。加 stageId 要改 schema/仓储/迁移/loader/validator/种子，风险大收益小。本阶段聚焦 parentId 真实拆解链。

### 踩坑：parentId 与 dependsOn 合并去重（duplicate link）

**现象**：切片一首次种子补 parentId 后，E2E 全部泳道测试失败——服务端 500 `MODULE_VALIDATION_FAILED: graph.tasks[14]: contains duplicate link tech-company-knowledge`。

**根因**：`schemas.mjs validateTaskDag` 把 parentId 和 dependsOn 合并成同一个 links 列表去重。我最初的 3 条链里，parent 已经在任务的 dependsOn 数组里，造成重复 link。

**修复**：重选不与 dependsOn 冲突的 4 条同单元拆解链，并在种子校验测试加防回归断言（parentId 不得与 dependsOn 重复）。这揭示了系统的语义：parentId（拆解）和 dependsOn（依赖）被 validator 当作同一种边——当子任务既拆解自父任务又依赖父任务时，本就是同一条关系。

### 决策 3：方向 Y — 分形投影派生，不加 unit 独立 stage 集

**张力**：LIF-05"单元级分形生命周期"有两种实现：
- 方向 X：每个 unit 拥有自己的子阶段序列（真分形 stage），各带自己的事前/事中/事后。问题：与项目级 stage 窗口语义重叠，真实数据无独立 unit-stage 定义，数据模型扩展大。
- 方向 Y：每个 unit 的生命周期带由它自己任务的状态/日期派生——同一范式下沉到 unit 层，但不带独立 stage 数据。

**选 Y**：符合"分形"本质（同一范式下沉，非给每 unit 造独立 stage 体系）；零数据模型扩展；真实业务里"研发/销售链路的阶段动作"就是该 unit 任务集合的状态演进；与项目级 phaseOf 正交。

**派生规则**：全部任务完成→converged；有进行中任务或有排期任务→active；否则→prepare。

**数据约束发现**：虚谷任务的 state/progress 数据稀疏（29 任务只有 1 个有 progress=100），大多数 unit 靠日期窗口判 active。派生规则仍正确，但 converged 带需任务标记完成才有数据支撑。

### 决策 4：术语模板化（LIF-01）走 presentation 既有机制

生命周期三带术语原硬编码在渲染器 `SWIMLANE_BAND_LABEL`。发现 `projectPresentation`（app.js）已有 terminology→presentation 映射机制（campaign/standard 两套），只是没有生命周期带术语。在两套 presentation 各加 lifecyclePrepare/Active/Converged 键，渲染器从 presentation 读（带回退），即实现模板化。纯展示层+配置。

## 边界（全部四个切片共同遵守）

- 不改 schema（无新列、无新迁移）。
- 不改 validator 跨单元 parentId 禁令（方向 A）。
- 不改 published/draft/proposal 隔离、CSRF、角色、模板不可变基线（@1.0.0）。
- 不改 loadRoadmap/loadUnits DTO 字段形状。
- 拆解/收口/分形关系变更仍经结构化提案审核（本阶段无新写入路径，纯投影渲染 + 种子数据增强）。

## 参考基线同步

切片一、切片三改了种子数据（parentId、3 元素 between closure），必须同步更新迁移来源参考应用 `state.seed.json`（保持 fixture 与参考种子哈希等价），并提交参考应用、更新 4 个 browser-evidence manifest 的 reference head/seedSha256。参考应用两次提交：HEAD `d8224f30`（parentId）、`90bcc64`（多源收口）。

## 本会话工具备注

- E2E 须等副泳道任务条渲染完成后再 count（`.swimlane-bar[data-parent]` 在渲染前为 0），否则误判失败。
- 临时调试测试（`zz-debug.spec.mjs`）用于打印 DOM 诊断选择器问题，用后即删。
- 参考种子写入需提权（workspace 外路径）。
