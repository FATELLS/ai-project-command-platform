# Phase 8 验证

最后更新：2026-07-21

## 验证命令

```bash
npm run verify
```

当前通过 148 项后台自动化测试 + 27 项 Playwright 全自动浏览器 E2E（含泳道视图断言）。

## 视图与交互（VIS-01..05）

- 五种视图切换器存在、可互跳，URL 写入 `?view=` 并可恢复（E2E 05-1）。
- 深链 `?view=board` 直接恢复卡片板，按状态泳道渲染任务卡（E2E 05-2、05-3）。
- 时间列活动路线图：每个 stage 列含目标与归入该窗口的分支任务；主曲线与时间列同屏（E2E 05-1）。
- 作战单元进度视图：单元卡显示完成度，点击/键盘展开任务并写入 `?unit=` 深链（E2E 05-7）。
- 依赖网络视图：复用 task-network 数据，渲染依赖列表，可按单元筛选（E2E 05-8）。
- **项目泳道（第 5 视图，LIF 可见层）**：主泳道按任务时间轴铺阶段（拆解锚点·项目锚点），副泳道按作战单元铺甘特任务条（并行子任务 track 着色），收口锚点由 `closures.between` 两端阶段中点生成；顶部生命周期三带（事前/事中/事后）由 `stage.state` 派生；`?stage=`/`?unit=`/`?task=`/`?anchor=` 深链正交（E2E 05-9）。
- stage/unit/task 选择互相正交，切换 stage 清除旧 unit/task 选择（renderers 状态机）。

## 拖拽受控提案（VIS-04）

- 编辑者拖拽卡片发起 `interaction` 模板 ChangeProposal；状态 `pending`（E2E 05-4）。
- 任务在发布版的 state 不因提案改变（拖拽不直写 published/draft）。
- 缺 CSRF 的交互提案返回 403（E2E 05-5）；viewer 返回统一 404（E2E 05-6）。
- 服务层：带证据的高影响变更被接受并保持 pending、不改版本指针；无证据高影响变更 `EVIDENCE_REQUIRED`；无材料 `INVALID_MATERIAL_SELECTION`；伪造/跨项目证据 `EVIDENCE_NOT_ALLOWED`（`test/interaction-proposal.test.mjs` 4 项）。

## 卡片化审核（REV-06）

- 提案工作区把每个 proposal 渲染为卡片；提案详情把每项 change 渲染为审核卡片，显示原值/建议值、证据定位、置信度、警告与「接受 / 驳回 / 编辑后接受」（E2E 03 材料生成→审核→发布/回滚闭环沿用，renderers `proposal-change-card`）。

## 安全与隔离

- 交互提案模板列入受控 catalog（`interaction`），提案模板数由 6 增为 7（`test/proposal-schema.test.mjs`）。
- 复用既有 CSRF、角色、项目隔离、版本边界与审计；`proposal.interaction_created` 写入审计事件。
- 参考虚谷应用的 HEAD、Git 状态与脱敏种子哈希在验证中未变。
