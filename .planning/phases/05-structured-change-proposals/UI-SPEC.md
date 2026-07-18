---
phase: 05-structured-change-proposals
status: accepted
date: 2026-07-18
design_system: local-semantic-html-css-dom
shadcn_initialized: false
preset: none
registry: none
---

# Phase 5 UI Design Contract

## 1. Design intent and phase boundary

Phase 5 adds one controlled path to the verified Materials workspace: an authorized editor selects 1–8 ready materials that share one versioned update template, creates a generation task locked to the current published version, and inspects the server-validated structured `ChangeProposal`. The interface explains sources, semantic type, confidence, warnings, validation failures, usage and cost without presenting model prose as project truth.

The phase extends the accepted Xugu public frame and Phase 4 materials renderer. It keeps the 76px sticky white header, warm command canvas, horizontal project-module navigation, compact module heading and rounded white cards. `campaign-map-v1` and `standard-project-v1` share repository-local semantic HTML/CSS/DOM renderers; project differences come only from server-resolved terminology, theme tokens, template labels and structured data.

The Phase 5 boundary is absolute: generation may create an immutable task record and a server-validated proposal relative to `published`; it must not accept, reject or edit a change, compare editable before/after values, merge anything into `draft`, preview a draft, publish or roll back. The UI contains no “接受”“驳回”“编辑提案”“应用更新”“合并草稿”“发布” or “回滚” action. Those are Phase 6 capabilities, not disabled Phase 5 controls.

Sources: `AGENTS.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/DECISIONS.md`, Phase 5 `CONTEXT.md`, the accepted Phase 4 `UI-SPEC.md`, the current `public/` frontend, and the read-only Xugu application. The Xugu reference contributes the public white-header/warm-canvas visual language only; its dark administrative sidebar and direct draft editor are not carried into this platform flow.

## 2. Design system and tokens

| Property | Contract |
|---|---|
| UI implementation | Repository-local semantic HTML, CSS and DOM APIs |
| Component/registry | None; remote blocks, CDN scripts and project-supplied components are prohibited |
| Font | `Inter`, `PingFang SC`, `Microsoft YaHei`, system sans-serif; no remote request |
| Icons | Repository-local inline SVG symbols or CSS shapes with accessible labels |
| Renderer boundary | A fixed proposal/task renderer consumes allowlisted API fields; provider output never selects HTML, CSS, SVG, routes or components |

Phase 5 reuses the established tokens exactly: navy `#071a3d/#0b2c68`, blue `#1265f2/#eaf2ff`, orange `#ff6422/#fff0e7`, green `#15966b/#e9f8f2`, ink `#172943/#5f7088/#8290a4`, white surface, `#dce5f1` line, `#c8443a` danger, 18px cards and 10px controls. Spacing is `4, 8, 16, 24, 32, 48, 64px`; minimum target size is 40px. Typography uses 12px metadata, 14px body/control, 16px lead/status and 28px route heading, with weights 500 and 700.

- Blue marks navigation, links and normal primary actions. Orange marks the current generation focus and template identity. Green means a deterministic gate passed. Amber means warning, retryable failure or attention. Red is reserved for a blocking validation failure or terminal error. Every state has visible text and is never communicated by color alone.
- Confidence never uses color alone and never uses false precision as the primary signal. Display the server band “高 / 中 / 低” with the numeric value in accessible metadata, for example “中（0.72）”. Do not convert confidence into approval, truth or completion.
- Proposed data, warnings, material names and extracted evidence remain untrusted text. They cannot become style values, `innerHTML`, inline SVG markup or executable URLs.

## 3. Information architecture and canonical routes

Phase 5 remains inside the fixed Materials module; it does not register a tenth project module.

| Surface | Canonical route |
|---|---|
| Material ledger | `/projects/:projectId/modules/materials?view=ledger` |
| Read-only Q&A | `/projects/:projectId/modules/materials?view=qa` |
| Proposal workspace | `/projects/:projectId/modules/materials?view=proposals` |
| Material detail | `/projects/:projectId/modules/materials/:materialId` |
| Generation task detail | `/projects/:projectId/modules/materials/generation-tasks/:taskId` |
| Validated proposal detail | `/projects/:projectId/modules/materials/proposals/:proposalId?change=:changeId` |

- The Materials local tab list becomes three links: “材料台账”, the template-resolved Q&A label, and the template-resolved proposal label. It uses real URLs, `aria-current="page"`, Left/Right roving focus and Enter activation.
- The proposal workspace contains URL-backed sub-tabs “更新提案” and “生成任务”. Filters, sort, selected task/proposal and selected `changeId` survive Back/Forward and refresh through query/path state; they are not persisted to Web Storage.
- The material detail remains the only starting point for a single-material task. A proposal-workspace “创建生成任务” action may open the same selection sheet for a 1–8-material batch.
- Switching projects immediately removes the prior project’s material names, selected IDs, generation form, task progress, proposal content and usage values before the new request begins. Direct cross-project or unknown IDs render the same project-scoped 404 state.

## 4. Template and terminology contract

Technical IDs and Schema versions remain stable; visible labels are resolved by the project template.

| Element | `campaign-map-v1` default | `standard-project-v1` default |
|---|---|---|
| Proposal tab/title | 作战更新提案 | 项目更新提案 |
| Create CTA | 生成作战更新提案 | 生成项目更新提案 |
| Proposal item noun | 建议变更 | 建议变更 |
| Unit noun | 作战单元 | 团队 |
| Task noun | 行动任务 | 任务 |
| Stage noun | 战役节点 | 里程碑 |
| Outcome noun | 战果 | 交付物 |
| Empty proposal body | 从已就绪材料生成带来源的作战增量；不会修改草稿或发布状态。 | 从已就绪材料生成带来源的项目增量；不会修改草稿或发布状态。 |

Six immutable update-template identities are shown with server-resolved labels and explicit versions:

| ID | Campaign label | Standard label |
|---|---|---|
| `meeting-notes` | 会议纪要 | 会议纪要 |
| `project-plan` | 作战计划 | 项目计划 |
| `progress-report` | 战况汇报 | 进度汇报 |
| `metrics-data` | 指标数据 | 指标数据 |
| `outcome-archive` | 战果归档 | 交付物归档 |
| `new-project-material` | 新作战材料 | 新项目材料 |

The browser never supplies a free-form template, Schema, prompt, model, module name or operation. Unknown/deprecated template IDs fail closed as “更新模板不可用”; the user returns to material metadata selection instead of silently receiving a default. Standard projects must not leak “作战”“战役”“战果”“作战单元”; project names and Xugu branding are never hardcoded into the shared renderer.

## 5. Material detail generation entry

The Phase 4 material detail frame and evidence index remain intact. A new “结构化更新” card appears after material metadata and before the evidence layout when the server returns `canGenerate=true`.

The card always shows:

- Material readiness, selected update-template label/version and number of current-generation evidence blocks.
- Generation authorization as a separate state from Q&A authorization. “已授权问答” never implies “可用于生成”.
- Current published version label and timestamp. Copy: “提案将相对于当前发布版本 {version} 生成”.
- A fixed boundary note: “AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本.”
- The template-resolved create CTA, or a precise prerequisite state.

Prerequisite states are explicit:

| Condition | Copy / action |
|---|---|
| Processing not ready | “材料证据尚未就绪，完成处理后才能生成提案.” No generation action |
| No update template | “请先选择材料用途和更新模板.” Action “选择更新模板” when permitted |
| No current evidence | “该材料没有可用于生成的当前证据块.” No task is created |
| No generation grant | “该材料尚未授权用于更新生成.” Admin capability may show “授权用于生成”; editors never receive a decorative disabled control |
| Role lacks create capability | Existing tasks/proposals may remain visible; create and grant controls are absent |
| Provider disabled | “更新生成当前未启用；材料、证据和已有提案仍可查看.” No key or provider configuration form is offered |

If the material has prior tasks, the card lists the three most recent task states with created time and a “查看全部生成任务” link. It never labels a validated proposal as applied or pending approval.

## 6. Create-generation sheet

The create CTA opens a 680px right sheet on desktop/tablet and a full-width bottom sheet on mobile. The dialog has a visible title, project name/stable ID, published base version, template ID/version, Schema `change-proposal-v1@1.0.0`, server quota and the immutable boundary note.

### 6.1 Material selection

- The originating material is preselected. Users may add up to seven eligible materials from the same project and exact update-template version.
- Each selectable row shows safe material name, locator-ready evidence count, extraction generation and template version. The list never includes another project, non-ready material, stale extraction generation, unauthorized original, or a material with a different template.
- Checkbox selection uses a `fieldset`/`legend`, text “已选择 {n}/8 份材料”, Select All only for the current filtered eligible set, and a visible reason for ineligible same-project material.
- Selecting a material grants no new access. Generation authorization remains server-controlled and separate from ledger/original/Q&A access.

### 6.2 Locked task summary

The sheet shows a read-only summary before submission:

1. Project and stable `projectId`.
2. Published base version and version ID.
3. Update-template label, ID and version.
4. Selected material count and evidence-block count, capped at the server-returned 48.
5. Input limits: 32 KiB published summary, 64 KiB evidence text and output cap 128 KiB/100 changes.
6. Generation remaining/reset values, per-minute status and the fact that usage is charged for all provider attempts.

The user does not choose individual evidence blocks in Phase 5. The server deterministically locks eligible current-generation blocks and returns the exact selection on the task detail; this prevents the browser from omitting contradictory evidence or forging IDs.

Primary action: template-resolved create CTA. Pending copy: “正在创建生成任务…”. Dismiss action: “关闭生成面板”. Submission is idempotent; a double click or retry with the same idempotency key shows the existing task rather than consuming a second quota reservation. Once accepted, the sheet closes and navigates to task detail.

Errors are inline and retain eligible selection without copying task content to browser storage:

- `base_version_conflict`: “发布版本已变化，请核对新版本后重新创建任务.” Action “刷新版本与材料”.
- quota exhausted: “本项目更新生成配额已用完，可在 {resetTime} 后重试.”
- rate/concurrency: “生成请求过于频繁，请在 {retryAfter} 后重试.” / “已有生成任务正在占用可用并发，请稍后重试.”
- provider disabled: copy from Section 5.
- material/template/evidence invalidation: “所选材料状态已变化，请重新选择.” The server-returned invalid rows are identified without revealing unauthorized records.

## 7. Proposal workspace

### 7.1 Summary and filters

The workspace begins with a white summary card containing validated proposal count, running task count, retryable failure count, stale proposal count and server-reported generation usage. These are task/proposal facts, not project progress.

The proposal list defaults to newest first and supports search by safe task/proposal ID or source material name, status filter, update-template filter and base-version filter. The generation-task sub-tab adds task-state and initiator filters. Desktop uses a table; tablet/mobile use cards. Cursor pagination is server-driven.

Proposal columns/cards contain:

- Proposal ID and “结构校验通过” or “基准版本已过期”. A proposal exists only after all blocking validation passes.
- Template label/version and Schema version.
- Base published version, created by/time and source-material count.
- Change counts grouped by fixed module and operation; semantic-type and warning counts.
- Aggregate confidence range as descriptive metadata only.
- “查看结构化提案” link. There are no row-level review or merge actions.

The generation-task list contains task ID, template, base version, source count, state, current attempt, token/cost summary, created/updated time and a single allowed action: “查看任务”. A server-marked retryable terminal task may also show “重试生成”; it creates a new immutable attempt/task lineage and never overwrites the failed task or a validated proposal.

### 7.2 Honest empty states

- No proposals: heading “尚未生成结构化更新提案” plus the template-specific body from Section 4 and, when authorized, “选择材料创建任务”.
- Tasks exist but no proposal: “生成任务正在处理，或尚未通过结构校验.” Link to task list.
- Filters empty: “没有符合当前筛选条件的提案.” Action “清除筛选”.
- Viewer: same read-only empty data semantics; no prompt to request elevated access and no disabled create button.

## 8. Generation task detail and lifecycle

The task detail preserves the project header/module navigation and starts with “返回更新提案”. It uses a two-column desktop layout: a minmax main timeline and a 300px locked-context side card; tablet/mobile stack context before the timeline.

### 8.1 Task states

The server state is rendered as text plus icon in this order:

1. `queued` — “等待生成资源”
2. `retrieving_evidence` — “锁定并整理证据”
3. `generating` — “生成结构化增量”
4. `repairing` — “修复结构输出（最多一次）”
5. `validating` — “执行服务端校验”
6. `succeeded` — “结构化提案已生成”
7. `failed_retryable` — “生成暂时失败，可重试”
8. `failed_terminal` — “生成失败，未创建提案”
9. `stale` — “发布基准已变化，结果不可继续使用”

Only completed states receive a time. Running steps use an indeterminate marker and elapsed time, never a fabricated percentage. Polling follows server retry hints, pauses when the document is hidden, survives refresh from the canonical route and stops on terminal state, logout or project switch. A 10-second delay adds “生成时间较长，已有项目仍可正常浏览.”

### 8.2 Locked context and usage

The context card shows project, base version, template, Schema version, selected materials and exact evidence count. Each material links to its authorized material detail. Evidence text is not duplicated into the task page.

Usage is per attempt and total: provider/model identifier as a server-safe label, input/output/total tokens, attempt kind (`initial`, `transient-retry`, `structure-repair`), latency and cost. When price is configured show currency plus versioned price-card label; otherwise show “未配置单价，仅记录 Token” and `costStatus=unpriced`. API keys, endpoints, prompts, raw provider response and stack traces never reach the browser.

### 8.3 Failure and retry

- Retriable provider/network failure: “更新生成暂时失败，未影响项目数据.” Authorized roles see “重试生成”.
- Schema/size/reference/semantic failure: “模型输出未通过结构校验，未创建提案.” No generic retry unless the server marks it retryable.
- Base-version conflict: “发布版本已变化；此任务锁定于 {baseVersion}，不会自动改用新版本.” Authorized action “基于当前版本创建新任务”.
- Retry preserves the original task, failure codes and accumulated usage. Confirmation states that the new attempt also consumes quota; it never suggests an existing charge was reversed.
- A status announcement uses `aria-live="polite"`; terminal failure uses `role="alert"` once. Focus does not jump on poll updates.

## 9. Proposal detail and structured changes

The proposal detail is inspection-only. Its top card contains proposal ID, “结构校验通过”/“基准版本已过期”, current project, base published version, Schema/template versions, source count, change count, created time and task link. An orange boundary banner reads: “这是相对于发布版本 {version} 的结构化建议；尚未写入草稿，也未发布.”

Desktop uses a 280px module/change index and a `minmax(0, 1fr)` detail column. The index groups changes by allowlisted module and shows operation count. Selecting a change updates `?change=:changeId`, marks `aria-current="location"` and updates a polite summary. Tablet moves the index above content; mobile uses a native “选择建议变更” select.

Each change card displays only validated, allowlisted structure:

- Stable `changeId`, module label, operation (`新增 / 更新 / 删除建议`), target type and target ID or “新对象”.
- Semantic type with exact values `fact / plan / suggestion / unknown` and template-resolved explanations. `unknown` and `suggestion` receive an explicit “不可视为已确认事实” note.
- Confidence band and numeric metadata, never an accept recommendation.
- A bounded field list rendered as labels and escaped values. Long arrays collapse behind “展开结构化字段”. Raw arbitrary JSON is not injected; unknown keys do not render.
- Evidence list. Every reference shows material name, exact page/paragraph/table/image locator and evidence ID, and deep-links to the same-project material detail. High-impact fields identify the supporting reference next to the field.
- Server warnings grouped by stable warning code and human-safe message.

Phase 5 does not render a Phase 6 review diff. In particular, it does not show editable “原值 / 建议值” controls, checkboxes, accept/reject state, module bulk action or draft preview. An operation summary may say that a validated proposal suggests adding/updating/deleting an entity, but it cannot imply the change has been approved or applied.

## 10. Validation report

Every succeeded proposal contains an always-visible validation summary before the change index. Failed validation remains on the task detail and creates no proposal link.

The report groups deterministic checks into eight fixed categories:

1. Schema/version/size and allowlisted fields.
2. Project, material and evidence ownership/current extraction generation.
3. Base published version and module/target existence.
4. Required evidence for completion, progress, metric, date, owner and outcome fields.
5. Date format/order and template-specific constraints.
6. Task dependency existence and directed-acyclic-graph check.
7. Duplicate stable ID/name and conflicting operation checks.
8. Semantic type, confidence range, warning shape and executable-content rejection.

Each category is a disclosure row with status “通过 / 警告 / 阻断”, count and last validation time. The default view expands blockers, then warnings; successful detail stays collapsed but remains keyboard accessible. Issues include a stable code, affected `changeId`/field when authorized, and safe remediation text. They never expose raw SQL, file paths, stack traces, provider prompts or another project’s identifiers.

- Blocking failure core copy: “提案未通过服务端校验，未写入项目草稿或发布版本.”
- Evidence failure: “完成状态、进度、指标值、日期、责任人或成果缺少直接证据.”
- Cycle failure: “任务依赖形成循环，提案已拒绝.”
- Cross-project/reference failure: “来源或目标不属于当前项目，提案已拒绝.”
- Version conflict: “提案基准版本与当前发布版本不一致.”
- Warning is never rendered as success. Warnings persist on proposal and per-change views for future Phase 6 review.

The browser shows server validation results; it may perform advisory form checks but never declares a proposal valid on its own.

## 11. Roles and capabilities

- `platform_admin`, `project_admin` and `project_editor` may create tasks from material they are authorized to use for generation, inspect tasks/proposals and retry only server-marked retriable tasks.
- `viewer` may view proposal/task summaries and details only when the server grants project proposal-read capability. It never sees generation/grant/retry controls.
- Generation authorization management is a distinct server capability; project editors do not automatically receive it. Q&A authorization, original download, evidence read, generation use, task creation and proposal read remain independently enforced.
- Controls are present only when the API returns the matching capability. Hiding them is presentation, never authorization. Direct unauthorized task/proposal/material references return the same 404 shape.
- Provider/model configuration and secret management are platform operations outside this project workspace. No Phase 5 browser response contains an API key or secret hint beyond a boolean provider-enabled state.

## 12. Loading, empty, error and recovery states

- Route transitions preserve the verified shell and horizontal navigation. Content uses `aria-busy="true"` with structure-matching skeletons: selection rows for the sheet, summary/list rows for workspace, timeline/context for task detail, and validation/change cards for proposal detail. Skeletons contain no fake material names, facts, costs, confidence or validation results.
- General proposal error: “无法加载更新提案” plus “重新加载提案”. Task error: “无法加载生成任务” plus “重新加载任务”. Existing project modules remain usable.
- A task provider failure never replaces or corrupts the material page. Existing material, evidence, Q&A and published modules remain available.
- Session expiry clears all project/task/proposal DOM before showing login. Back after logout cannot restore proposal values from browser cache.
- Stale proposal remains immutable and readable with its base version and warning. It is not silently rebased, patched or hidden.
- Browser offline/network failure preserves only the current in-memory route state and offers retry. It does not enqueue generation in local storage or fabricate a queued task.

## 13. Accessibility and responsive behavior

- One `h1` identifies the current task or proposal; headings remain hierarchical. Tables have captions and scoped headers. Definition data uses `dl/dt/dd`. Task state uses an ordered list. Validation categories use native `details/summary` or equivalent button/region semantics.
- All routes, local/sub-tabs, filters, sheets, material selection, task timeline, change index, validation disclosures and evidence links work by keyboard. Dialog focus is trapped, Escape closes only before a committed mutation, and focus returns to the invoking CTA.
- Controls have 40px minimum targets. Icon-only controls have accessible names. Status announcements are concise and do not repeat on every poll.
- `prefers-reduced-motion` removes shimmer and nonessential motion. Focus styling, text states and structure remain visible in high contrast and at 200% zoom.

Responsive layout:

- **≥1280px / 1440×900:** preserve the Xugu 76px white header and horizontal module navigation. Proposal list/table and task/proposal two-column layouts fit within the 1460px canvas. No dark sidebar.
- **768–1279px / 1024×768:** header/navigation retain project context with horizontal scrolling where already accepted; task/proposal context stacks above main content, summary uses two columns and tables may become cards.
- **≤767px / 390×844:** one-column cards, bottom-sheet creation, sticky sheet actions, native change selector and full-width validation disclosures. Long IDs wrap or truncate with an accessible full label. No page-level horizontal overflow; only a labeled table/value region may scroll locally.
- Server labels and values wrap without clipping at 200% zoom. Confidence, token and cost rows do not rely on a wide dashboard grid.

## 14. Security rendering contract

- Provider output, material/evidence text, project data, patch values, warnings and validation messages are untrusted data. Render them with text DOM APIs and allowlisted safe attributes; never use `innerHTML`, project-supplied Markdown HTML, external document viewers, arbitrary SVG, `javascript:` links or data HTML/SVG.
- The fixed renderer accepts only the versioned `change-proposal-v1@1.0.0` presentation DTO. Unknown Schema versions, modules, operations, semantic values, fields, warning shapes or executable-looking keys fail closed before presentation.
- Prompt injection strings, tool instructions, code fences, URLs and role-change requests inside evidence or proposal fields remain inert text. There is no “run”, “open tool”, “render preview”, code editor or component selector.
- Every material, generation task, proposal, validation and evidence request carries the route `projectId`; the server reauthorizes principal + project + object on every request. Client cache keys include principal and `projectId` and are cleared on switch/logout.
- Proposal output, prompts, evidence, raw provider responses, costs and task diagnostics are never stored in `localStorage`, `sessionStorage` or IndexedDB. API keys never enter the browser or logs. Console reporting redacts prompt/content and opaque identifiers where possible.
- Source links use same-origin opaque IDs and exact authorized evidence locators. The browser never constructs filesystem paths, signed secrets or cross-project URLs from model output.

## 15. Copywriting contract

| Element | Exact contract |
|---|---|
| Phase boundary | “AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本.” |
| Proposal detail boundary | “这是相对于发布版本 {version} 的结构化建议；尚未写入草稿，也未发布.” |
| Create pending | “正在创建生成任务…” |
| Provider disabled | “更新生成当前未启用；材料、证据和已有提案仍可查看.” |
| No proposals | “尚未生成结构化更新提案” |
| Validation failed | “提案未通过服务端校验，未写入项目草稿或发布版本.” |
| Retriable task failure | “更新生成暂时失败，未影响项目数据.” |
| Stale base | “发布版本已变化；此任务不会自动改用新版本.” |
| Unpriced usage | “未配置单价，仅记录 Token” |
| Phase 6 actions | None; no accept/reject/edit/merge/preview/publish/rollback control exists |

## 16. Browser acceptance matrix

| Viewport / scenario | Blocking acceptance |
|---|---|
| 1440×900, Xugu proposal workspace | 76px white header, warm canvas, horizontal module navigation, campaign terminology, proposal/task summary and no dark admin sidebar |
| 1440×900, standard workspace | Same fixed renderer with standard terminology; no 作战/战役/战果/作战单元 leak |
| Material generation entry | Ready material shows template/base/evidence/grant/boundary; ineligible states show exact prerequisite and cannot create a task |
| Multi-material task | 1–8 same-project, same-template, ready materials can be selected; mixed template, stale generation, unauthorized and ninth material fail closed |
| Idempotency/quota/concurrency | Double submit returns one task; per-minute/daily/concurrency errors retain safe selection and show server retry/reset values |
| Task lifecycle | Queued through validation and all terminal states render textually; refresh resumes, hidden page throttles polling and no fabricated percentage appears |
| Provider disabled/failure | Existing project/material/proposal views remain usable; no draft/published mutation, key field or raw diagnostic appears |
| Validated proposal | Fixed renderer shows base/Schema/template, structured changes, semantic types, confidence, warnings and exact evidence links |
| Evidence/high-impact gate | Completion/progress/metric/date/owner/outcome without direct evidence is blocked and creates no proposal |
| Dependency/date/duplicate gates | Cycle, invalid date/order, duplicate ID/name and conflicting operations show deterministic blocking validation results |
| Cross-project/version gates | Foreign material/evidence/target and stale base are rejected; project switch clears prior task/proposal content before new render |
| Phase boundary | DOM, network and keyboard flows contain no accept/reject/edit/merge/draft-preview/publish/rollback action and no write to version pointers |
| Role/capability matrix | Admin/editor/viewer see only server-granted generation/grant/retry/read controls; denied direct requests remain uniform 404 |
| Usage/cost | Every attempt and aggregate tokens are shown; priced and unpriced states are honest, with no API key, prompt or raw provider response |
| 1024×768 | Stacked context, two-column summaries/card lists, usable horizontal module navigation and only labeled local overflow |
| 390×844 | One-column cards, bottom sheet, native change selector, 40px targets, wrapped IDs/validation/evidence and no page overflow |
| Keyboard/reduced motion | Local/sub-tabs, selection sheet, task timeline, change index, disclosures and evidence navigation complete without pointer; polling does not steal focus |
| Security payload | HTML/SVG/event/URL/code/prompt-injection payloads render as text or fail closed; no script/tool execution, external fetch or payload console dump |
| Reference integrity | Read-only Xugu reference HEAD, `git status --short` and sanitized seed SHA-256 remain unchanged before/after implementation verification |

## 17. UI acceptance definition

Phase 5 UI is accepted only when both project templates can start a bounded generation task from eligible project-scoped materials, track every attempt and usage state, and inspect a server-validated, evidence-linked, version-locked structured proposal through fixed renderers. All validation failures must be honest and non-destructive; project switching, authorization and untrusted text must fail closed. The three viewports, keyboard flow and security matrix must pass, while the UI contains no Phase 6 review, draft merge, preview, publish or rollback action.
