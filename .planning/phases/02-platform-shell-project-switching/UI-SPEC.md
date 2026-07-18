# Phase 2 UI Design Contract

Status: `accepted`
Date: 2026-07-18
Scope: login, authorized project home, search/filter/recent access, project administration, project switcher, and project detail shell.

## Design intent

The platform layer is a multi-project extension of the stable Xugu command-map interface. Its desktop frame should remain recognizably consistent with Xugu: white top navigation, warm command background, left-mission/right-status hero, rounded section cards, blue structure, and warm-orange focus. Multi-project capabilities are added through the project entry, switcher, filters, and administration controls instead of introducing a separate SaaS visual shell.

Phase 2 establishes navigation and information hierarchy. It does not implement the nine Phase 3 module renderers, task-network visualization, roadmap drawing, Gantt rendering, materials, AI proposals, or publishing.

## Visual tokens

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

- Font stack: `Inter`, `PingFang SC`, `Microsoft YaHei`, system sans-serif; no external font request.
- Body text is 14-16px. Compact bilingual command metadata is 9-12px; critical status and interactive labels remain at least 12px.
- Typography uses only weights 500 and 700; body line-height is 1.6 and compact controls use 1.35.
- Standard spacing scale is `4, 8, 16, 24, 32, 48, 64px`; component-specific values must be composed from this scale.
- Approximate color allocation is 60% white/canvas surfaces, 30% navy/blue structure and navigation, and at most 10% orange/green attention accents.
- Blue represents platform navigation and primary action. Orange marks current focus or high-attention action. Green means active/available, never arbitrary decoration.
- No gradients behind long-form text. Gradients may appear in the login brand panel, primary hero, or compact current-state accents.

## Application frame

Desktop at 1280px and above:

- 76px sticky white top navigation matching the Xugu public header.
- Header contains the product mark, project entry/current overview, optional project switcher, signed-in identity, and logout.
- Main area uses the Xugu warm command background and a centered content canvas with max width 1460px.
- Project modules use a horizontal section tab card. No dark global sidebar or SaaS-style left rail is used.
- Primary heroes use the Xugu left-mission/right-current-campaign structure.

Tablet 768-1279px:

- White navigation compacts while retaining the product identity and current project switcher.
- Project module navigation remains a horizontal scrollable tab row.
- Project cards use two columns.

Mobile below 768px:

- Single column, 16px page gutters.
- The header retains brand, current project switcher, and logout; secondary navigation is omitted rather than dominating the small viewport.
- Search/filter controls stack, cards become full width, and management tables become cards.

## Screen 1: Login

Route: `/login`

- Warm command-background layout with a large mission panel and a compact white login card, using the same canvas and wave language as Xugu.
- Mission panel: warm white surface, subtle command-grid motif, product name, short value statement, and three trust statements: project isolation, evidence traceability, human-controlled publishing.
- Form panel: 420px maximum width, heading “登录项目作战平台”, username and password fields, submit button, environment note.
- The login form is the screen's primary visual and keyboard focus anchor.
- Submit label is exactly “登录平台”; the pending label is “正在登录…”.
- Password is never prefilled or echoed. Error text is generic (“账号或密码不正确”) and uses `role="alert"`.
- Submitting shows a button-local spinner, disables only the form, and preserves the username.
- Successful login replaces history with `/projects`.
- If no bootstrap administrator exists, the page shows a non-secret setup instruction and never displays or generates a browser-side password.

## Screen 2: Project home

Route: `/projects`

Header:

- Eyebrow “PROJECT COMMAND CENTER”, title “项目作战台”, concise description.
- Right side: active project count and platform-admin “新建项目” button.

Filter bar:

- Search input with clear button; searches name and stable ID.
- Search clear action is exactly “清除搜索条件”.
- Status segmented control: active / archived / all. Archived is visible only to platform admins.
- Sort: recently visited / name / updated.
- Results update after 180-250ms debounce; URL query parameters mirror the filters.
- Search and its resulting project grid are the screen's primary visual anchor.

Recent section:

- Up to four recently visited authorized projects, ordered by access time.
- Omit the section when empty; do not show fake recent items.

Project grid:

- Three columns desktop, two tablet, one mobile.
- Card shows template label, status, name, stable ID, published version, updated time, and concise published summary when available.
- Footer shows counts for units/tasks/stages and the user's role.
- Entire card heading/link opens `/projects/:projectId`; management actions are separate buttons and do not nest inside the link.
- Archived cards are visually muted and cannot be opened by non-admin members.

States:

- Loading: six skeleton cards with stable dimensions.
- Empty search: show “没有找到匹配项目” and the action “清除搜索条件”.
- No authorized projects: explain that a platform/project admin must grant access.
- Error: inline retry panel with action “重新加载项目”; do not redirect to login unless API returns 401.

## Screen 3: Project detail shell

Route: `/projects/:projectId`

Top bar:

- Project switcher lists authorized active projects and updates the URL on selection.
- Breadcrumb: Projects / project name.
- Role badge and published version badge.

Project navigation:

- Phase 2 active item: Overview.
- Future items are visible but disabled and neutrally labeled “即将开放”: Units, Roadmap, Task Network, Gantt, Outcomes, Risks, Metrics, Materials.
- Disabled items are not focusable links and do not imply implemented functionality.

Overview shell:

- Hero with project name, stable ID, template, status, and published summary/goal.
- The project hero and factual count row form the page's primary visual anchor.
- Four factual count cards: units, tasks, roadmap stages, workstreams.
- “Current status” panel shows `statusLabel`, `currentStage`, updated time, and published version.
- “Project boundaries” panel states that the page is reading published data and that draft management/publishing are later workflows.
- No invented completion percentage. If `overallProgress` is null, display “暂无正式完成率”.

Unknown or unauthorized project:

- Unauthorized, missing, and inaccessible archived projects all return the same 404 response and show “项目不存在或你无权访问” with action “返回项目列表”; the UI must not distinguish their existence.

## Screen 4: Project administration

Platform admins only. Presented as accessible dialogs or a right-side sheet; never as browser prompts.

Create:

- Fields: stable project ID, display name, template (`campaign-map-v1` or `standard-project-v1`).
- ID is lowercase and immutable after creation; show rule before submit.
- Creation produces an empty published/draft pair and assigns the creator as project admin.
- Success navigates to the new project shell.

Edit:

- Display name, theme accent, and terminology are edited only through validated preset controls; Phase 2 exposes no raw JSON editor.
- Theme choices are “虚谷蓝”, “深海军蓝”, and “中性灰蓝”. Terminology choices are “作战项目” and “标准项目”.

Archive/restore:

- Archive requires project name confirmation, explains that data is retained, and uses the exact destructive action label “归档项目”.
- Restore is available from the archived filter with the exact action label “恢复项目”.
- Xugu may be archived only by a platform admin; archive never deletes versions.

## Interaction and feedback

- All mutations use explicit CSRF protection and disable their initiating control while pending.
- Success uses a non-blocking status toast with `role="status"`; errors remain next to the failed operation.
- Escape closes dialogs unless a mutation is in its final transaction.
- Browser Back/Forward restores route and project filters.
- Session expiry returns to login with a “会话已过期，请重新登录” message and preserves the intended pathname for one same-origin redirect.

## Accessibility contract

- One `h1` per screen and logical heading order.
- Every input has a visible label; placeholders are examples, not labels.
- Keyboard-visible focus ring: 3px blue at minimum 3:1 contrast.
- Minimum pointer target 40x40px.
- Dialogs use `aria-modal`, an accessible name, initial focus, focus trap, and focus return.
- Status is never conveyed by color alone; badges include text.
- Respect `prefers-reduced-motion`; animations become instant or opacity-only.
- All main flows work at 200% zoom without horizontal page scrolling at 1280px viewport.

## Security-facing UI rules

- Session token is HttpOnly and never read by JavaScript.
- CSRF token may be held in memory and refreshed from the authenticated session endpoint; it is not persisted to local storage.
- The UI never hides a server-side authorization failure or assumes hidden controls are permission enforcement.
- Generic login errors do not reveal whether a username exists.
- Archived, unauthorized, and missing states use server status codes as the source of truth.

## Component and registry safety

- Phase 2 uses only local semantic HTML/CSS/JavaScript components committed in this repository.
- No third-party UI registry, remote component block, CDN script, icon font, or executable project-supplied component is permitted.
- Icons are local inline SVG symbols or text-independent CSS shapes with accessible labels where interactive.
- Login form, project search/results, project hero, and administration form are the primary focal anchors for their respective screens; decorative brand elements remain subordinate.

## Browser acceptance checklist

1. First-run server with configured bootstrap password shows login, not project data.
2. Invalid login shows generic inline error and remains on `/login`.
3. Admin login reaches `/projects`; project cards show Xugu factual counts.
4. Search by `xugu` and Chinese project name both work; URL query mirrors filters.
5. Create a second standard project, navigate to it, switch back to Xugu, and verify both URL and data change together.
6. Archive the second project, verify it leaves active results, then restore it from archived results.
7. Viewer sees only assigned projects and cannot see management controls; direct mutation API is still rejected.
8. Project shell shows published data and null progress as “暂无正式完成率”.
9. Refresh `/projects/xugu-agentic-group` directly and remain in the authenticated shell.
10. Keyboard-only login, project search, switcher, dialog, and logout flows are usable.
11. Validate desktop 1440x900, tablet 1024x768, and mobile 390x844 layouts.
12. Verify logout invalidates the server session and Back does not reveal cached project data.
