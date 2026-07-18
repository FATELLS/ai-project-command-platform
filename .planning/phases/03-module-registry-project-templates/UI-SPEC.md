---
phase: 03-module-registry-project-templates
status: accepted
date: 2026-07-18
design_system: local-semantic-html-css-dom
registry: none
---

# Phase 3 UI Design Contract

## 1. Design intent and boundaries

Phase 3 extends the verified Xugu-aligned project shell into nine fixed, data-driven modules. Desktop remains the primary composition: a 76px white header, warm command canvas, left-mission/right-status Hero, horizontal module navigation, and rounded white section cards. It must not become a dark-sidebar SaaS interface.

The same repository-local renderers serve `campaign-map-v1@1.0.0` and `standard-project-v1@1.0.0`. Templates may select terminology, theme preset, module order, enabled state, and allowlisted view variants; they may not supply HTML, CSS, JavaScript, component names, SVG markup, or executable URLs.

Public module pages read one authorized `published` version snapshot. Module configuration writes only `draft`; Phase 3 provides no publish, merge, proposal, material-upload, or rollback action. Disabling a module hides it from published navigation only after a later publish and never deletes its facts.

Sources: Phase 3 `CONTEXT.md` and `RESEARCH.md`, D-003/D-010/D-011/D-012, Phase 2 `UI-SPEC.md` and `VERIFICATION.md`, current `public/` frontend, and the read-only Xugu reference application.

## 2. Visual contract

### Tokens

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
--canvas: #f4f7fb;
--line: #dce5f1;
--danger: #c8443a;
--shadow-card: 0 12px 34px rgba(18, 48, 91, 0.09);
--radius-card: 18px;
--radius-control: 10px;
```

- Spacing scale: `4, 8, 16, 24, 32, 48, 64px`; 40px controls and 76px header are component dimensions, not new spacing tokens.
- Font stack: `Inter`, `PingFang SC`, `Microsoft YaHei`, system sans-serif; no remote font request.
- Exactly four text sizes: 12px metadata, 14px body/control, 16px lead/status, and 28px page/module/Hero heading.
- Exactly two weights: 500 and 700. Body line-height is 1.6; headings are 1.2.
- Color allocation: about 60% white/warm canvas, 30% navy/blue structure, at most 10% accent.
- Orange is reserved for the active roadmap stage, current focus marker, Hero mission chip, and high-attention primary action. Green is reserved for confirmed active/completed states. Red is reserved for validation errors and destructive actions; risk severity still includes a text label and icon.
- Every theme preset maps only to approved CSS custom properties. Project data never becomes a raw CSS value.

### Frame

- At 1280px and above, content width is at most 1460px with 32px side gutters. The project Hero keeps the Xugu 1.25fr/0.85fr mission-status split.
- The Hero appears on Overview only. Other module pages use a compact heading row containing template-resolved eyebrow, module title, one-sentence purpose, published-version badge, and last-updated value.
- Each module owns one primary white card. Supporting details sit below or beside it; avoid a dashboard of unrelated equal-weight cards.
- No global left rail. A visualization may have a local legend or unit selector, but it must not resemble primary navigation.

## 3. Horizontal module navigation

The module navigation is a sticky white card directly below the Hero on Overview and below the compact heading on other module pages.

- Render only enabled published modules, in the server-provided `position` order. Never hardcode Xugu order in the browser.
- Each item is a real link to `/projects/:projectId/modules/:moduleType`; Overview links to `/projects/:projectId` and may also accept `/modules/overview` as a canonical redirect.
- Active item uses blue text and a 2px blue underline. Inactive items use `ink-600`; hover uses `blue-100`. Status is not communicated by color alone: active link has `aria-current="page"`.
- Desktop shows all nine items when they fit; otherwise the row scrolls horizontally with visible edge fade and previous/next scroll buttons. Tablet and mobile always use horizontal scrolling with scroll snapping.
- Keyboard focus must bring the item fully into view. Left/Right moves focus between tabs; Enter follows the link. Browser Back/Forward restores module and any URL-backed filter.
- Do not show disabled modules as “即将开放” once Phase 3 is complete. A disabled module is omitted from public navigation and returns the same project-safe 404 as an unavailable module.

Default order for both templates: Overview, Roadmap, Units, Task Network, Gantt, Outcomes, Risks, Metrics, Materials. Project draft configuration may change enabled state and order, except Overview is required and fixed enabled.

## 4. Template presentation contract

| Contract | `campaign-map-v1@1.0.0` | `standard-project-v1@1.0.0` |
|---|---|---|
| Header/Banner | `XUGU AGENTIC GROUP SCHEDULE` or project-configured campaign banner | `STANDARD PROJECT SCHEDULE` or project-configured standard banner |
| Core terms | 作战总览、作战单元、行动任务、战役节点、战果档案、公司级战线 | 项目总览、团队、任务、里程碑、交付物、工作流 |
| Theme | `xugu-blue`: white/warm canvas, navy structure, blue route, orange current stage | `neutral-blue`: same frame, less decorative campaign imagery, neutral gray-blue structure |
| Roadmap | Curved/branching `campaign-network`, closures between stages, workstream cards | Ordered `linear-roadmap`, milestone cards, workstream summary |
| Task network | `branching-network` grouped by campaign unit | `dependency-list` with optional network view, grouped by team |
| Gantt | `branching` lanes with dependency/merge emphasis | `lanes` with team swimlanes and milestones |
| Outcomes | `closure-detail`, battle-result archive language | `archive-grid`, deliverable language |
| Empty copy | Uses honest campaign terms | Contains no 作战、战役、战果、作战单元 terms |

`xugu-agentic-group` must preserve stable ID, v4.2, 7 units, 29 tasks, 6 stages, 2 closures, and 4 workstreams. A new standard project with different counts and dates must render without code changes or Xugu-specific copy.

## 5. Module information architecture

### 5.1 Overview

- Primary anchor: existing two-column project Hero with project name, stable ID, template/status/version badges, summary/goal, and current-status panel.
- Below Hero: four factual cards resolved by terminology (units, tasks, roadmap stages, workstreams), then current-stage and published-data boundary panels.
- Show `overallProgress` only when explicitly present. Null copy is “暂无正式完成率”; never calculate a percentage from dates or task counts.
- Empty: keep the Hero and show “项目概览尚待补充” plus template-specific guidance; factual cards show `0` only for authoritative counts, not for unknown progress.

### 5.2 Units / Teams

- Primary anchor: responsive card grid, one card per unit/team. Card contains stable short mark, name, owner or “负责人待确认”, objective, current work, expected output, source label, and factual task count.
- Selecting a card opens an in-page detail panel or navigates to `?unit=:id`; it does not open an editing dialog. The panel lists members only when provided and links to the same unit filter in Task Network and Gantt.
- Campaign cards may use stronger blue/orange unit marks; standard cards use the same structure with team language.
- Empty campaign: “尚未建立作战单元”；empty standard: “尚未建立团队”。Supporting sentence explains that confirmed project data is required.

### 5.3 Roadmap

- Primary anchor: title/legend, then a data-driven SVG route and a keyboard-equivalent ordered stage list. The SVG contains only renderer-generated paths and shapes.
- Each stage shows sequence, title, date/status label, and current/completed/planned text. Current stage is orange; completed is blue/green; planned is neutral.
- Closures are selectable markers between referenced stages. Selection updates a detail card below the route with title, date, state, description, result, source, and allowlisted previews.
- Campaign view uses a curved branching path and four workstream cards below. Standard view uses a linear milestone sequence and workstream summary. Layout must handle arbitrary stage/workstream counts.
- Empty: “尚未建立战役路线” / “尚未建立项目路线”。No decorative fake nodes are rendered.

### 5.4 Task Network

- Primary anchor: unit/team selector plus a fixed-renderer dependency graph. Nodes display title, parent/action/milestone type, owner, and state. Directed edges distinguish hierarchy and dependency in both line style and legend text.
- Selecting a node opens a detail card with parent, predecessors, dependents, dates, expected output, and source if present. URL stores `?unit=:id&task=:id`.
- Campaign view shows branching and merge points. Standard default is an accessible dependency list grouped by team; a “网络图 / 依赖列表” segmented control may switch between its two allowlisted fixed views.
- A graph with more than 40 visible nodes defaults to grouped/collapsed units and provides “展开本组”; it must not render unreadable text at reduced scale.
- Empty: “暂无行动任务” / “暂无任务”。Invalid or cyclic server data uses the module error state, never a partial misleading graph.

### 5.5 Gantt

- Primary anchor: sticky left unit/team column, computed time scale, grouped lanes, task bars, milestone diamonds, and dependency/merge markers. Dates define the scale; no fixed 2026 month range is allowed.
- Each bar shows task name when space permits and always has an accessible name containing task, owner, start/end, and state. Selecting it opens the same task detail model as Task Network.
- Tasks without valid dates appear in a separate “待排期” lane and are never assigned invented bar positions. Null progress is omitted rather than shown as 0%.
- Campaign view emphasizes branch/merge flow; standard view uses conventional team swimlanes. Both show a textual table alternative.
- Empty: “暂无可展示的甘特任务”；if tasks exist but none are scheduled, show the unscheduled lane and guidance rather than the general empty panel.

### 5.6 Outcomes / Deliverables

- Primary anchor: campaign closure detail or standard deliverable grid. Each record shows title, date label, explicit state, description, result, source, and local allowlisted preview count.
- Preview assets open in an accessible lightbox with previous/next, filename/description, Escape close, focus trap, and focus return. Broken/blocked assets show a neutral placeholder without retrying external URLs.
- Campaign outcomes project existing closures and retain “战果闭环/战果档案” semantics. Standard uses “交付物” and never implies completion without a stored state.
- Empty: “暂无已归档战果” / “暂无已登记交付物”。

### 5.7 Risks

- Primary anchor: severity/status summary chips followed by a risk register. Desktop columns: risk, severity, status, owner, mitigation, due date, source. Tablet/mobile use cards.
- Default sort is severity then due date. Filter state uses URL parameters. Severity and status always include text; do not rely on red/amber/green alone.
- Empty copy is exactly “暂无已登记风险”; supporting copy is “这表示尚未录入风险，不代表项目已确认无风险。”

### 5.8 Metrics

- Primary anchor: metric cards containing name, factual value or “待补充”, unit, status, as-of date, target, and source. A target is visually labeled “目标” and is never substituted for a missing value.
- Cards order follows module payload position. No charts are drawn from a single value; a trend chart requires explicit historical points and is outside the v1 contract.
- Empty copy is exactly “暂无已登记指标”; supporting copy asks an authorized editor to add verified values later without offering an edit action on the public page.

### 5.9 Materials

- Phase 3 always renders a secure contract state, not upload UI or sample materials.
- Show title, explanatory illustration made from local CSS/SVG shapes, count `0` only when authoritative, and exact copy: “项目材料功能将在下一阶段开放” / “当前页面不会读取或上传材料。”
- Do not show upload, drag-and-drop, question-answering, preparation, delete, or AI actions. The module remains a valid enabled module so the template contract can be proven end to end.

## 6. Loading, empty, error, and stale states

- Route change preserves the shell and navigation. The module content sets `aria-busy="true"` and shows skeletons matching the target structure: cards for Overview/Units/Metrics, rows for Risks, lanes for Gantt, and a fixed-height diagram placeholder for Roadmap/Task Network.
- Skeletons contain no fake names, dates, percentages, nodes, or task bars. After 10 seconds show “加载时间较长，请稍候…” without changing the request.
- Module fetch error: keep project identity and navigation visible; show “无法加载{模块名}” and primary action “重新加载模块”. Do not redirect unless the API returns 401.
- 401: clear project facts and return to login with “会话已过期，请重新登录”. Missing, unauthorized, archived, disabled, and unknown module routes use the uniform “项目或模块不存在，或你无权访问” with action “返回项目总览”.
- If an envelope has wrong `projectId`, version, schema, or view variant, do not render it. Show “模块数据版本不受支持” and action “重新加载模块”; log no project payload to the browser console.
- Empty states are module-specific as defined above. Empty never means error, loading, no risk, or completed work.
- Module reload replaces content atomically. Never mix Roadmap, Task Network, and Gantt data from different version envelopes.

## 7. Draft module configuration UI

Project admins and editors receive a “模块配置” action in the project header. It opens a 560px accessible right-side sheet on desktop and a full-width bottom sheet on mobile.

- Persistent banner: “正在配置草稿模块；当前发布页面不会立即变化。”
- List all nine registry modules using template-resolved names. Each row shows enabled switch, order number, fixed view label, required badge when applicable, and keyboard buttons “上移” / “下移”. Drag may be progressive enhancement only; buttons are the canonical accessible interaction.
- Overview is checked, disabled, and labeled “必填模块”. Other required template modules follow the same rule.
- Reordering normalizes positions to `0..8`. Disabled modules remain in the list and retain their data and relative order.
- Primary CTA is exactly “保存草稿配置”; pending label is “正在保存…”. Cancel label is “放弃本次修改”. Success toast: “草稿模块配置已保存”.
- Validation errors stay in the sheet and identify the affected module. Save is transactional; failure preserves the local form and shows “未能保存模块配置，请检查后重试”.
- Closing with unsaved changes opens a confirmation dialog: “放弃未保存的模块配置？” Actions: “继续编辑” and destructive “放弃修改”. No confirmation is needed for disabling a module because disabling does not delete data.
- The sheet exposes no Publish button and no raw JSON, schema, CSS, renderer key, component path, or arbitrary view name field.

## 8. Visualization behavior and accessibility

- Roadmap, Task Network, and Gantt must be readable at 1440px without page-level horizontal scrolling. Their content region may scroll horizontally when minimum readable geometry exceeds available width.
- A local scroll container must be keyboard focusable, have an accessible label, show an edge shadow when more content exists, and be followed by the full textual alternative.
- SVG elements are renderer-created, use stable data IDs only for event lookup, and expose an accessible title/description. Project text is inserted with DOM text APIs, never interpolated as markup.
- Node and task selection is available by pointer and keyboard. Visible targets are at least 40x40px; small diagram marks receive a larger invisible hit area.
- Focus ring is at least 3px blue with 3:1 contrast. One `h1` per route, logical heading order, and status never uses color alone.
- Respect `prefers-reduced-motion`; route drawing, node movement, bar animation, smooth scrolling, and lightbox transitions become instant or opacity-only.
- At 200% zoom on a 1280px viewport, the page itself has no horizontal overflow; only labeled visualization containers may scroll.

## 9. Responsive contract

### Desktop, 1280px and above

- Preserve the 76px white header, full project switcher, two-column Hero, full horizontal module row, and Xugu-scale visualizations.
- Roadmap/Task Network minimum diagram viewport is 720px high enough to avoid label collisions; Gantt keeps a 220px sticky label column.

### Tablet, 768-1279px

- Header compacts but keeps brand, project switcher, and identity. Hero becomes a balanced two-column layout until 900px, then stacks.
- Module navigation scrolls horizontally. Unit/metric cards use two columns. Risk register becomes cards below 900px.
- Visualization controls wrap above the local scroller; no control overlays diagram content.

### Mobile, below 768px

- Compatibility fallback only: single column with 16px gutters; it must not redefine desktop information hierarchy.
- Hero stacks mission before status. Module navigation is a single-line scroll row with 40px targets.
- Roadmap defaults to its ordered stage list with an optional “查看路线图”; Task Network defaults to dependency list; Gantt defaults to textual grouped schedule with “查看时间轴”. The full visualization opens within the page in a labeled horizontal scroller, not a modal.
- Unit, outcome, risk, and metric content becomes one-column cards. Lightbox uses the full viewport. The configuration sheet becomes a bottom sheet with sticky actions.
- No page-level horizontal overflow at 390x844.

## 10. Security and registry contract

- Component tool: none. The project is not React/Next.js/Vite and has no `components.json`; shadcn initialization is not applicable.
- Registry: repository-local fixed renderers only. Third-party registries, remote blocks, CDN scripts, icon fonts, and project-supplied executable assets are prohibited.
- The browser selects renderers from the local nine-type map. Unknown module types or view variants fail closed.
- All project strings render through `textContent`/safe attributes. Asset references must be same-origin allowlisted IDs; reject `javascript:`, data HTML, external dynamic imports, and project-provided SVG/HTML.
- Server authorization and `projectId`/version validation remain authoritative. Hidden controls are not permission enforcement.

## 11. Browser acceptance matrix

| Viewport / scenario | Required acceptance |
|---|---|
| 1440x900, Xugu Overview | 76px white header, warm canvas, two-column Hero, correct v4.2 facts, horizontal nine-module navigation, no dark sidebar |
| 1440x900, Xugu Roadmap | 6 stages, 2 selectable closures, 4 workstreams, orange current stage, complete ordered text alternative |
| 1440x900, Xugu Task Network | 7 unit groups, 29 tasks across the payload, hierarchy/dependency legend, node selection synchronized with detail |
| 1440x900, Xugu Gantt | Real date-derived scale, grouped lanes, dependencies/merges, undated tasks only in “待排期”, textual alternative |
| 1440x900, Xugu Outcomes | Both closure-derived outcome records retain state/source semantics; previews are same-origin and keyboard accessible |
| 1440x900, standard project | Same frame but standard terminology, linear roadmap, dependency-list default, lane Gantt, deliverable language; no Xugu terms |
| Two-project switch | Switching Xugu ↔ standard changes URL, template/version, module order/titles/views, facts, Banner, and empty copy atomically with no crossover |
| Draft module config | Admin/editor can reorder and disable optional modules, Overview cannot be disabled, save is transactional and does not change published navigation |
| Viewer permissions | Viewer sees published enabled modules only and no “模块配置”; direct draft/config requests are rejected by server |
| Loading/error/empty | Each of the nine modules has stable skeleton, exact honest empty copy, retryable error, and no fabricated facts |
| 1024x768 | Scrollable module row, two-column cards where specified, local visualization scroll only, no page-level overflow |
| 390x844 | Single-column fallback, list-first Roadmap/Network/Gantt, 40px targets, usable bottom sheet, no page-level overflow |
| Keyboard/reduced motion | Header, module row, visualization selection, lightbox, filters, and config sheet complete without pointer; reduced motion removes nonessential animation |
| Security payload | `<script>`, event handlers, `javascript:` URLs, HTML/SVG strings, unknown type/schema/view render only as text or fail closed; no browser code execution |
| Reference integrity | Xugu reference HEAD, `git status --short`, and seed SHA-256 are unchanged before/after browser verification |

## 12. Definition of UI acceptance

Phase 3 UI is accepted only when both templates render all nine registered module routes from data, Xugu retains its verified visual/data semantics, the standard project shows its own terminology and arbitrary counts/dates without code changes, draft module configuration cannot alter published state, and the desktop/tablet/mobile browser matrix passes without project-level data or copy crossover.
