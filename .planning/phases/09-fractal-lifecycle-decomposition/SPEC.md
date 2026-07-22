# Phase 9 设计契约：分形作战生命周期与拆解模型

状态：`complete`
最后更新：2026-07-22

## 范式模型（D-022）

- **分形生命周期**：项目层面 事前/事中/事后 三带（由 stage.state 派生），范式可分形下沉到作战单元。
- **主副泳道**：主泳道（阶段时间轴）+ 副泳道（作战单元甘特任务条）。
- **双锚点**：拆解锚点（阶段起点，主→副）+ 收口锚点（`closures.between` 两端阶段中点，副→主）。
- **多次拆解合并**：一个阶段可多次拆解出子任务，多个子任务/单元可合并收口；一个作战单元可并行多个子任务。

## 切片一：同单元 parentId 真实拆解链（LIF-02/03 可见层）

- parentId 仅表达**同单元内**主→子拆解（方向 A，validator 跨单元禁令不变）。
- parentId 与 dependsOn 在 validator（`validateTaskDag`）合并去重，不得重复（否则 `MODULE_VALIDATION_FAILED`）。
- 带 parentId 的子任务条加 `⇢` 拆解标记与橙色色带（`has-parent`）；选中任务时高亮整条拆解链（父链+子链，`chain` class），非链任务淡化（`dimmed`）。
- 种子补 4 条同单元拆解链（研发 ×2、技术 ×1、财务 ×1）。

## 切片二：生命周期术语模板化（LIF-01）

- 三带术语随项目模板配置：campaign（作战语言：事前/事中/事后）vs standard（通用项目管理语言：规划/执行/交付）。
- `projectPresentation` 两套各加 `lifecyclePrepare/Active/Converged` 键；项目层 terminology JSON 可覆盖。
- 渲染器从 `context.presentation` 读 `bandLabels`（带默认回退），删除模块级硬编码常量 `SWIMLANE_BAND_LABEL`。

## 切片三：多源合并收口（LIF-04）

- 收口锚点位置取**所有** between 阶段位置的平均值（原只取前两个中点），支持一个收口跨多个阶段。
- 数据层早已支持多元素 between（schema/loader 无长度限制），仅渲染器升级。
- 种子补一条 3 元素 between 收口（report-1/launch/pilot）验证多对多收口。

## 切片四：单元级分形生命周期（LIF-05）

- 副泳道行头（`swimlane-rail`）显示每个 unit 自己的生命周期带标记（色点+左边框+带标签），复用三带配色与模板术语。
- 派生规则（方向 Y，纯投影无新数据）：全部任务完成→converged；有进行中/排期任务→active；否则→prepare。
- 不给 unit 加独立 stage 集、不引入 unit-stage 数据字段、不改 loadUnits DTO。

## 深链与正交状态机（沿用 Phase 8）

- `?view=swimlane` 决定视图；`?stage=`/`?unit=`/`?task=`/`?anchor=` 决定对象焦点，四者正交。
- 选中 task 时拆解链高亮优先于 stage 过滤的 dimmed 逻辑。
