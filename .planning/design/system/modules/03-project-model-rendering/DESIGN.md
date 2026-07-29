# Design S-03：Project Model & Rendering

状态：`implemented baseline`

## Fixed Modules

底层九模块：

1. overview
2. units
3. roadmap
4. task-network
5. gantt
6. outcomes
7. risks
8. metrics
9. materials

用户侧六工作区：

- 总览。
- 项目路线图。
- 作战单元/团队。
- 排期甘特。
- 项目健康。
- 项目资料。

## Template Contract

模板由 `templateId@version` 标识，至少定义：

- schemaVersion。
- terminology/presentation。
- theme allowlist。
- required modules 和顺序。
- 字段和状态枚举。
- default/allowed view variants。
- 校验和迁移策略。

模板发布后不可原地修改语义；变化使用新版本。

## Version Graph

每个 version 拥有：

- module configuration。
- units。
- stages/closures。
- cards/tasks。
- parent/depends-on links。
- workstreams。
- risks/metrics。

对象使用项目内稳定 external ID；数据库内部 version ID 区分不同快照。

## Unified Card Model

`project_cards` 统一表达阶段、任务和可扩展项目卡片，并保存：

- element type。
- title/description。
- unit/parent。
- state/progress。
- owner。
- start/end。
- position 和扩展字段。

`project_card_links` 表达依赖。旧 task/stage 结构在兼容期继续由 loader 统一投影。

## Validation

- 所有引用对象必须属于同一 version/project。
- parentId 限同一作战单元。
- parent 和 dependsOn 合并后必须是 DAG。
- startDate ≤ endDate。
- unit archive/exit 不得留下未关闭引用。
- required modules 不得缺失。
- terminology/theme/view 必须在模板 allowlist。

## Loaders and DTOs

loader 读取明确 layer/version，输出固定 DTO。浏览器 renderer map 根据 module type 选择仓库内函数，不读取项目提供的代码。

所有 DTO：

- 包含项目显示术语。
- 不暴露数据库私有路径或密钥。
- 按 capability 删除不可见操作。
- 保持深链所需稳定 external ID。

## Roadmap Projections

- 项目路线图：阶段时间锚点 + 单元副任务卡 + 拆解/收口。
- 阶段卡片板：按状态组织相同任务。
- 单元进度：按 unit 聚合同一任务。
- 依赖网络：读取相同 links。
- 甘特：读取相同真实日期。

切换投影不创建新事实。

## Lifecycle

- 项目级阶段派生模板化生命周期带。
- unit 生命周期由自身任务状态/日期投影派生。
- unit 实体状态为 active/archived/exited。
- 历史版本仍可查看已归档或退出单元。

## Configuration Writes

模块启停和排序只写 draft，并经过模板 required-module 校验。查看者只读 published。

## Planned UI Projection

Phase 11 将增加移动端等价列表投影和紧凑首屏，但不改变本模块数据模型。详见 Phase 11 模块 06。

## Verification

- 模板 catalog/validator。
- 九模块注册和未知模块失败关闭。
- Xugu/standard fixture 语义。
- 任务 DAG、日期、unit 生命周期。
- 五视图同对象深链和一致性。
- 配置只写 draft。
