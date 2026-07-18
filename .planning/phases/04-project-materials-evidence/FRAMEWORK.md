# Phase 4 AI / RAG 框架选择

状态：`recommended`

日期：2026-07-18

范围：Phase 4 项目材料、证据检索与项目内只读问答。本文不提前设计 Phase 5 的 `ChangeProposal` 生成，也不授权 AI 写入 `draft` / `published` 或调用工具。

```yaml
FRAMEWORK_RECOMMENDATION:
  primary: "Repository-local deterministic 2-step RAG v1（无外部 AI/RAG 框架）"
  rationale: "项目已锁定原生 Node.js 24.15+、node:sqlite、ES modules 和单服务器 SQLite，package.json 当前没有运行依赖；Phase 4 又是检索后单次生成的只读问答，不需要 agent、工作流图、工具调用或框架级状态机。仓库内 EvidenceRetriever + PromptBuilder + ChatProvider 三个窄接口即可继承稳定 Xugu 应用的本地检索/直接 HTTP 调用语义，同时把 projectId、发布态、材料授权和来源引用做成服务端确定性门槛。"
  alternative: "LlamaIndex.TS 0.12.1"
  alternative_reason: "仅当参考集证明 SQLite 词法检索无法达到召回门槛，且确实需要 embedding、混合检索、reranker 或多 retriever 编排时采用；不要为了 Phase 4 基础问答预先引入。"
  system_type: "RAG"
  model_provider: "Model-agnostic（首个迁移适配器为 OpenAI-compatible / GLM）"
  eval_concerns: "跨项目隔离，检索 precision/recall，context faithfulness，引用有效性与来源定位，证据不足时拒答，published-only 正确性，无写入/工具副作用，provider 故障隔离，延迟与上下文预算"
  hard_constraints:
    - "TypeScript/JavaScript only；不增加 Python 服务"
    - "Node.js 单进程 + SQLite；本机或局域网部署"
    - "不增加向量数据库、队列、agent runtime 或外部检索基础设施"
    - "问答必须先按 projectId 和成员权限隔离，只读 published 与明确授权材料"
    - "模型不得决定检索范围、执行工具、修改数据或绕过引用校验"
    - "无 API key 时平台、材料处理和确定性测试仍可正常运行"
  existing_ecosystem: "Node.js >=24.15, native ESM, node:sqlite DatabaseSync/WAL/transactions, SQLite FTS5 available (including trigram tokenizer), node:test, repository/service/API boundaries, zero npm runtime dependencies; legacy Xugu Q&A uses deterministic local relevance selection plus direct OpenAI-compatible GLM HTTP"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FRAMEWORK RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Primary Pick: Repository-local deterministic 2-step RAG v1
  使用 SQLite 中的项目隔离证据块做确定性检索，再进行最多一次受控模型调用。它与现有零依赖 Node 架构、单机 SQLite 部署和只读安全边界完全对齐，也保留了将来替换模型或检索器的接口。

◆ Alternative: LlamaIndex.TS 0.12.1
  只有评估数据证明需要语义/混合检索与 reranker 时再引入，并通过现有 retriever/provider ports 接入，避免改写业务与权限边界。

◆ System Type Classified: RAG
◆ Key Eval Dimensions: 项目隔离、检索 precision/recall、上下文忠实度、引用有效性、证据不足拒答、只读与故障隔离

## 排名结论

1. **Repository-local deterministic 2-step RAG v1 — 采用。** 唯一完全满足当前硬约束的方案。
2. **LlamaIndex.TS 0.12.1 — 条件后备。** RAG 能力最匹配，但目前会增加不必要的运行依赖与抽象；仅由检索评估失败触发。
3. **LangChain.js 1.5.3 — 远期后备。** 只在未来模型/数据源集成广度成为首要需求时考虑；Phase 4 的线性只读问答采用它属于过度抽象，且不得启用 agent/tool 路径。

CrewAI、Haystack、Google ADK 和 AG2 因 Python/Java/.NET 或多 agent 取向被硬约束排除；LangGraph、OpenAI Agents SDK 和 Claude Agent SDK 因本阶段没有状态化 agent、工具执行或 provider 锁定需求被排除。LlamaIndex.TS 与 LangChain.js 仅作为放宽“无新增运行依赖”后的后备，不是本阶段安装项。

## 实现边界

采用三个仓库内接口，不建立通用 agent 抽象：

```text
authorized projectId + published version + question
                    │
                    ▼
EvidenceRetriever.search({ projectId, versionId, question, limit })
  └─ SQLite FTS5 trigram / bm25；JOIN 后强制 projectId、ready、chatEnabled
                    │ stable score + stable tie-break
                    ▼
PromptBuilder.build({ publishedFacts, evidenceChunks, recentHistory })
  └─ 限额、来源 ID、定位信息；材料内指令一律作为数据
                    │
                    ▼
ChatProvider.generate(request, { signal })
  └─ disabled | fake(test only) | openai-compatible(GLM first)
                    │
                    ▼
server citation allowlist + response schema validation
                    │
                    ▼
read-only answer + verified evidence locators
```

- 证据真相保存在规范化 `materials` / `evidence_chunks` 等实体中；FTS 只是可重建索引，不成为授权或来源真相。
- 检索 SQL 必须在同一次查询中约束授权项目、材料问答授权和处理状态，再排序取 top-k；禁止先做全库 top-k 后再过滤项目。
- 排序使用固定算法、固定字段权重、固定 `limit` 和稳定 tie-break；同一数据库快照与问题应返回同一 evidence ID 序列。
- 发布态项目事实通过现有 repository/module loader 读取，不能把 `draft` 或其他项目快照放进上下文。
- 模型只能引用本次检索返回的 opaque evidence ID；服务端将 ID allowlist 映射回文件与页/段/表/图片定位。未知引用必须丢弃并转为“资料不足”，不能像旧实现一样无条件回退到第一个来源。
- Phase 4 不需要 embedding。先用中文可工作的 FTS5 `trigram` + `bm25()` 建立可解释基线；只有离线参考集证明 recall 不足，才启动 LlamaIndex.TS / embedding 方案 spike。
- provider adapter 只暴露受控文本生成，不暴露 tool/function calling、文件、Shell、SQL、网络浏览或项目写接口。

## 无 API key 的正常运行契约

- 默认提供 `disabled` provider；缺少 key 或 model 时服务必须正常启动，登录、项目浏览、材料上传/提取、证据建索引和非 AI 验证均可运行。
- 能力状态应明确返回 `configured: false`。真正提交问答时在任何外部网络调用前返回稳定的 `503 AI_PROVIDER_DISABLED`，且不得泄露配置路径、key hint 或内部堆栈。
- `fake` provider 只由测试依赖注入启用，按固定输入返回固定结构，用于覆盖 projectId 隔离、top-k、上下文、引用过滤、超时/失败和并发限制；测试及 `npm run verify` 不需要真实密钥或公网。
- `openai-compatible` 是最小生产适配器，通过原生 `fetch` 调用受控 `/chat/completions` 风格端点，首个迁移目标为 GLM；base URL、model 和 key 只在服务端解析，key 不进入浏览器、日志、Git、夹具或 API 响应。
- provider 超时、限流、无效输出或离线不得影响项目浏览、材料台账和检索索引；失败不写入项目版本、材料授权或未来提案层。

## 升级触发器

保持当前方案，直到出现以下任一经评估确认的事实：

- 按项目分层的参考集上，FTS5 基线持续低于约定 recall@k / citation coverage 门槛；
- 需要 embedding + 词法融合、cross-encoder reranking 或多数据源 retriever 编排；
- 单机 SQLite 的材料规模或查询延迟超过 NFR 预算；
- 多个 provider/embedding/vector store 的适配代码开始重复且框架能显著减少已测复杂度。

触发后先做 LlamaIndex.TS 隔离 spike，并要求它复用相同 `EvidenceRetriever` / `ChatProvider` 契约、项目权限和引用校验；不得把框架对象扩散到 HTTP、repository 或模块渲染层。

## 依据

- 项目约束：`AGENTS.md`、`AI-SPEC.md`、`.planning/REQUIREMENTS.md`、`.planning/ROADMAP.md`、`.planning/DECISIONS.md`。
- 现有架构：`package.json`、`src/db/database.mjs`、`src/http/app.mjs`、`src/modules/module-service.mjs`、Phase 3 `CONTEXT.md` / `RESEARCH.md` / `VERIFICATION.md`。
- 迁移基线：只读 Xugu v4.2 `AI-SPEC.md` 与 `server.mjs`；其问答已采用本地相关度选择、最多四份材料、发布态上下文和直接 OpenAI-compatible GLM 请求，没有外部框架。
- 本机验证：当前 Node v25.9.0 的内置 SQLite 编译启用 FTS5，`tokenize='trigram'` 可命中中文子串并由 `bm25()` 排序；实现仍以项目最低 Node 24.15+ 的统一验证为准。
- 官方参考：[Node.js `node:sqlite` 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[LlamaIndex.TS QueryEngine](https://ts.llamaindex.ai/docs/llamaindex/modules/rag/query_engines)、[LangChain JavaScript Retrieval](https://docs.langchain.com/oss/javascript/langchain/retrieval)。

版本说明：`llamaindex@0.12.1` 与 `langchain@1.5.3` 是 2026-07-18 查询 npm registry 得到的候选版本，仅用于决策记录，当前不安装；若升级触发器成立，spike 必须重新核验版本、许可证、传递依赖和锁文件。
