# Phase 4：项目材料与证据层 - Research

**Researched:** 2026-07-18
**Domain:** 安全文件摄入、Office/PDF/OCR 提取、可定位证据、项目隔离检索与只读问答
**Confidence:** HIGH

## User Constraints

### Locked Decisions

- 平台管理多个项目，每份材料、每个证据块、每次问答与配额记录都必须按 `projectId` 隔离；客户端给出的资源 ID 不能替代服务端授权与归属校验。[VERIFIED: `AGENTS.md`, MAT-01, CHAT-01]
- LLM 只能消费当前项目已发布状态和已授权材料，不能生成/执行页面代码，不能写 `draft` 或 `published`，也不能把材料中的指令当成工具调用。[VERIFIED: `AGENTS.md`, `AI-SPEC.md`, AIU-07]
- 原件、预处理产物、证据、问答授权和项目发布状态必须分离；运行数据库、上传原件、预处理材料、日志和临时交付物不得进入 Git。[VERIFIED: `AGENTS.md`, MAT-05]
- 首版为 Node.js 24.15+、内置 `node:sqlite`、单服务器本机或局域网部署；不引入微服务或客户端文件解析执行链。[VERIFIED: D-005, D-007, NFR-01]
- `xugu-agentic-group` 保持稳定 ID 与现有发布事实；参考应用只读。Phase 4 可迁移其材料/只读问答安全契约，但不能复用其单 JSON、单项目授权模型。[VERIFIED: D-001, D-006, reference Xugu `docs/ARCHITECTURE.md`]

### Codex's Discretion

- 在上述边界内确定材料实体、存储布局、提取器、证据定位、门阀默认值、项目内检索、只读问答接口与测试矩阵。[VERIFIED: Phase 4 roadmap scope]
- 用户无人值守；采用下文的保守默认，并把可运营参数集中为服务端配置，不等待交互确认。[VERIFIED: task instruction]

### Deferred Ideas (OUT OF SCOPE)

- `ChangeProposal` 生成、结构化变更校验属于 Phase 5；Phase 4 只允许选择/保存更新模板意图，不创建生成任务。[VERIFIED: `.planning/ROADMAP.md`]
- 差异审核、草稿合并、发布、回滚和完整权限运营属于 Phase 6。[VERIFIED: `.planning/ROADMAP.md`]
- 任意自定义代码模块、客户端执行材料内容、多机队列、外部公共注册不在首版范围。[VERIFIED: `.planning/PROJECT.md`]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MAT-01 | 每份材料归属一个项目 | 复合外键、仓储强制 `projectId`、存储键和重复判定均项目级。 |
| MAT-02 | 支持纪要、DOCX、PPTX、XLSX、PDF、文本、图片和人工表单 | 格式矩阵给出服务端提取器、定位和降级路径。 |
| MAT-03 | 可定位证据块 | `evidence_blocks` 保留页/段/表/幻灯片/工作表/坐标/字符范围。 |
| MAT-04 | 容量、类型、签名、摘要、频率、并发、解包门阀 | 两阶段摄入状态机与保守默认值。 |
| MAT-05 | 原件、预处理、问答授权和发布状态分离 | 独立 artifact、evidence、grant 实体；材料永不挂到版本层。 |
| CHAT-01 | 问答带 `projectId`，只读发布态与授权材料 | 服务端构造上下文；发布图和证据查询都在授权后的项目边界内。 |
| CHAT-02 | 回答引用来源，资料缺失不补造 | 返回结构化 citation，零检索结果走确定性“不足”响应。 |
| CHAT-03 | 问答与更新生成独立权限和配额 | capability 分离的授权与 usage ledger；Phase 4 只启用 `chat`. |
| NFR-01 | 单服务器本机/局域网部署 | SQLite + 文件系统 + 进程内租约队列；启动时恢复中断任务。 |

[VERIFIED: `.planning/REQUIREMENTS.md`]

## Project Constraints (from AGENTS.md)

- 不得宣称未实现的材料、AI 更新或发布闭环已经完成。[VERIFIED: `AGENTS.md`]
- 固定模块负责渲染；文件内容、提取文本和模型输出只能作为文本/结构化数据，不能选择组件路径或注入 HTML/CSS/JavaScript。[VERIFIED: `AGENTS.md`]
- 项目、材料、问答、生成任务和权限按 `projectId` 隔离。[VERIFIED: `AGENTS.md`]
- 实现后执行 `npm run verify` 以及风险相称的 API、浏览器、迁移与安全验证，并更新 RESULT/PROCESS/STATE/HANDOFF；架构边界变化时更新 DECISIONS。[VERIFIED: `AGENTS.md`]
- 不提交 API Key、运行数据库、上传原件、预处理材料、日志和临时交付物；保护他人未提交修改。[VERIFIED: `AGENTS.md`]

## Summary

现有平台已经具备正确的认证、CSRF、项目角色、统一 404、SQLite 迁移/事务和九类固定模块边界，但 `materials` loader 仍固定返回 Phase 4 空状态，HTTP 层只支持 64 KiB JSON body，数据库没有材料/证据/问答实体。[VERIFIED: `src/http/app.mjs`, `src/modules/loaders.mjs`, migrations 001–003] 参考 Xugu 应用已有可复用的产品门槛：200 MB 单文件、100 份/300 MB、6 次/分钟、SHA-256 去重、80 MB/2,000 项解包、显式加入问答、只读回答与来源；其单 JSON 与路径式存储不能直接迁入多项目平台。[VERIFIED: reference Xugu `AI-SPEC.md`, `docs/ARCHITECTURE.md`]

本阶段应实现“摄入”和“理解”两条明确分开的状态机：请求流只进入服务端 staging、增量计数与摘要；通过授权、容量、扩展名/MIME/签名、容器清单、重复和并发门阀后才登记材料并排队。提取器在有限并发、超时和可恢复租约下生成项目级证据块；原件和处理产物在 webroot 外分目录保存，SQLite 只保存实体、定位和索引。[CITED: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html] 浏览器只上传字节和显示服务端 DTO，不执行 Office/PDF 解析、OCR、RAG 或文件内容。[VERIFIED: MOD-02 and architecture recommendation]

只读问答应由服务端重新检索当前项目的 `published` 版本与 `qa_enabled` 证据，返回稳定 citation DTO。SQLite FTS5 可在当前 Node 内置 SQLite 3.53.0 中使用，`trigram` 对三字符以上中文片段有效；两字符查询需项目范围内的有界 LIKE/标题回退。[VERIFIED: local `node:sqlite` probe; CITED: https://www.sqlite.org/fts5.html] 材料中的“忽略规则、调用工具、读取其他项目”等文本始终作为不可信证据，不获得执行能力。[CITED: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html]

**Primary recommendation:** 新增 migration 004、`materials/` 服务/仓储/提取器目录和项目级 Materials API；采用 `busboy + file-type + yauzl + saxes + ExcelJS`，PDF/OCR 通过受限的 Poppler/Tesseract 子进程；先完成确定性摄入、证据与检索，再接无工具、只读的模型适配器。[VERIFIED: official package docs, local environment, architecture recommendation]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| 上传授权、门阀、摘要、配额 | API / Backend | Database / Storage | 安全判断必须在服务端，客户端只提供字节和展示名称。 |
| 原件/预处理文件 | Database / Storage | API / Backend | 文件系统保存不可执行 blob；SQLite 保存状态、归属和 storage key。 |
| Office/PDF/OCR 提取 | API / Backend | OS Process Boundary | 解析不可信输入需要超时、资源上限和无 shell 的子进程边界。 |
| 证据定位/全文索引 | Database / Storage | API / Backend | 块、定位和 FTS 行在同一事务更新，所有查询绑定项目。 |
| 材料台账/模板选择 UI | Browser / Client | API / Backend | 固定 renderer 展示服务端 DTO；不读取本地文件内容做解析。 |
| 只读 RAG/问答 | API / Backend | Database / Storage | 服务端决定发布态、授权证据、引用、配额和模型上下文。 |
| 项目隔离 | API / Backend | Database / Storage | 授权先于查找，仓储再用复合键作防御纵深。 |

[VERIFIED: current architecture and OWASP multi-tenant guidance; CITED: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard Here |
|---|---:|---|---|
| Node.js | `>=24.15` | HTTP、流、worker/子进程、测试 | 项目锁定；当前 v25.9.0。[VERIFIED: `package.json`, local probe] |
| `node:sqlite` | built-in; SQLite 3.53.0 observed | 实体、事务、FTS5、租约/配额 | D-007 锁定；本机确认 `ENABLE_FTS5`。[VERIFIED: local probe] |
| `busboy` | 1.6.0 | 流式 multipart 解析 | 官方 API 支持 file/parts/header/fileSize limits，且到达限制会标记 truncated。[CITED: https://github.com/mscdex/busboy] |
| `file-type` | 22.0.1 | magic-number 初筛 | 官方支持 buffer/file/stream 检测；结果只是门阀一层，不替代容器校验。[CITED: https://github.com/sindresorhus/file-type] |
| `yauzl` | 3.4.0 | OOXML ZIP 中央目录/entry 流 | 使用 `lazyEntries` 与 `validateEntrySizes`，不整包解压到磁盘。[CITED: https://github.com/thejoshwolfe/yauzl] |
| `saxes` | 6.0.0 | 流式 XML 解析 | 解析 OOXML parts 与 Poppler bbox XHTML，避免正则/XML 自研。[VERIFIED: npm registry + package legitimacy OK; official repo https://github.com/lddubeau/saxes] |
| `exceljs` | 4.4.0 | XLSX workbook/worksheet/row/cell 提取 | 官方对象模型可保留 sheet、row、column/address 位置。[CITED: https://github.com/exceljs/exceljs] |

### Supporting

| Tool | Version | Purpose | When to Use |
|---|---:|---|---|
| Poppler `pdfinfo`/`pdftotext`/`pdftoppm` | 26.04.0 installed | PDF 元信息、`-bbox-layout` 文本位置、扫描页栅格化 | PDF 主路径与 OCR 降级。[CITED: https://manpages.debian.org/bookworm/poppler-utils/pdftotext.1.en.html] |
| Tesseract | 5.5.2 installed | 图片/扫描页 OCR TSV | 只有图像或 PDF 无足够文本层时；TSV/iterator 提供词级 box 与 confidence。[CITED: https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html] |
| `node:test` | built-in | 单元、迁移、API、隔离、资源门阀 | 延续现有 55 项测试体系。[VERIFIED: `package.json`, tests] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| 受控 OOXML adapter | `mammoth`/`officeparser` 全文转换 | Mammoth 官方明确不清洗输出且复杂文档有结构损失，raw text 不能满足页/段/表定位；officeparser 当前版本被 legitimacy seam 标 SUS。[CITED: https://github.com/mwilliamson/mammoth.js] |
| Poppler bbox + OCR | `pdfjs-dist` | 官方可用，但当前 registry gate 对最新包给出 SUS；本机已有 Poppler，且 bbox-layout 直接提供块/行/词坐标。[VERIFIED: package gate; CITED: https://mozilla.github.io/pdf.js/api/] |
| SQLite FTS5 | 外部向量数据库 | 首版检索规模和单服务器边界不需要新服务；FTS 与证据事务同库并容易做项目过滤。[VERIFIED: NFR-01, D-005; CITED: https://www.sqlite.org/fts5.html] |
| 服务端解析 | 浏览器解析/上传后客户端 OCR | 会使授权、资源限制、版本一致性和审计依赖不可信客户端，违反固定组件/服务端边界。[VERIFIED: AGENTS, MOD-02] |

**Installation:**

```bash
npm install busboy@1.6.0 file-type@22.0.1 yauzl@3.4.0 saxes@6.0.0 exceljs@4.4.0
```

[VERIFIED: npm registry on 2026-07-18]

## Package Legitimacy Audit

| Package | Registry | Publish/Activity Signal | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---:|---|---|---|
| busboy | npm | established; current 1.6.0 | 27.3M/wk | github.com/mscdex/busboy | OK | Approved |
| file-type | npm | current 22.0.1 | 47.9M/wk | github.com/sindresorhus/file-type | OK | Approved |
| yauzl | npm | current 3.4.0 | 41.9M/wk | github.com/thejoshwolfe/yauzl | OK | Approved |
| saxes | npm | current 6.0.0 | 72.2M/wk | github.com/lddubeau/saxes | OK | Approved |
| exceljs | npm | current 4.4.0 | 10.3M/wk | github.com/exceljs/exceljs | OK | Approved |
| pdfjs-dist | npm | latest recently published | 18.3M/wk | github.com/mozilla/pdf.js | SUS | Not selected; Poppler used |
| officeparser | npm | latest 2026-07-12 | 551K/wk | github.com/harshankur/officeParser | SUS | Not selected |

[VERIFIED: `gsd-tools package-legitimacy check`, `npm view`; no selected package has `postinstall`]

**Packages removed due to SLOP verdict:** none selected. A version-qualified seam lookup for `pdfjs-dist@5.4.624` mis-parsed as a package name and returned SLOP, so it was not used as a factual package verdict.[VERIFIED: local seam behavior]

**Packages flagged as suspicious [SUS]:** `pdfjs-dist`, `officeparser`; both removed from the recommended install set.[VERIFIED: package legitimacy gate]

## Architecture Patterns

### System Architecture Diagram

```text
Browser (fixed materials renderer)
  │ multipart bytes + project route + CSRF
  ▼
Project authorization ── deny/404 before resource lookup
  ▼
Upload gate
  ├─ request/header/parts/file-size timeout limits
  ├─ extension + declared MIME + magic + container shape
  ├─ streaming SHA-256 + per-project duplicate/capacity/rate/concurrency
  └─ OOXML ZIP entries/expanded bytes/path/ratio limits
  ▼
staging file outside webroot ──► project_materials + material_artifacts
  │                                  │
  └─ queued job / lease ─────────────┘
                    ▼
       isolated extractor adapter
       ├─ DOCX/PPTX: yauzl + saxes
       ├─ XLSX: preflight + ExcelJS
       ├─ PDF: pdfinfo/pdftotext bbox
       ├─ image/scan: Tesseract TSV
       └─ text/manual: decoder/schema
                    ▼
       evidence_blocks + FTS5 (same project transaction)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Materials ledger       Read-only chat retrieval
 fixed DTO/text          published snapshot + qa grants
                                ▼
                     answer + stable citations; no writes/tools
```

[VERIFIED: architecture recommendation derived from requirements and official security guidance]

### Recommended Project Structure

```text
src/
├── materials/
│   ├── policy.mjs              # limits, allowlists, capability defaults
│   ├── upload-service.mjs      # stream -> staging -> receipt/state machine
│   ├── material-service.mjs    # ledger, grants, template selection
│   ├── extraction-runner.mjs   # leases, timeouts, recovery
│   ├── evidence-service.mjs    # block normalization + FTS queries
│   └── extractors/
│       ├── ooxml-preflight.mjs
│       ├── docx.mjs
│       ├── pptx.mjs
│       ├── xlsx.mjs
│       ├── pdf.mjs
│       ├── image.mjs
│       └── text-form.mjs
├── repositories/material-repository.mjs
├── chat/
│   ├── retrieval-service.mjs
│   ├── chat-service.mjs
│   └── provider.mjs            # server-only, no tools
└── db/migrations/004_materials_evidence.sql
public/modules/renderers.js     # fixed materials-ledger renderer
test/material-*.test.mjs
```

[VERIFIED: current project layout; architecture recommendation]

### Pattern 1: Two-Phase Intake With Recoverable Receipt

**What:** Stream to a random staging name while counting bytes and hashing; only after all gates pass insert a `received` material/artifact/job receipt, atomically move within the same data filesystem, then mark `queued`. Startup reconciliation converts stale `received/processing` rows to queued/failed and deletes unreferenced staging files after a grace period.[VERIFIED: architecture recommendation; OWASP upload controls]

**Why:** SQLite and filesystem rename cannot share one ACID transaction. Explicit state plus reconciliation makes every crash point observable and testable instead of pretending cross-resource atomicity.[VERIFIED: architecture reasoning]

```js
// Source: architecture recommendation; all values are server-derived
await receiveUpload({ projectId, principal, request, policy });
// states: receiving -> received -> queued -> processing -> ready | rejected | failed
```

### Pattern 2: Project-Scoped Repository by Construction

Every material/evidence/artifact lookup takes `(projectId, resourceId)` and joins through project membership; no public repository method accepts `materialId` alone. Composite foreign keys require `UNIQUE(project_id, id)` on parents. Unauthorized, unknown and cross-project IDs return the same 404.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html]

```sql
SELECT b.*
FROM evidence_blocks b
JOIN project_materials m
  ON m.project_id = b.project_id AND m.id = b.material_id
WHERE b.project_id = ? AND b.id = ?;
```

### Pattern 3: Evidence Is Immutable Per Extraction Version

Do not edit blocks in place. An extraction run writes a new `extraction_version`, validates count/size/locations, swaps the material's active extraction pointer in one transaction, then removes/archives the old FTS rows. Citations contain `materialId`, `evidenceBlockId`, extraction version and location, so a later reprocess cannot silently change what a citation meant.[VERIFIED: MAT-03/NFR-04 architecture recommendation]

### Pattern 4: Retrieval Before Generation, Always on the Server

The chat route derives project membership from the authenticated session, loads that project's published graph, retrieves only ready blocks with an active Q&A grant, enforces a context byte/token ceiling, then calls a provider with tools/function calling disabled. The model never selects project, files, SQL, URLs or actions. A zero-result/low-evidence case returns a server-authored “当前资料未提供” response without a model call.[VERIFIED: CHAT-01–03, reference Xugu `AI-SPEC.md`; CITED: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html]

### Anti-Patterns to Avoid

- **Trusting filename/MIME only:** both are attacker controlled; require allowlist, magic and format-specific shape checks.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html]
- **Unzipping OOXML to a directory:** exposes traversal/symlink/bomb risks; enumerate entries lazily and parse selected parts as streams.[CITED: https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/10-Business_Logic_Testing/09-Test_Upload_of_Malicious_Files.md]
- **Global `sha256 UNIQUE`:** leaks whether another project possesses a file and prevents legitimate same-content isolation; duplicate is `(project_id, sha256)`.[VERIFIED: MAT-01 architecture recommendation]
- **Material tied to published/draft version:** violates MAT-05 and makes upload equivalent to publishing; material is project-level, Q&A access is a separate grant.[VERIFIED: MAT-05]
- **HTML from converters:** evidence and summaries render through `textContent`; no converted HTML is stored as renderable UI.[VERIFIED: MOD-02; Mammoth security warning]
- **Processing in request handler:** large parse/OCR work must be leased and recoverable; request returns 202/status URL.[VERIFIED: NFR-01 availability recommendation]

## Data Model and Migration 004

Use new tables; do not change migrations 001–003.[VERIFIED: existing checksum invariant]

| Entity | Required Fields / Constraints | Responsibility |
|---|---|---|
| `project_materials` | `id`, `project_id`, `source_kind`, `display_name`, canonical extension/MIME, `sha256`, `byte_size`, status, active extraction version, created/updated/by; `UNIQUE(project_id,id)`, partial/normal unique `(project_id,sha256)` for non-rejected rows | Project-level ledger; no version pointer. |
| `material_artifacts` | `id`, `project_id`, `material_id`, kind=`original|extracted_text|ocr_tsv|thumbnail`, storage key, bytes, sha256, lifecycle status; composite FK | Separates original and derived runtime files. |
| `material_jobs` | project/material, kind, state, attempts, lease owner/expiry, timeout, error code, stats | Durable in-process queue and restart recovery. |
| `evidence_blocks` | project/material/extraction, ordinal, kind, `location_json`, text, summary, content hash, created_at; unique ordinal per extraction | Canonical citation unit. |
| `evidence_fts` | external-content FTS5 over text/summary/title; project ID unindexed but stored/filterable | Local lexical retrieval; triggers or explicit same-transaction writes keep it synchronized. |
| `material_qa_grants` | project/material, audience=`project_members|editors|disabled`, enabled/by/at; composite FK | Q&A authorization independent of processing/publishing. |
| `material_update_selections` | project/material, catalog ID/version, selected_by/at | Saves update intent only; no generation task in Phase 4. |
| `ai_usage_events` | project/user/capability=`chat|generation`, units, request hash, status, created_at | Separate permission/quota accounting; Phase 4 writes chat only. |

[VERIFIED: DATA-02, MAT-01–05, CHAT-03; schema recommendation]

FTS5 external-content tables require the application to keep the index consistent; use insert/update/delete triggers or explicit transaction logic and add a `rebuild` integrity test/repair command.[CITED: https://www.sqlite.org/fts5.html#external_content_table_pitfalls]

Phase 3 declared template manifests immutable. Migration 004 must add `campaign-map-v1@1.1.0` and `standard-project-v1@1.1.0` (or an equivalent explicit new version), allow `materials-ledger`, migrate project template pointers and both layer module configs without changing published/draft facts; never mutate `1.0.0` in place.[VERIFIED: D-013, NFR-04, Phase 3 verification]

## Upload Gate and Operational Defaults

| Gate | Default | Enforcement |
|---|---:|---|
| Single file | 200 MiB | `Content-Length` early reject plus streamed byte counter; chunked requests cannot bypass. |
| Per project | 100 active materials / 300 MiB stored artifacts | Check before intake and again transactionally before receipt commit. |
| Upload rate | 6 attempts/min per source + user + project | Count accepted and rejected attempts without logging file content. |
| Upload concurrency | 1 per project, 2 process-wide | Semaphore acquired before body consumption; 429/503 with retry hint. |
| Extraction concurrency | 2 process-wide, 1 per project | Durable lease; OCR counts as extraction worker. |
| Request limits | 30 s headers, 10 min total, 30 s inactivity | Node server/request/socket timeouts; non-zero timeouts mitigate slow uploads.[CITED: https://nodejs.org/api/http.html#serverrequesttimeout] |
| Multipart | 1 file, <=4 fields, <=8 parts, <=64 header pairs, note <=2 KiB | `busboy` limits plus explicit limit-event failure/cleanup. |
| Filename | display only, 180 Unicode scalar limit | Store generated UUID key; strip control/path/bidi-risk characters for display/download header. |
| OOXML expanded bytes | 80 MiB | Sum declared and actual streamed sizes. |
| OOXML entries | 2,000; nesting 0 | Reject absolute/parent/backslash/NUL paths, encrypted entries, duplicate canonical names, embedded archives and macro-enabled formats. |
| Compression ratio | 100:1 overall and per entry | Reject before/decode during stream; zero compressed size with non-empty output rejects. |
| Extracted evidence text | 10 MiB / 20,000 blocks per material | Abort processing and preserve a non-sensitive failure code. |
| Chat | question <=1,000 chars; 12/min per source+user+project; 300/day platform; 2 concurrent model calls | Separate `chat` quota ledger and semaphore; generation quota is a different capability. |

[VERIFIED: reference Xugu `AI-SPEC.md` for file/count/capacity/rate/unpack/chat baselines; OWASP/Node official controls; multi-project concurrency is the recommended extension]

Allowed initial types: `.docx`, `.pptx`, `.xlsx`, `.pdf`, `.txt`, `.md`, `.csv`, `.json`, `.png`, `.jpg/.jpeg`, `.webp`, plus manual form JSON. Reject `.docm/.pptm/.xlsm`, legacy `.doc/.ppt/.xls`, HTML/XML uploads, archives and executables; XML is only parsed inside an already validated OOXML container.[VERIFIED: MAT-02 and security recommendation]

Validation order: authorization/CSRF → request/multipart limits → streamed staging+SHA-256 → extension/MIME/magic → format-specific signature/container shape → capacity/duplicate recheck → receipt/queue. On any rejection, close streams, delete staging, leave no material row except an audit event with code/size/type/project.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html]

## Extraction and Evidence Location Strategy

| Input | Server Extractor | Evidence Locator | Required Degradation Behavior |
|---|---|---|---|
| Meeting notes / manual form | validated structured JSON or UTF-8 text | `section`, field ID, paragraph/line, char start/end | Blank/oversize fields reject; no HTML. |
| DOCX | preflight ZIP then parse `word/document.xml`, relationships and selected notes/comments with saxes | paragraph index, table index + row/column, heading path; optional rendered page only if explicitly generated | DOCX has no stable page boundary; cite paragraph/table, not invented page. [CITED: https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs] |
| PPTX | read slide order relationships, each slide XML, notes and tables | slide number, shape name/id, paragraph/table row/column | Skip external relationships/media payload; record unsupported chart/SmartArt warning. [CITED: https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document] |
| XLSX | ZIP preflight, ExcelJS read; bound sheets/rows/cells | sheet name, `A1`/range, row/column; formula text and cached value distinguished | Do not evaluate formulas/macros/external links; cap used range and sparse cells. [CITED: https://github.com/exceljs/exceljs] |
| PDF | `pdfinfo`, then `pdftotext -bbox-layout -enc UTF-8`; parse XHTML | page, block/line, normalized bounding box; word boxes retained in location detail | Encrypted/permission errors fail clearly; low/no text invokes OCR if enabled. [CITED: https://manpages.debian.org/bookworm/poppler-utils/pdftotext.1.en.html] |
| Text/Markdown/CSV/JSON | UTF-8/UTF-16 decoder + type-specific bounded parser | line/record, JSON pointer or CSV row/column, char range | Binary/NUL or invalid encoding rejects; Markdown remains text. |
| PNG/JPEG/WebP | signature/dimensions, then Tesseract TSV | image index, OCR block/paragraph/line, pixel box, confidence | If OCR unavailable/low-confidence, create metadata/manual-caption evidence and mark text unavailable, never hallucinate. [CITED: https://tesseract-ocr.github.io/tessdoc/APIExample.html] |

Evidence chunks preserve source boundaries. Prefer one paragraph, table row group, slide text block, sheet row range, PDF block or OCR paragraph; split only above 1,200 characters with char offsets and <=150-character overlap. Never merge across pages/slides/sheets because that destroys citation locality.[VERIFIED: MAT-03 architecture recommendation]

Every block DTO returns a human locator such as `第 4 页 · 文本块 2`, `幻灯片 7 · 表格 1 · 第 3 行`, `工作表“指标” · B12:F12`, plus machine `location` JSON. `summary` is optional derived data and cannot replace verbatim normalized text.[VERIFIED: MAT-03 architecture recommendation]

## Materials Ledger, Template Selection and API Contract

Recommended endpoints:[VERIFIED: existing route convention; API recommendation]

```text
GET    /api/projects/:projectId/materials
POST   /api/projects/:projectId/materials                 # multipart upload or manual form
GET    /api/projects/:projectId/materials/:materialId
GET    /api/projects/:projectId/materials/:materialId/evidence
GET    /api/projects/:projectId/materials/:materialId/original  # attachment only
DELETE /api/projects/:projectId/materials/:materialId/original
DELETE /api/projects/:projectId/materials/:materialId
PATCH  /api/projects/:projectId/materials/:materialId/qa-access
GET    /api/projects/:projectId/update-templates
PUT    /api/projects/:projectId/materials/:materialId/update-template
POST   /api/projects/:projectId/chat
GET    /api/projects/:projectId/chat/quota
```

- Viewer: read published modules and ask chat only when project policy allows; cannot list/download raw materials by default. Editor/admin: list/upload, view evidence, select update template. Project admin/platform admin: Q&A grant, original cleanup and full delete. All writes require CSRF.[VERIFIED: existing role model; least-privilege recommendation]
- Original downloads are ID-routed attachments with `nosniff`; storage paths are never exposed. Evidence text is returned as JSON and rendered by fixed DOM helpers.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html]
- Original cleanup is a separate audited action and only allowed after a ready derived artifact/evidence set exists; it retains filename, size, SHA-256, evidence and cleanup timestamp. Full material deletion removes grants, FTS rows and remaining artifacts through a recoverable deletion job.[VERIFIED: reference Xugu `AI-SPEC.md`; MAT-05 recommendation]
- Update template catalog is versioned, pure server data (`meeting-notes`, `plan`, `progress`, `metrics`, `outcome`, `new-project`). Phase 4 saves selection only and shows “等待 Phase 5 生成”；it must not create proposals or mutate draft.[VERIFIED: roadmap Phase 5 delivery]

## Read-Only RAG and Quotas

1. Authorize the authenticated principal for path `projectId`; ignore/reject any conflicting body project ID.[VERIFIED: CHAT-01]
2. Load one published version snapshot and its version label/checksum.[VERIFIED: CHAT-01, existing version model]
3. Retrieve from `evidence_fts` with bound `project_id`, join `material_qa_grants`, status=`ready`, active extraction only. Use FTS5 `bm25`/highlight for >=3-character terms; for shorter Chinese terms use a bounded project-scoped title/text containment fallback.[VERIFIED: local FTS5 probe; CITED: https://www.sqlite.org/fts5.html]
4. Cap context to 8 blocks, 4 materials and a server-configured byte/token budget; deduplicate adjacent overlapping chunks.[VERIFIED: reference Xugu max 4 materials; retrieval recommendation]
5. Build context with explicit `<published_state>` and `<untrusted_evidence>` boundaries. Evidence instructions have no authority; provider receives no tools, credentials, file paths or cross-project handles.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html]
6. Require provider output `{answer, citations[], caveat, followUps[]}`; server verifies every cited block was in retrieved context and replaces invalid/missing citations with a deterministic insufficiency response.[VERIFIED: CHAT-02 architecture recommendation]
7. Record aggregate usage under capability=`chat`; future generation uses capability=`generation` with different permission and quota. Provider failure never affects project browsing.[VERIFIED: CHAT-03, NFR-03]

No embedding/vector store is required in Phase 4. FTS5 gives deterministic, inspectable lexical retrieval and exact evidence IDs; add embeddings only after a measured recall gap and retain project filters before vector search.[VERIFIED: NFR-01 architecture recommendation]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Multipart parser | boundary scanning/string concatenation | busboy limits + streams | malformed boundaries, backpressure and truncation are subtle. |
| File detection | extension/MIME trust | file-type + container-specific checks | names/headers are spoofable; magic alone is also insufficient. |
| ZIP decompressor | recursive extraction | yauzl lazy entry streams | central-directory, size, path and CRC edge cases. |
| XML parser | regex over OOXML | saxes | namespaces, entities, malformed input and streaming. |
| PDF text coordinates | regex over PDF bytes | Poppler bbox-layout | PDF encodings/layout are complex; OCR is separate. |
| OCR | image heuristics | Tesseract TSV | confidence and bounding boxes are required for traceability. |
| Search ranking/index | JS scan of all materials | SQLite FTS5 | keeps index/query durable and bounded. |
| HTML sanitization path | converter HTML in UI | normalized plain text + fixed DOM renderer | strongest defense is no executable markup channel. |
| Cross-project policy | route-only checks | auth + repository composite scope + FK/tests | one missed filter is a tenant leak. |

[VERIFIED: official docs and OWASP guidance cited above]

## Common Pitfalls

### 1. Content-Length Is Treated as the Limit
**What goes wrong:** chunked uploads exceed capacity.[VERIFIED: HTTP behavior]
**How to avoid:** early header reject plus streamed counter and busboy limit; abort socket/parser and delete staging.[CITED: https://github.com/mscdex/busboy]

### 2. All OOXML Looks Like ZIP
**What goes wrong:** renamed ZIP or wrong Office type passes a `PK` signature.[VERIFIED: OOXML packaging structure]
**How to avoid:** inspect `[Content_Types].xml`, required relationships and root parts for the declared `.docx/.pptx/.xlsx` type before parsing.[CITED: https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document]

### 3. FTS Index Drifts From Evidence
**What goes wrong:** deleted/reprocessed blocks remain searchable or return NULL content.[CITED: https://www.sqlite.org/fts5.html#external_content_table_pitfalls]
**How to avoid:** same-transaction triggers/updates, integrity query and rebuild test; swap active extraction atomically.

### 4. Two-Character Chinese Queries Return Nothing
**What goes wrong:** trigram tokenizer requires enough characters for a trigram; local probe showed `证据` misses while `证据层` matches.[VERIFIED: local SQLite 3.53.0 probe]
**How to avoid:** bounded, escaped, project-scoped containment fallback for short queries and keep FTS for normal queries.

### 5. Duplicate Check Becomes a Side Channel
**What goes wrong:** a global hash tells project A that project B has the same confidential file.[VERIFIED: threat inference]
**How to avoid:** `(project_id, sha256)` duplicate semantics and indistinguishable cross-project behavior.

### 6. Extracted Text Is Trusted as Instructions
**What goes wrong:** document prompt injection tries to reveal other projects or invoke tools.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html]
**How to avoid:** untrusted-evidence boundary, no tools, pre-filtered project context, citation verification and output schema.

### 7. Original and Derived Deletion Are Coupled
**What goes wrong:** clearing an original destroys citations, or deleting a processed file changes published project state.[VERIFIED: MAT-05 risk]
**How to avoid:** independent artifacts/grants/version state; explicit audited cleanup operations and stable material/evidence IDs.

### 8. Parser Failure Blocks the HTTP Server
**What goes wrong:** ZIP/XML/OCR CPU or memory exhaustion makes browsing unavailable.[CITED: Mammoth security guidance; OWASP ZIP bomb testing]
**How to avoid:** queue, leases, per-job timeout, bounded child process, process-wide concurrency and no parsing in request callback.

## Code Examples

### Project-Scoped FTS Query

```sql
-- Source: SQLite FTS5 official docs + project isolation pattern
SELECT b.id, b.material_id, b.location_json,
       snippet(evidence_fts, 0, '[', ']', '…', 24) AS excerpt,
       bm25(evidence_fts) AS rank
FROM evidence_fts
JOIN evidence_blocks b ON b.id = evidence_fts.rowid
JOIN material_qa_grants g
  ON g.project_id = b.project_id AND g.material_id = b.material_id AND g.enabled = 1
WHERE evidence_fts MATCH ?
  AND b.project_id = ?
  AND b.extraction_version = (
    SELECT active_extraction_version FROM project_materials
    WHERE project_id = ? AND id = b.material_id
  )
ORDER BY rank
LIMIT 8;
```

[CITED: https://www.sqlite.org/fts5.html]

### Safe Subprocess Invocation

```js
// Source: architecture recommendation; never use shell=true or user-built argv
const child = spawn(PDFTOTEXT_PATH, ["-bbox-layout", "-enc", "UTF-8", inputPath, outputPath], {
  shell: false,
  stdio: ["ignore", "ignore", "pipe"],
  env: SAFE_EXTRACTOR_ENV
});
```

[VERIFIED: ASVS command-injection control direction; CITED: https://github.com/OWASP/ASVS]

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| single-project JSON `materials[]` | normalized project-scoped entities + filesystem artifacts | enables isolation, transactions, indexes and recovery. |
| whole-material Markdown retrieval | locatable evidence blocks + FTS + stable citations | citations reach page/slide/sheet/table/paragraph. |
| upload then synchronous AI preprocess | deterministic gate then durable extractor job | parser/model failures do not block browsing. |
| browser-held recent context and coarse chat flag | server-enforced project/grant/retrieval/quota | client cannot expand knowledge scope. |
| converter-generated HTML | plain normalized text + fixed renderers | removes an executable-content channel. |

[VERIFIED: reference Xugu architecture versus Phase 4 recommendation]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| — | None. Defaults are explicit implementation recommendations derived from accepted project constraints or verified sources, not claims about unstated user policy. | — | — |

## Open Questions

1. **Production anti-malware/CDR requirement**
   - What we know: OWASP recommends AV/sandbox/CDR where available; `clamscan` is not installed locally.[CITED: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html; VERIFIED: environment probe]
   - Recommendation: implement a post-signature scanner hook and `quarantined` state now; allow internal pilot without scanner only through an explicit server configuration warning, never silently claim malware scanning.
2. **LLM provider/model for chat**
   - What we know: the reference Xugu uses server-side GLM, while the new platform AI contract is provider-neutral and forbids exposing keys.[VERIFIED: reference Xugu `AI-SPEC.md`, project `AI-SPEC.md`]
   - Recommendation: keep retrieval/citations/provider interface independent; Phase 4 can run deterministic retrieval and configured read-only chat, but no provider choice belongs in material schema.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | runtime/tests | ✓ | 25.9.0 | minimum 24.15 |
| npm | packages/scripts | ✓ | 11.12.1 | direct node scripts |
| SQLite FTS5 | retrieval | ✓ | SQLite 3.53.0 | bounded LIKE only if deployment probe fails |
| Poppler | PDF extraction/OCR raster | ✓ | 26.04.0 | fail PDF processing with actionable dependency code |
| Tesseract | image/scan OCR | ✓ | 5.5.2 | manual caption/metadata evidence; mark OCR unavailable |
| LibreOffice `soffice` | optional test fixture generation/format comparison | ✓ | 26.2.3.2 | runtime-generated minimal fixtures |
| ClamAV | optional malware scan | ✗ | — | quarantine hook + conservative allowlist; operational warning |
| qpdf | optional PDF structural preflight | ✗ | — | `pdfinfo` + Poppler parser errors |

[VERIFIED: local environment probe on 2026-07-18]

**Missing dependencies with no fallback:** none for the recommended primary path on this machine.[VERIFIED: environment probe]

**Missing dependencies with fallback:** ClamAV and qpdf as above.[VERIFIED: environment probe]

## Validation Architecture

`workflow.nyquist_validation` is absent, so validation is enabled.[VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in `node:test`, Node >=24.15 |
| Config file | none |
| Quick run | `node --test test/material-gate.test.mjs test/material-repository.test.mjs test/evidence-extractors.test.mjs` |
| Full suite | `npm run verify` |

[VERIFIED: current test infrastructure]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MAT-01 | same filename/hash behavior isolated across two projects; every lookup composite-scoped | integration | `node --test test/material-isolation.test.mjs` | ❌ Wave 0 |
| MAT-02 | all allowed formats/manual form reach ready or explicit supported degradation | extractor | `node --test test/evidence-extractors.test.mjs` | ❌ Wave 0 |
| MAT-03 | page/paragraph/table/slide/sheet/OCR locations and citation IDs survive reload | unit/integration | `node --test test/evidence-location.test.mjs` | ❌ Wave 0 |
| MAT-04 | oversize, spoof, duplicate, rate, concurrency, zip bomb/path/entry limits leave no orphan | security | `node --test test/material-gate.test.mjs` | ❌ Wave 0 |
| MAT-05 | original cleanup does not delete evidence/grant/published; full delete is recoverable | integration | `node --test test/material-lifecycle.test.mjs` | ❌ Wave 0 |
| CHAT-01 | project A question/body/material IDs cannot retrieve B; only published + granted | security integration | `node --test test/chat-isolation.test.mjs` | ❌ Wave 0 |
| CHAT-02 | every citation belongs to context; missing data deterministic | contract | `node --test test/chat-contract.test.mjs` | ❌ Wave 0 |
| CHAT-03 | chat/generation capability and quota ledgers independent | unit/integration | `node --test test/ai-quota.test.mjs` | ❌ Wave 0 |
| NFR-01 | restart recovers jobs; failed extraction does not affect module browsing | resilience | `node --test test/material-recovery.test.mjs` | ❌ Wave 0 |

### Required Security/Negative Corpus

- chunked body beyond limit, wrong/missing multipart boundary, file limit truncation, slow/incomplete request.[VERIFIED: busboy/Node risk model]
- extension/MIME/magic mismatches, polyglot-like prefix, encrypted PDF/ZIP, macro formats, invalid UTF/NUL.[VERIFIED: OWASP upload guidance]
- ZIP traversal (`../`, absolute, backslash), duplicate names, oversized entry/count/ratio, nested archive, CRC/truncation.[VERIFIED: OWASP WSTG ZIP guidance]
- cross-project material/evidence/grant/download/chat IDs for viewer/editor/admin/platform admin; responses stay uniform 404.[VERIFIED: MAT-01/CHAT-01]
- prompt-injection documents requesting secrets/tools/other projects; answer may quote them as evidence but cannot obey or cite out-of-scope data.[VERIFIED: OWASP LLM prompt injection guidance]
- failure injection at every staging/DB/rename/job transition; startup reconciliation leaves neither invisible quota usage nor orphan files.[VERIFIED: architecture recommendation]

Test Office/PDF/image files should be generated into temporary directories at test runtime; do not commit uploaded originals or derived output. Commit only generators, schemas and non-sensitive expected metadata.[VERIFIED: `AGENTS.md`]

### Browser Validation

- Admin/editor uploads a runtime-generated sample, sees streamed progress, queued/ready/error ledger states, evidence locator and update-template selection; viewer has no upload/manage buttons.[VERIFIED: UI acceptance recommendation]
- Two browser principals switch projects and upload identical names; each ledger/chat shows only its project. Direct cross-project URLs and Back/refresh remain isolated.[VERIFIED: Phase 2 browser baseline + MAT-01]
- Original download is attachment; evidence containing `<script>`, Markdown links, `javascript:` and bidi/control text renders inertly with zero console errors/dialogs.[VERIFIED: MOD-02 security contract]
- 1440×900, 1024×768 and 390×844 materials ledger/upload/chat drawer have no page-level horizontal overflow; keyboard focus and busy/error announcements work.[VERIFIED: existing Phase 3 viewport/accessibility baseline]

### Sampling Rate

- **Per task commit:** focused material/extractor/chat tests + `node --check` modified JS/MJS.[VERIFIED: existing validation style]
- **Per wave merge:** `node --test` plus migration 004 repeat/checksum/upgrade/rollback.[VERIFIED: existing migration validation]
- **Phase gate:** `npm run verify`, real-browser two-project matrix, runtime data/secret tracked-file scan, read-only Xugu reference hash/status check.[VERIFIED: AGENTS lifecycle and current verify script]

### Wave 0 Gaps

- [ ] migration 004 upgrade/repeat/rollback fixtures and FTS availability probe
- [ ] runtime fixture generators for DOCX/PPTX/XLSX/PDF/image/bomb/spoof cases
- [ ] `test/material-gate.test.mjs`
- [ ] `test/material-repository.test.mjs`
- [ ] `test/evidence-extractors.test.mjs`
- [ ] `test/evidence-location.test.mjs`
- [ ] `test/material-isolation.test.mjs`
- [ ] `test/material-lifecycle.test.mjs`
- [ ] `test/chat-isolation.test.mjs`
- [ ] `test/chat-contract.test.mjs`
- [ ] `test/ai-quota.test.mjs`
- [ ] `test/material-recovery.test.mjs`
- [ ] Phase 4 browser evidence manifest and screenshot verifier update

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set it to false.[VERIFIED: config]

### Applicable ASVS Categories

| ASVS 5 Category | Applies | Standard Control |
|---|---|---|
| V1 Architecture/Threat Modeling | yes | trust boundaries for browser, upload staging, parser child, storage, retrieval and model. |
| V2 Authentication | yes | existing authenticated session before project/material routes. |
| V3 Session Management | yes | existing digest cookie + CSRF; no tokens in upload URLs. |
| V4 Access Control | yes | authenticated project context + composite repository queries + uniform 404. |
| V5 Validation/Encoding | yes | allowlists, length/range/schema checks, text-only rendering, bound SQL. |
| V6 Stored Cryptography | limited | SHA-256 for integrity/duplicate, not encryption; secrets stay server-side. |
| V7 Error/Logging | yes | non-sensitive codes, project/user/action metadata, no filenames/content/keys in logs. |
| V8 Data Protection | yes | runtime files outside webroot/Git, least-privilege permissions and separate artifacts. |
| V9 Communication | yes | HTTPS + Secure cookie required on LAN beyond localhost. |
| V10 Malicious Code | yes | no macros/code execution, no shell, parser subprocess allowlist. |
| V11 Business Logic | yes | quotas, concurrency, duplicate and lifecycle state tests. |
| V12 Files and Resources | yes | upload/signature/storage/download/archive controls. |
| V13 API/Web Service | yes | request limits, content types, CSRF, consistent DTO/errors. |
| V14 Configuration | yes | dependency probes, explicit scanner warning, secure storage root. |

[CITED: https://github.com/OWASP/ASVS; https://devguide.owasp.org/en/11-security-gap-analysis/01-guides/02-asvs/]

### Threat Model

| Threat | STRIDE | Mitigation / Verification |
|---|---|---|
| forged project/material ID | Spoofing/Elevation | session-derived principal, project authorization first, composite queries/FKs, matrix tests. |
| file/type/signature spoof | Tampering | extension+MIME+magic+shape allowlist; reject mismatches. |
| ZIP bomb/path/symlink | DoS/Disclosure | lazy entries, count/bytes/ratio/path limits, no filesystem extraction. |
| parser/OCR resource exhaustion | DoS | queue/lease, timeout, concurrency, child kill, extracted-text cap. |
| global duplicate oracle | Information Disclosure | per-project duplicate keys and uniform errors. |
| stored XSS/active links | Tampering/Elevation | normalized text, fixed DOM, attachment downloads, CSP/nosniff. |
| prompt/RAG injection | Tampering/Disclosure | untrusted evidence, no tools, prefiltered context, citation verification. |
| orphan/stale artifact after crash | Repudiation/DoS | receipt state machine, reconciliation and audit events. |
| quota race | DoS | transactional quota reservation before model/extractor work. |
| secret/path leakage | Information Disclosure | server-only config, redacted errors, never return storage keys/argv/stderr. |

[VERIFIED: requirements and OWASP official guidance cited above]

## Sources

### Primary (HIGH confidence)

- Current repository: `AGENTS.md`, project memory, migrations 001–003, HTTP/auth/module/repository/test code, Phase 3 verification.[VERIFIED: codebase inspection]
- Read-only Xugu reference: `AI-SPEC.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`, upload/chat UI contract.[VERIFIED: codebase inspection]
- SQLite FTS5 official documentation: https://www.sqlite.org/fts5.html
- Node HTTP official documentation: https://nodejs.org/api/http.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP Multi-Tenant Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- OWASP LLM Prompt Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- OWASP ASVS 5.0: https://github.com/OWASP/ASVS
- Microsoft Open XML Word/Presentation structure docs: https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs and https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document
- Official package repositories cited in Standard Stack.[VERIFIED: package legitimacy OK + official docs]

### Secondary (MEDIUM confidence)

- Debian Poppler man page for `pdftotext -bbox-layout`: https://manpages.debian.org/bookworm/poppler-utils/pdftotext.1.en.html
- Local runtime/package/CLI probes on 2026-07-18.[VERIFIED: commands]

### Tertiary (LOW confidence)

- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and legitimacy checked; selected packages are official and gate OK; OS tools were probed locally.[VERIFIED: registry/seam/environment]
- Architecture: HIGH — anchored in accepted project boundaries, current code seams, official file/security guidance and reference Xugu behavior.[VERIFIED: codebase and official sources]
- Extraction fidelity: MEDIUM — format locations are well defined, but production corpus diversity must be proven with Phase 4 fixtures/UAT.[VERIFIED: known validation gap]
- Pitfalls/security: HIGH — verified against OWASP/official docs and local FTS behavior.[VERIFIED: cited sources]

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 for package/runtime versions; architecture remains valid until project decisions change.[VERIFIED: research maintenance recommendation]
