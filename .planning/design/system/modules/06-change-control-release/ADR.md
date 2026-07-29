# ADR S-06：不可变提案、独立人工决定与 copy-on-write 发布链

状态：`accepted / implemented`
关联：D-004、D-015–017、D-019–021、D-031、D-038、D-045–046

## Context

材料和交互会产生项目变化，但模型建议、人工修订、草稿状态和已发布事实必须可以分别解释。任何部分写入都会污染项目图并削弱回滚能力。

## Decision

- ChangeProposal 和 proposal item 保存后不可变。
- 人工决定和 edited patch 保存为独立 review entity。
- 接受不自动合并；合并不自动发布。
- 合并通过 copy-on-write 创建新草稿，完整校验成功后才切换指针。
- 发布创建新不可变 published 和新 draft baseline。
- 回滚只允许当前发布事件的直接前驱，并形成新事件。
- UI 可以编排步骤，但不能创建直达发布权限。
- 产品界面把 ChangeProposal 表达为节点预览；路线图位置预览只在内存应用待决定与已接受项，已驳回项退出投影。

## Rejected Alternatives

| 方案 | 原因 |
|---|---|
| 直接修改模型 proposal | 丢失模型原建议与人工修订差异。 |
| 接受时原地更新草稿 | 任一后续失败可能留下部分图。 |
| 合并后自动发布 | 违反人工发布边界。 |
| 任意选择历史版本回滚 | 容易造成版本链跳跃和关系不一致。 |

## Consequences

- 草稿合并和发布是两个可恢复状态。
- 审核编辑必须重新执行字段和领域校验。
- 发布中心必须基于服务端重新计算差异和检查。
- 用户可以在决定前看到节点落入路线图后的卡片效果，而无需把预览写入任何版本。

## Invariants

- pending/stale proposal 不能绕过基准冲突。
- rejected item 永不应用。
- high-impact item 必须满足证据和确认要求。
- 发布失败不改变 published。
