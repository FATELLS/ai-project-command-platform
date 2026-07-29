# Design S-04：Materials & Evidence

状态：`implemented baseline`

## Material Lifecycle

```text
uploaded
  → queued
  → processing
  → ready | dependency_missing | failed
  → retry may return to queued
```

UI 可把内部状态映射为“处理中、已处理完成、缺少必要信息、处理失败”，但数据库状态保持稳定。

## Ingest Gate

校验：

- 用户和项目 edit capability。
- 项目与单文件容量。
- 内容长度和流式读取上限。
- MIME、扩展名和魔数。
- 压缩路径、展开大小和文件数量。
- digest 重复。
- 用户/项目时间窗口频率。
- 并发上传锁。
- 可选扫描器 fail-closed 策略。

失败在创建孤儿对象前终止，或执行明确清理。

项目创建材料复用扩展名、MIME 与魔数校验。文本型创建材料还需通过最低业务完整性校验：存在明确项目名称或 Markdown 标题，并存在项目目标。该校验只决定能否进入可编辑骨架确认，不直接创建项目。

## Downloadable Template Catalog

统一目录提供六种 Markdown 模板：

- 会议纪要。
- 项目计划。
- 进展汇报。
- 指标数据。
- 成果归档。
- 项目创建材料。

项目创建入口直接提供创建模板；总览附近的材料模板入口、材料台账、上传/人工录入、单项/批量生成和材料详情复用同一目录。项目更新路线图不重复模板控制台。下载是本地 Blob 行为，不调用 mutation API，也不改变当前筛选、弹窗或路由状态。

## Storage Layout

服务端生成路径，至少按 project/material 隔离：

```text
objects/{projectId}/{materialId}/original
artifacts/{projectId}/{materialId}/{generation}/...
```

数据库记录 object key、digest、bytes、content type 和状态。客户端不得提交本地绝对路径。

## Worker and Processing

- material job 领取 lease。
- 根据文件类型选择 extractor。
- 设置超时、内存/输出和子进程限制。
- 成功后在事务中保存 artifact、evidence blocks、active generation 和 readiness。
- 失败记录安全错误码，不把原始材料内容写入错误日志。

## Extractors

- text/CSV/JSON/YAML：有界文本解析。
- DOCX/PPTX/XLSX：受限 OOXML/ZIP 解析，保留段、页、幻灯片、工作表和单元格定位。
- PDF：受限本地文本提取，必要时使用 vision adapter。
- image：受限 OCR 或 vision adapter，保留 bbox。

extractor 输出统一：

- ordinal。
- kind。
- location。
- text/summary。
- content hash。
- optional bbox/table metadata。

## Evidence Generations

- 每次成功处理产生 extraction version。
- `active_extraction_version` 指向当前代际。
- 旧代际可用于解释已锁定 generation job，但不进入新的默认检索。
- FTS 与 evidence insert/update/delete 同步。

## Readiness

输入：

- 当前 active evidence。
- update template。
- 模板要求的字段和高影响规则。

输出：

- ready / warning / blocked。
- missing required items。
- recommended additions。
- createdBy/createdAt。
- evidence generation 和模板版本。

生成任务复制 readiness 快照，后续重处理不改历史任务语义。

## Service API

- list/detail/capabilities。
- manual/upload。
- update template。
- retry processing。
- evidence list/get/search。

旧 qa/generation grant API 可为兼容保留，但普通 UI 不提供授权工作流。

## User-facing Failure Contract

- 空文件、未知格式和声明/签名不一致在持久化前拒绝。
- digest 重复只保留首次成功材料。
- 文本创建材料缺少项目名称或目标时给出补充项和模板入口，不打开骨架确认。
- 材料与阶段用途不匹配时保留已接收材料，在 readiness 中显示缺失项并阻止生成。
- 失败反馈留在当前 dialog/sheet，既有项目、材料、任务和 published 不变。

## Verification

- 文件类型、魔数、重复、容量、并发、zip traversal/bomb。
- 每类 extractor 的定位和摘要。
- worker lease、恢复、retry 和失败清理。
- evidence generation/current 过滤。
- readiness ready/warning/blocked。
- 跨项目材料和 evidence 404。
- 创建与更新异常 UI：空文件、伪装类型、未知格式、重复、缺少创建要素、阶段用途不匹配。
- 模板目录在创建及全部项目更新入口一致可用，且合法模板材料仍可进入骨架确认。
