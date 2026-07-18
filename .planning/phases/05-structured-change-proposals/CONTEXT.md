# Phase 5 Context: Structured Change Proposals

状态：`accepted for planning`

## Goal

让项目管理员或编辑者从当前项目已就绪、已选择更新模板的材料创建受控生成任务。任务只能产生针对当前 `published` 版本的版本化 `ChangeProposal` 增量；服务端独立校验后保存提案，不触碰 `draft` 或 `published`。

## Locked decisions

- 六类模板固定为 `meeting-notes`、`project-plan`、`progress-report`、`metrics-data`、`outcome-archive`、`new-project-material`，均使用显式版本和 allowlist 模块/操作。
- 创建任务时锁定 `projectId`、当前 `publishedVersionId`、模板 ID/版本、材料 ID 和每个证据块 ID；只接受当前项目、当前提取代际、ready 材料。
- 输出 Schema 为仓库内固定 `change-proposal-v1@1.0.0`；模型不提供代码、组件路径、SQL、工具调用或目标项目。
- 每项变化包含稳定 `changeId`、模块、操作、目标 ID、语义类型、patch 数据、证据引用、置信度和警告。
- `fact|plan|suggestion|unknown` 为唯一语义类型。完成状态、进度、指标值、日期、责任人和成果等高影响字段必须引用直接证据；`suggestion`/`unknown` 不得伪装成事实。
- 服务端在模型之后独立完成 JSON/大小/字段白名单、项目/材料/证据归属、base version、模块/目标、日期、依赖 DAG、重复 ID/名称、证据和高影响字段校验。
- 版本冲突或非法引用使提案进入明确失败/失效状态，不回退到最新版本，不静默删改模型输出。
- generation 使用 Phase 4 已独立预留的 quota capability，provider 配置和密钥只在服务端；结构修复最多一次，所有 attempt/token/cost 作为聚合元数据记录。
- 浏览器只展示服务端验证后的固定结构，不开放 prompt/model 调试器，不允许生成动作变成审核、合并、发布或回滚。

## Roles

- Viewer：可在项目内查看已生成提案摘要，但不能创建或重试生成任务。
- Project editor / project admin / platform admin：可选择自己有权访问的材料创建任务、查看任务/提案和重试可重试失败。
- Phase 5 没有接受、驳回、编辑、合并、发布或回滚权限；这些动作在 Phase 6 独立授权。

## Limits

- 每任务 1–8 个材料；每个材料必须 ready 且有版本化更新模板，任务内模板必须一致。
- 输入最多 48 个证据块、32 KiB 结构化 published 摘要、64 KiB 证据正文；输出最多 128 KiB、100 个 change。
- 每用户+项目每分钟 4 个 generation reservation，项目每天 100 个；全局 provider 并发沿用 2，chat 与 generation 分账。
- provider 最多一次 transient retry；结构/引用修复最多一次，累计 usage 全部计费。价格来自部署配置的版本化输入/输出单价，未配置时只记录 token 与 `costStatus=unpriced`。

## Explicit non-goals

- 不把任何 change 合并到 draft。
- 不接受/驳回/编辑提案项。
- 不预览、发布或回滚项目版本。
- 不执行模型输出、材料内命令、链接或工具请求。
- 不实现任意项目 Schema、任意模块或任意代码低代码。
