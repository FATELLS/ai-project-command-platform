# Phase 8 设计契约：路线图可视化工作台与卡片化审核

状态：`implemented`
最后更新：2026-07-20

## 信息架构

四种固定视图是同一受控项目版本图的不同投影，通过同一 Roadmap 路由的 `?view=` 参数切换：

| view | 视图 | 投影 |
|---|---|---|
| `timeline`（默认） | 活动路线图 | 战略曲线 SVG + 按 stage 的时间列（目标、分支任务） |
| `board` | 阶段卡片板 | 任务按状态泳道（待确认 / 进行中 / 待审核 / 已完成） |
| `units` | 作战单元进度 | 以单元为入口的覆盖阶段、任务、完成度 |
| `network` | 依赖网络 | 复用 task-network 数据的跨单元跨阶段阻塞关系 |

- 视图切换不改 `published / draft / proposal` 数据边界；切换只是渲染投影。
- 项目配置不能提供 HTML/CSS/JavaScript/SVG；四种视图全部由仓库内固定渲染器实现（`public/modules/renderers.js`）。
- `units / tasks / edges` 由 `loadRoadmap` 统一投影，供四种视图共用（VIS-05）。

## 深链与对象选择状态机

- 选择对象写入查询参数并就地展开，不滚动到页面底部。
- `?view=` 决定视图；`?stage=`、`?unit=`、`?task=` 决定对象焦点，三者正交。
- 时间列 / 卡片板 / 单元卡 / 依赖项均可点击或键盘触发，写入对应查询并高亮选中。
- 节点切换 stage 时清除旧 `unit/task` 选择，避免跨节点状态残留。

## 拖拽到提案的安全语义

- 卡片板任务卡可拖拽（仅 `platform_admin / project_admin / project_editor`）；viewer 的卡片不可拖拽。
- 拖拽不直写 `draft` 或 `published`；它只创建 `ChangeProposal`，仍经审核、copy-on-write 草稿合并、人工发布。
- 拖拽落点打开交互提案表单：从项目已就绪材料加载证据供用户勾选引用。
- 服务端 `createInteractionProposal` 锁定当前 `published`，复用 `validateProposal`，保存为 `pending`，不调用 LLM、不创建 generation job。
- 高影响字段（`state`/`owner`/日期等）必须引用证据；引用证据必须属于本项目已就绪材料；跨项目或不存在证据被拒（`EVIDENCE_NOT_ALLOWED`）。
- 缺 CSRF 返回 403；viewer 返回统一 404；`published/draft` 指针在交互提案路径上不被修改。

## 卡片化审核（REV-06）

- 更新提案工作区把每个 proposal 呈现为卡片（基准版本、模板、变更数、状态）。
- 提案详情把每项 change 呈现为审核卡片：字段差异（原值/建议值）、引用证据定位、置信度、警告、关键缺失提示，以及「接受 / 驳回 / 编辑后接受」动作。
- 整模块接受、copy-on-write 事务合并到草稿、人工发布/回滚沿用 Phase 6 既有边界；AI、拖拽与客户端均无直达发布路径。

## 视觉约束

- 桌面延续 Xugu 白色顶部导航、暖色指挥背景与作战语言；不退回深色左侧栏 SaaS 外壳。
- 工作画布浅蓝灰、深海军蓝文字、蓝色主操作；目标卡浅绿、关键缺失/风险卡浅橙。
- 卡片紧凑信息密度、轻边框、柔和阴影；避免主路径波浪线、无意义圆点、密集交叉线与把明细藏到页面底部。
