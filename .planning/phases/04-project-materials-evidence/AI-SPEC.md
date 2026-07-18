# Phase 4 AI Design Contract

状态：`accepted`
版本：`rag-v1@1.0.0`

## 系统边界

Phase 4 的 AI 只回答当前项目内问题。输入为用户问题、当前 `published` 的受控事实摘要和当前项目已授权、已就绪的证据块；输出为带引用的只读回答。它没有工具、仓储、SQL、文件路径、浏览器、网络浏览或项目写接口，也不得创建 `ChangeProposal`。

```text
authenticated request(projectId, question)
  -> authorize project + chat capability + reserve quota
  -> FTS5 search(projectId, ready, chatEnabled, topK=8)
  -> zero/weak evidence => deterministic insufficiency, no provider call
  -> bounded context with opaque evidence IDs
  -> one OpenAI-compatible call, tools disabled
  -> validate schema and citation allowlist
  -> cited response or deterministic failure
```

## 结构化输出

```json
{
  "schemaVersion": "project-answer-v1",
  "answer": "string",
  "citations": [{ "evidenceId": "opaque-id", "claim": "string" }],
  "caveat": "string",
  "followUps": ["string"]
}
```

- `answer` 1–4,000 字符；`citations` 最多 8 个且每个 ID 必须来自本次检索 allowlist；`followUps` 最多 3 个。
- 任何事实性回答至少一个有效引用；未知 ID、空证据、结构错误、tool call、截断或第二次无效输出都失败关闭。
- 证据不足核心文案固定为“现有资料不足以回答这个问题。”，不得让模型自由补充项目事实。

## 检索与上下文

- SQLite FTS5 查询和授权联表必须在同一 SQL 中约束 `projectId`、`ready`、`chat_enabled`；稳定 tie-break 使用 evidence ID。
- 证据块保留来源标题、locator、摘要、正文、抽取时间和材料授权版本；上下文最多 8 块、约 7,000 输入 tokens。
- 系统提示与 `<published_state>`、`<untrusted_evidence>` 分层。材料里的指令没有权威，只是待引用数据。
- 问答历史不自动写回项目或长期记忆；项目切换/登出即清空浏览器会话上下文。

## Provider 契约

- `disabled` 为默认实现，调用返回 `AI_PROVIDER_DISABLED`/HTTP 503，但服务器、上传、提取、索引和检索正常。
- `fake` 只允许测试依赖注入；生产 factory 不接受环境变量启用 fake。
- OpenAI-compatible adapter 使用 Node `fetch`、HTTPS allowlist、45 秒 deadline、最多一次有限重试、响应体 256 KiB 上限、最多 1,200 输出 tokens；禁用 tools/function calling。
- 配置、密钥、完整 prompt/问题/回答/材料正文、文件路径和上游正文不得返回浏览器或写入日志。

## 权限、配额与失败隔离

- 所有请求重新授权 principal 与 route `projectId`；读 published 和问答是独立 capability，原件下载、材料管理与 Q&A 授权权限更高且彼此独立。
- chat 与 Phase 5 generation 使用不同 quota kind；每用户/项目分钟、项目/平台日预算与全局并发在 provider 调用前原子预留。
- provider、引用验证或配额失败不得写 `draft`/`published`、改变材料授权、删除证据或阻塞现有项目浏览。

## 完成门槛

执行并通过 `EVAL.md` 的安全、隔离、检索、忠实、引用、拒答、prompt injection、provider 故障、配额、日志和三视口矩阵。`npm run verify` 不需要真实 API key 或公网。
