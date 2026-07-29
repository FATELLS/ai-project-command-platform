# Design S-06：Change Control & Release

状态：`implemented baseline`

## Proposal Sources

- LLM generation job。
- 路线图/卡片交互动作。
- 未来受控人工变更入口。

所有来源形成相同 `ChangeProposal` envelope，不存在 UI 直写版本图路径。

## Proposal

包含：

- proposalId/projectId/baseVersionId。
- template/update type。
- source material/job。
- validation summary。
- ordered change items。

Change item 包含：

- changeId。
- module type。
- create/update/archive/delete 等操作。
- target ID。
- semantic type。
- patch。
- evidence IDs。
- confidence/warnings。

## Review Decision

每项状态：

- pending。
- accepted。
- rejected。

accepted 可附 edited patch 和 note。保存 edited patch 前重新校验：

- 字段类型和 allowlist。
- 对象归属。
- 证据。
- 日期。
- unit lifecycle。
- dependency DAG。

pending item 也可保存经重新校验的 edited patch，用于 AI 节点预览中的审核前修正；该动作不等于接受。后续接受继续使用 edited patch，驳回则清除 edited patch。

## Merge

前置条件：

- proposal 存在且属于 project。
- base version 仍可解释。
- 所有应用项已决定。
- 当前 draft 和 project 指针未发生不允许冲突。

事务：

1. 复制当前 draft 为 candidate。
2. 依序应用 accepted item。
3. 校验完整 project graph。
4. 记录 merge。
5. 切换 draft pointer。
6. 写 audit。

任一步失败回滚全部事务。

## Version Apply

操作规则：

- create：目标 ID 不存在。
- update：目标存在且字段受模板允许。
- archive/exit：保存生命周期，不物理删除历史。
- delete：仅允许模板和领域明确允许的低风险对象；单元禁止物理删除。
- 关系变化：最终 DAG 和引用完整。

路线图交互删除规则：

- 正式路线图删除创建 `interaction` proposal，必须引用项目内 ready 材料证据并输入前端强确认短语。
- task 删除若仍被 parent、dependency 或 workstream 引用，校验或合并失败。
- stage 删除若仍被 closure 引用，校验失败。
- AI 节点预览的“删除本次预览卡片”只把对应 review item 设为 rejected，不转换成对发布节点的 delete operation。

## Release Preview

服务端比较 current published 与 draft：

- changed modules。
- create/update/archive/delete counts。
- graph/schema checks。
- pending reviews。
- blocking warnings。
- current/next version metadata。

preview 只读，不修改版本。

## Node Preview Projection

产品层将 validated `ChangeProposal` 表达为“AI 生成项目节点预览”：

- 当前 published graph 是唯一投影基准。
- 无审核决定时，全部待决定 change 进入预览。
- 存在审核决定时，pending 与 accepted 进入预览，rejected 退出；accepted 的 edited patch 优先。
- pending 或 accepted 存在 edited patch 时，投影均优先使用 edited patch。
- 投影在内存副本中应用 create/update/delete，再调用固定 roadmap loader。
- 响应标记 added/modified/removed 和 pending/accepted/rejected 数量。
- 预览 API 不创建版本、不切换指针、不写审核决定或审计事实。

该投影只回答“按当前选择应用后会看到什么”，不代表已经合并或发布。

## Card Edit Commands

- `interaction` 来源：主路线图卡片编辑/删除，锁定当前 published，保存为新 pending proposal。
- `review preview edit` 来源：只允许修改当前 proposal 中指定 change item 的 allowlist patch，保持原 decision 状态并重算投影。
- preview remove：强确认后把当前 change item 驳回；不删除 change/audit 历史。
- 两种命令都按 projectId、角色、CSRF、Schema、日期、证据和图关系失败关闭。

## Publish

前置条件：

- principal 有 publish capability。
- CSRF 有效。
- preview 无 blocking。
- client expected version 与当前一致。

事务：

1. 从 draft 创建新 published。
2. 从新 published 创建新 draft baseline。
3. 更新 project pointers。
4. 记录 publication event。
5. 写 audit。

## Rollback

- 只接受当前 publication event 的 direct predecessor。
- 创建新的发布状态和 draft baseline。
- 不删除失败版本或历史 event。

## Audit and Observability

review、merge、publish、rollback 均记录 user/project/target/time。未知异常携带 requestId，并由 Operations 保存脱敏诊断。

## UI Evolution

Phase 11 计划把审核重排为业务变化优先，并提供“预览并发布”UI coordinator。coordinator 仍调用上述独立能力，必须处理“merge 成功但 publish 失败”的恢复状态。

## Verification

- 单项、模块级、编辑后接受和驳回。
- 非法 patch 不留下 review。
- 合并故障注入不切 draft。
- 发布检查阻断。
- publish/rollback 指针与事件事务。
- stale/cross-project/role/CSRF。
- 节点预览投影不写版本；pending/accepted/rejected 与 edited patch 组合正确。
- 完整材料→proposal→review→merge→publish E2E。
