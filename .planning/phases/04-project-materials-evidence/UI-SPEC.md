---
phase: 04-project-materials-evidence
status: accepted
date: 2026-07-18
design_system: local-semantic-html-css-dom
shadcn_initialized: false
preset: none
registry: none
---

# Phase 4 UI Design Contract

## 1. Design intent and phase boundary

Phase 4 turns the verified Materials placeholder into a project-scoped evidence workspace: a material ledger, gated upload queue, material/evidence detail, update-template selection, and project-internal read-only Q&A with citations. It extends the Phase 3 shell rather than creating a new administration product.

The desktop composition remains the accepted Xugu frame: 76px sticky white header, warm command canvas, compact module heading, horizontal module navigation, and rounded white content cards. `campaign-map-v1` and `standard-project-v1` use the same repository-local renderer and interaction model; only server-resolved terminology, theme preset, and copy variants differ.

This phase may archive and preprocess material, create source-locatable evidence blocks, record an update-template intent, and answer questions from the current project's published snapshot plus Q&A-authorized material. It must not create `ChangeProposal`, offer AI-generated project updates, write `draft` or `published`, review differences, merge, publish, or roll back. No button may be labeled “生成提案”“应用更新”“合并草稿” or “发布”.

Sources: `AGENTS.md`, project memory, Phase 3 `CONTEXT.md`/`RESEARCH.md`/`UI-SPEC.md`/`VERIFICATION.md`, Phase 4 `CONTEXT.md`/`RESEARCH.md`/`FRAMEWORK.md`/`AI-GUIDE.md`/`DOMAIN.md`, the current `public/` frontend, and the read-only Xugu material/Q&A interface. This contract absorbs the Phase 4 research limits, security boundaries and evidence-locator model; remaining visual details below use explicit defaults.

## 2. Design system and visual tokens

| Property | Contract |
|---|---|
| Tool | Repository-local semantic HTML, CSS and DOM APIs |
| Component library | None |
| Icon library | Local inline SVG symbols or CSS shapes only |
| Font | `Inter`, `PingFang SC`, `Microsoft YaHei`, system sans-serif; no remote request |
| Registry | None; third-party blocks, CDN scripts and project-supplied components are prohibited |

```css
--navy-950: #071a3d;
--navy-800: #0b2c68;
--blue-600: #1265f2;
--blue-100: #eaf2ff;
--orange-600: #ff6422;
--orange-100: #fff0e7;
--green-600: #15966b;
--green-100: #e9f8f2;
--ink-900: #172943;
--ink-600: #5f7088;
--ink-400: #8290a4;
--surface: #ffffff;
--canvas: #f8fbff;
--line: #dce5f1;
--danger: #c8443a;
--warning: #a86118;
--shadow-card: 0 12px 34px rgba(18, 48, 91, 0.09);
--radius-card: 18px;
--radius-control: 10px;
```

- Spacing scale is exactly `4, 8, 16, 24, 32, 48, 64px`. The 40px minimum target, 76px header, 6px progress bar and preview dimensions are component dimensions, not spacing tokens.
- Typography uses exactly four sizes: 12px metadata, 14px body/control, 16px lead/status, and 28px route/card heading. It uses exactly two weights: 500 and 700. Body line-height is 1.6; heading line-height is 1.2.
- Color allocation is approximately 60% white/warm canvas, 30% navy/blue structure, and at most 10% accent/semantic color.
- Blue is reserved for navigation, links, selected local tabs and normal primary actions. Orange is reserved for the material-intake eyebrow, active upload drop target, selected evidence locator and other current-focus markers. Green means gate passed/ready/authorized. Amber means waiting/attention. Red means error or destructive semantics only. Every status includes text and, where compact, an icon; color is never the sole signal.
- Theme configuration may select approved CSS tokens only. Filenames, extracted content, template labels and project data never become raw CSS, HTML or SVG.

## 3. Frame, routes and local navigation

- Keep the 76px sticky white header, warm background image/canvas, max 1460px content width and horizontal project-module navigation from Phase 3. No global left rail is introduced.
- The compact Materials heading contains the template-resolved eyebrow, module title, one-sentence purpose, published-version badge and project updated time. The module page does not repeat the Overview Hero.
- Canonical ledger route: `/projects/:projectId/modules/materials?view=ledger`.
- Canonical Q&A route: `/projects/:projectId/modules/materials?view=qa`.
- Canonical detail route: `/projects/:projectId/modules/materials/:materialId?evidence=:evidenceBlockId`.
- A two-item local tab list, “材料台账” and the resolved Q&A label, appears inside the Materials primary card. It uses real links, `aria-current="page"`, Left/Right roving focus, Enter activation and URL-backed state.
- A header shortcut may link to the Q&A route when the user has Q&A capability. It opens the canonical page; it does not create a separate global chat implementation.
- Back/Forward restores local tab, search/filter state, material and selected evidence block. Direct refresh retains the authenticated project shell and never falls back to a cross-project record.

## 4. Template terminology contract

| Element | `campaign-map-v1` default | `standard-project-v1` default |
|---|---|---|
| Module title | 项目材料 | 项目材料 |
| Intake eyebrow | BATTLE MATERIAL INTAKE | PROJECT MATERIAL INTAKE |
| Primary CTA | 上传作战材料 | 上传项目材料 |
| Manual-entry CTA | 填写人工材料 | 填写人工材料 |
| Q&A tab/title | 战情问答 | 项目问答 |
| Assistant label | 作战参谋 | 项目助手 |
| Input placeholder | 询问当前战况、作战单元、节点或行动任务… | 询问当前项目、团队、里程碑或任务… |
| Insufficient-data noun | 当前战情资料 | 当前项目资料 |

The API/template-resolved strings are authoritative. Standard projects must not display “作战”“战役”“战果”“作战单元”; campaign projects must preserve their accepted vocabulary. Project names and Xugu branding are never hardcoded into the shared renderer.

## 5. Materials ledger

### 5.1 Primary composition

The ledger is the default Materials view. Its visual anchor is one primary white card with, in order:

1. A summary strip containing total material count, evidence-ready count, Q&A-authorized count and storage used/limit.
2. A quota meter with text equivalents for per-file limit, project count/capacity, upload frequency, concurrent processing, and remaining Q&A calls. Values come from the server quota envelope; the browser does not infer or hardcode enforcement.
3. The CTA row: resolved upload CTA, “填写人工材料”, search, status/type filter and newest/oldest/name sort.
4. The ledger table on desktop or equivalent cards on smaller viewports.

Default acceptance fixture values mirror the stable Xugu baseline unless backend research changes them: single file 200 MB, project storage 300 MB, 100 records, 6 upload attempts/minute, 1 concurrent upload, Office expansion 80 MB and 2,000 archive entries. The UI always renders server-returned limits and retry time, so a deployment can lower them without copy drift.

### 5.2 Ledger row contract

Desktop columns are: material, type/template, processing state, evidence blocks, Q&A authorization, uploaded by/time, size and actions. Each row contains:

- Safe filename as the heading/link plus material category and optional note; long names wrap to two lines and expose the full name through accessible text.
- Update-template label or “未选择更新模板”.
- One explicit status: `门阀校验中`, `等待上传`, `上传中`, `预处理中`, `证据已就绪`, `需人工确认`, or `处理失败`.
- Evidence count as a link to detail only when at least one authorized block exists; zero means no block, not “no evidence needed”.
- Q&A state: “已授权问答”“未授权问答” or “不可用于问答”.
- Server-derived uploader, time and size; unavailable metadata uses “待补充”, never an invented value.
- Row actions use an overflow menu at desktop and explicit buttons on mobile: “查看材料”“重试处理” when allowed, and Q&A authorization control when allowed. Phase 4 exposes no permanent material-record deletion or original-cleanup control.

Search matches filename, note and server-provided source metadata. Filters are status, file type and Q&A authorization. Results update after 180–250ms debounce and mirror into query parameters. Pagination uses server cursors; do not load unbounded extracted content into the ledger.

### 5.3 Role and capability presentation

- `platform_admin` and `project_admin` may upload, submit manual material, change update-template metadata, retry preprocessing and change Q&A authorization when server capabilities allow.
- `project_editor` may upload, submit manual material, view authorized evidence and ask questions; Q&A authorization and retention controls are absent unless an explicit server capability grants them.
- `viewer` sees the ledger/detail/Q&A only to the extent returned by separate server capabilities; upload, metadata mutation, retry and authorization controls are absent.
- Capability flags, project authorization and material-level authorization are server authoritative. Hidden controls are never treated as enforcement. Direct denial stays inline and does not reveal whether another project's material exists.

## 6. Upload, manual material and gate feedback

### 6.1 Upload sheet

The resolved upload CTA opens a 640px right sheet on desktop/tablet and a full-width bottom sheet on mobile. It has a visible title, project identity, quota summary and these fields:

- File picker/drop zone supporting PDF, DOCX, PPTX, XLSX, TXT/MD/CSV/JSON/YAML, PNG/JPG/WebP. The picker permits a queue, but the client submits no more than the server-advertised concurrency.
- Material category: 会议纪要、计划、汇报、表格/数据、成果文件、图片 or 其他.
- Update template, required: 会议纪要、项目计划、进度汇报、指标数据、成果归档 or 新项目材料. Catalog IDs/versions come from the server.
- Material note, optional, maximum 500 characters with visible remaining count.
- Fixed boundary note: “本阶段仅记录更新意图并形成证据；不会生成变更提案，也不会修改项目草稿或发布版本。”

Primary action is “开始上传”; pending action is “正在上传…”. A queued, uncommitted item uses “移除待上传文件”; an active byte transfer uses “停止上传此文件”; the sheet dismiss action is “关闭上传面板”. Leaving the project with unfinished byte uploads triggers “离开将停止当前文件上传；尚未开始的文件将从队列移除”; already accepted server preprocessing continues and is visible on return.

The drop zone is not the only file input: it has a visible “选择文件” button and supports keyboard activation. Drag-enter uses orange border plus the text “松开以上传到当前项目”. The current project name and stable ID remain visible in the sheet to prevent wrong-project intake.

### 6.2 Progress queue

- Each file is one queue row with filename, byte size, gate state, text status, a state-specific action (“重新上传此文件”“移除待上传文件” or “停止上传此文件”) and a 6px determinate progress bar only while bytes are transferred.
- Preprocessing and evidence indexing use an indeterminate status with elapsed label, never a fabricated percentage.
- Gate order shown to the user is type → signature → capacity/count → SHA-256 duplicate → rate/concurrency → archive expansion. The server may execute checks differently, but UI reports only the decisive safe result.
- Successful handoff copy is “材料已归档，正在生成可定位证据”. Evidence-ready copy is “证据已就绪”. A status toast supplements but never replaces the persistent queue/ledger state.
- A duplicate is not uploaded again. Copy: “相同内容已归档：{existingFileName}”; action: “查看已归档材料”. The link resolves only when the duplicate belongs to the same authorized project.
- Signature mismatch copy: “文件内容与扩展名不一致，已停止上传。请确认文件来源后重试。”
- Unsupported type copy: “不支持此文件类型。请上传 PDF、DOCX、PPTX、XLSX、文本、图片，或使用人工表单。”
- Capacity copy: “项目材料配额已用完，当前无法继续上传。” No fake cleanup action is offered.
- Rate/concurrency copy: “上传过于频繁，请在 {retryAfter} 后重试。” / “已有材料正在上传或预处理，请等待后再试。”
- Archive gate copy: “文件展开后超过安全限制，已停止处理。请压缩内容或拆分文件后重试。”

### 6.3 Manual material

“填写人工材料” opens an accessible form with title, material category, source/发生日期, contributor, update template, body and note. Body is required and plain text only. Submit label is “归档人工材料”; success creates a material record and paragraph-located evidence blocks. The form does not update project facts.

## 7. Material detail and evidence positioning

### 7.1 Detail frame

The detail route preserves the project header and horizontal module navigation. A “返回材料台账” link precedes one `h1` containing the safe filename. Beneath it, a metadata strip shows material type, processing state, update template, uploaded by/time, original size, SHA-256 fingerprint, evidence count and Q&A authorization.

Desktop uses a 300px evidence index plus a `minmax(0, 1fr)` preview/detail area. Tablet uses a collapsible evidence index above the preview. Mobile uses a native select labeled “选择证据位置”, followed by the selected block; it never forces a three-column document viewer.

Original download/preview and preprocessed text are distinct capability-gated actions. If the original is retained but not safely previewable, show “此格式不支持浏览器内预览” and an authorized download action. If no longer available, show “原件当前不可用；证据摘要与追溯信息仍保留.” Never retry or embed an external URL.

### 7.2 Evidence block contract

Each evidence button and detail card contains an immutable block ID, safe summary/excerpt and one human-readable locator:

| Source | Required locator label | Preview behavior |
|---|---|---|
| PDF/PPTX | `第 {n} 页` / `第 {n} 张幻灯片` | Open safe same-origin page image/text and highlight the block region when coordinates exist |
| DOCX/text/manual form | `第 {n} 段` plus optional heading path | Scroll the extracted plain-text preview to the selected paragraph |
| XLSX/table | `{sheetName} · 表 {n} · {cellRange}` | Show a bounded, escaped table slice with row/column headings |
| Image | `图 {n}` plus optional region label | Show same-origin raster preview with a renderer-created outline; alt text includes the locator and summary |

- If a source lacks reliable coordinates, show the exact available page/paragraph/table/image label and “未提供精确区域”; never invent a bounding box.
- Selecting a block updates `?evidence=:id`, moves an orange focus marker, scrolls the preview without stealing keyboard focus, and updates an `aria-live="polite"` summary.
- The selected detail shows source filename, full locator, concise excerpt/summary, extraction time and provenance warning when applicable. It does not mark an assertion as a published fact merely because it exists in a material.
- “复制证据链接” copies the same-project canonical detail URL. Q&A citations use this URL. It contains opaque stable IDs, not filesystem paths, signed secrets or extracted text.
- Evidence index supports filename/block search and location filters, but always displays a full textual alternative to visual highlighting.

## 8. Update-template selection boundary

Update-template selection is material metadata for future Phase 5 generation. The selected item is versioned and visible in the upload sheet, manual form, ledger row and detail metadata.

- The six default labels are 会议纪要、项目计划、进度汇报、指标数据、成果归档 and 新项目材料; IDs/versions are server-provided and allowlisted.
- Changing the selection uses “保存材料用途” and confirms “更新模板已记录”. It does not start a job, contact a generation model, create a proposal or alter `draft`/`published`.
- Unknown/deprecated template IDs render “更新模板不可用” with action “重新选择”; the browser does not substitute a default silently.
- No free-text schema, prompt, renderer name, model selector or code field exists.

## 9. Project-internal read-only Q&A

### 9.1 Composition and copy

The Q&A view is project-scoped and read-only with respect to project state. Its fixed boundary banner reads: “只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。”

Desktop uses a 280px context panel and a conversation column. The context panel shows current project, published version, number of Q&A-authorized materials, quota remaining/reset time and “查看授权来源”. Tablet/mobile stack the context summary above the conversation.

The empty conversation starts with the template-resolved assistant label, boundary copy and at most three template-aware suggestion buttons. Campaign defaults are “当前战役路线进行到哪里？”“哪些行动任务存在风险？”“最近归档了哪些战果依据？”; standard defaults are “当前项目里程碑进展如何？”“哪些任务存在风险？”“最近有哪些交付物依据？”. The form has a visible “问题” label, 1,000-character textarea, remaining count and primary CTA “发送问题”; pending label is “正在查找依据…”. Enter submits only with Ctrl/Cmd+Enter; plain Enter creates a newline.

### 9.2 Answer and citation contract

- An answer begins with natural-language text, followed by optional structured points, then a mandatory “引用来源” list when any factual claim is made.
- Inline citation markers `[1]`, `[2]` are real buttons/links with accessible labels such as “引用 1：季度计划，第 4 页”. Activating one opens the authorized material detail at the cited evidence block and returns focus correctly with Back.
- Each citation includes source title, exact page/paragraph/table/image locator and whether it came from the published project snapshot or authorized material. A filename-only source is insufficient.
- When evidence is missing or conflicting, exact core copy is “现有资料不足以回答这个问题。” Supporting text may identify the missing source or conflict, but must not invent progress, dates, owners, outcomes or metrics.
- Q&A conversation context is cleared on project switch, logout or session expiry. Material text, answers and citations are not stored in `localStorage`, `sessionStorage` or IndexedDB.
- Q&A authorization is separate from original access and preprocessing. A citation may expose an evidence summary while the original-download action remains absent.
- Quota exhaustion keeps the conversation visible and disables submit until the server-provided reset time. Copy: “本项目问答配额已用完，可在 {resetTime} 后继续提问。”
- Failure copy: “暂时无法完成项目问答。已保留你的问题，请稍后重试。” Action: “重新发送”. A failed answer never appears as an assistant factual message.

## 10. Loading, empty, error and recovery states

- Route changes preserve shell and horizontal navigation. The content region uses `aria-busy="true"` and structure-matching skeletons: summary/rows for ledger, queue rows for upload, index/preview for detail, and message blocks for Q&A. Skeletons contain no fake filenames, quotations, locators, usage values or answers.
- After 10 seconds append “加载时间较长，请稍候…” without starting another request.
- Empty ledger heading: “尚未归档项目材料”. Body, campaign: “上传会议纪要、作战计划、汇报、表格、成果或图片，建立可追溯的项目证据。” Body, standard: “上传会议纪要、项目计划、汇报、表格、交付物或图片，建立可追溯的项目证据。” Primary empty action is the resolved upload CTA.
- Empty evidence: “该材料尚未形成可定位证据”. Supporting copy distinguishes waiting, failed and unsupported states and offers only a capability-authorized retry.
- Empty Q&A sources: “暂无可用于问答的授权材料”. Supporting copy notes that published project facts remain available only when the server says so; it never claims a complete knowledge base.
- Ledger error: “无法加载材料台账” / “重新加载材料”. Detail error: “无法加载材料详情” / “返回材料台账”. Q&A error follows Section 9.2.
- 401 clears material/evidence/Q&A content and returns to login with the accepted session-expiry copy. Missing, unauthorized, archived, cross-project and unknown material IDs use the uniform “材料不存在或你无权访问” and never disclose existence.
- Envelope project/template/version mismatch, unknown locator type or unsupported contract version fails closed with “材料数据版本不受支持” and action “重新加载材料”; no payload is logged to the console.

## 11. Accessibility and keyboard contract

- One `h1` per route and logical heading order. Tabs, form fields, progress status, tables/cards, citations and evidence locators have visible accessible names.
- Minimum pointer target is 40×40px. Focus ring is at least 3px blue at 3:1 contrast. Focus order follows visual order.
- Upload and manual-entry sheets use `aria-modal`, initial focus, focus trap, Escape close when no final transaction is committing, and focus return. Pending committed work cannot be dismissed without its status remaining available in the ledger.
- Upload progress exposes filename, bytes/total and text state via `aria-live="polite"`; it does not announce every percentage tick. Errors use `role="alert"` next to the affected file.
- Desktop ledger uses a semantic table with a caption and sortable button labels. Tablet/mobile cards retain the same label/value relationships.
- Evidence list uses buttons or links, not clickable `div`s. Page/paragraph/table/image location is always available as text. Table slices retain row/column headers.
- Q&A messages identify speaker and citations programmatically. New assistant answers receive polite announcement; focus remains in the question field unless the user follows a citation.
- At 200% zoom on a 1280px viewport there is no page-level horizontal scrolling. A bounded table/document preview may scroll horizontally only with an accessible label and visible edge cue.
- `prefers-reduced-motion` removes smooth scrolling, progress shimmer and preview transitions. It does not hide upload/evidence status.

## 12. Responsive contract

### Desktop — 1280px and above

- Preserve 76px header, full switcher and horizontal nine-module navigation. Content uses 32px side gutters and at most 1460px width.
- Ledger uses a semantic table; summary/quota strip fits one row. Detail uses 300px evidence index plus preview. Q&A uses 280px context panel plus conversation.
- Upload is a right sheet, never a browser file prompt as the sole workflow.

### Tablet — 768–1279px

- Header compacts while retaining brand, project switcher and identity. Module navigation scrolls horizontally.
- Summary/quota cards use two columns. Ledger becomes labeled cards below 900px. Detail evidence index collapses above preview. Q&A context stacks above conversation.
- All wide preview content scrolls locally; no page-level overflow at 1024×768.

### Mobile — below 768px

- Single column with 16px gutters; the 76px header may wrap its secondary controls into the established compact header but keeps the project switcher.
- Local tabs and module navigation are one-line horizontal scrollers with 40px targets. Summary cards use two columns; ledger rows become one-column cards.
- Upload/manual forms are bottom sheets with sticky actions. File queue, quota and gate error remain visible without hover.
- Detail uses a native evidence selector and text-first preview. Q&A context collapses to a summary card; citations wrap without clipping.
- No page-level horizontal overflow at 390×844. Document/table preview is the only permitted labeled local scroller.

## 13. Security and registry contract

- The project is native ESM/DOM, not React/Next.js/Vite; `components.json` is absent and shadcn initialization is not applicable.
- Registry safety: repository-local fixed renderers only. Third-party registries, remote blocks, CDN assets, icon fonts, external document viewers and project-supplied executable components are prohibited.
- File extension, MIME and client preview are advisory only. Server signature, size, digest, rate, concurrency and archive-expansion gates are authoritative before a material becomes visible as accepted.
- All filenames, notes, extracted text, evidence excerpts, table cells, Q&A text and citations render with text DOM APIs/safe attributes. Material content is untrusted data; prompt-like instructions are displayed/searchable but never executed as system/tool instructions.
- Previews use same-origin opaque material/evidence IDs and allowlisted raster/text responses. Reject `javascript:`, data HTML/SVG, external dynamic imports, filesystem paths and arbitrary iframe sources. Downloads use safe `Content-Disposition` and never infer a path from filename.
- Every material, evidence, upload, quota and Q&A request carries the route `projectId`; the server reauthorizes project and object membership. Cache keys include principal and `projectId`. Switching project clears prior material/Q&A UI before rendering the new response.
- Original file, preprocessed text, evidence summary, Q&A authorization and published snapshot remain separately authorized. Seeing a ledger row does not imply original download access.
- No material content, original, preprocessed text, runtime upload, Q&A transcript or logs are committed to Git or written to browser persistent storage.

## 14. Copywriting contract

| Element | Exact contract |
|---|---|
| Primary CTA | Campaign “上传作战材料”; standard “上传项目材料” |
| Secondary intake CTA | “填写人工材料” |
| Upload submit | “开始上传” / pending “正在上传…” |
| Empty ledger | “尚未归档项目材料” plus template-specific body from Section 10 |
| General ledger error | “无法加载材料台账” + “重新加载材料” |
| Evidence-empty | “该材料尚未形成可定位证据” |
| Q&A boundary | “只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。” |
| Insufficient answer | “现有资料不足以回答这个问题。” |
| Update-template boundary | “本阶段仅记录更新意图并形成证据；不会生成变更提案，也不会修改项目草稿或发布版本。” |
| Destructive confirmation | None; Phase 4 exposes no permanent delete or original-cleanup action |

## 15. Browser acceptance matrix

| Viewport / scenario | Blocking acceptance |
|---|---|
| 1440×900, Xugu ledger | 76px white header, warm canvas, campaign wording, horizontal module navigation, ledger/quotas visible, no dark sidebar |
| 1440×900, standard ledger | Same renderer/frame with standard wording; no 作战/战役/战果/作战单元 copy |
| Two-project same-name upload | Identical filenames can exist in two authorized projects; each route/ledger/evidence/Q&A result contains only its own `projectId`; same-project digest duplicate is blocked |
| Upload happy path | File selection, update-template requirement, gate states, byte progress, indeterminate preprocessing and evidence-ready transition are persistent and keyboard usable |
| Upload gate matrix | Capacity, count, type, signature, digest duplicate, frequency, concurrency, 80 MB/2,000-entry archive limits each show the specified safe error and never create a misleading accepted row |
| Manual material | Plain-text form creates a current-project record and paragraph-located evidence without changing published/draft project facts |
| Evidence detail | Authorized fixtures prove page, paragraph, table/cell and image locators; query deep link selects the correct block and all visual highlights have text equivalents |
| Update-template boundary | Six allowlisted choices can be recorded/versioned; DOM/network contains no proposal creation, model/prompt editor, draft merge or publish control |
| Q&A cited answer | Answer uses current published snapshot plus Q&A-authorized current-project evidence; every factual material citation deep-links to an exact locator |
| Q&A insufficient/conflict | Missing or conflicting sources produce the exact insufficiency copy and no invented progress, dates, owner, outcome or metric |
| Q&A quota/error | Remaining/reset state is visible; 429 disables submit until reset; retriable failure preserves the question without inserting a factual assistant response |
| Role/capability matrix | Admin, editor and viewer see only server-granted upload/retry/authorization/original/evidence/Q&A controls; direct denied requests remain denied |
| Empty/loading/error/session | Honest empty states, structure-matching skeletons, retryable errors, uniform 404, and 401 clearing of all material/Q&A content pass |
| 1024×768 | Two-column summaries, card ledger as needed, stacked detail/Q&A, horizontal module row and only labeled local preview overflow |
| 390×844 | One-column ledger, bottom-sheet upload, text-first evidence selector, wrapped citations, 40px targets and no page-level overflow |
| Keyboard/reduced motion | Header, module/local tabs, filters, upload sheet, queue, ledger, evidence, Q&A, citations and Back complete without pointer; reduced motion removes nonessential animation |
| Security payload | Malicious filename/note/table/Q&A content, HTML/SVG/event/URL/prompt-injection strings render only as text or fail closed; no external fetch, script execution, payload console dump or cross-project cache flash |
| Reference integrity | Read-only Xugu reference HEAD, `git status --short` and seed SHA-256 remain unchanged before/after implementation verification |

## 16. UI acceptance definition

Phase 4 UI is accepted only when both templates can archive project-scoped materials, show server-authoritative upload/quota feedback, navigate exact page/paragraph/table/image evidence, record an update-template intent without generating changes, and answer project-internal questions with exact citations and honest insufficiency states. The three viewports, keyboard flows, capability matrix and cross-project security cases must pass, while the verified Phase 3 shell and the prohibition on proposal/review/publish workflows remain intact.
