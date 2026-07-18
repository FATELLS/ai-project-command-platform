# Phase 2 Verification

Status: `passed`
Date: 2026-07-18

## Goal verdict

Phase 2 goal is achieved. An authenticated user can see only authorized projects, search and switch them without URL/data crossover, and open the published project shell. Platform administrators can create, edit, archive, and restore projects through CSRF-protected transactional UI/API paths.

## Requirement evidence

| Requirement | Verdict | Evidence |
|---|---|---|
| PLAT-01 | PASS | Authorized list/search/filter/recent, project switcher, direct refresh, and two-project browser flow |
| PLAT-02 | PASS | Create/edit/archive/restore API tests and browser lifecycle flow; append-only audit assertions |
| AUTH-01 | PASS | Platform admin, project admin, editor, and viewer matrix tests |
| AUTH-02 | PASS | Uniform unauthorized/missing 404, no failed-access recents, viewer browser flow, project isolation tests |
| NFR-02 | PASS | CSRF, rollback, cross-project isolation, role denial, expiry, Back cache, migration and reference read-only checks |

## Automated verification

- `node --test`: 30/30 passed.
- `npm run verify`: migrations, import/export equivalence, authenticated API/static smoke, tracked-sensitive-file scan, and Xugu reference before/after comparison passed.
- Xugu published facts remain 7 units, 29 tasks, 6 stages, 2 closures, and 4 workstreams at `v4.2`.

## Browser acceptance

The visual acceptance was rerun after the user-confirmed direction correction. Desktop now uses the stable Xugu frame instead of the superseded dark-rail SaaS shell: 76px white header, warm command canvas, left-mission/right-status hero, horizontal module card, and Xugu-style factual section cards.

| Check | Result |
|---|---|
| First-run login and generic invalid credentials | PASS |
| Admin login, Xugu facts, English/Chinese search and URL query | PASS |
| Create standard project, switch to Xugu, URL/data synchronization | PASS |
| Archive and restore second project | PASS |
| Viewer only sees assigned Xugu project and no management controls | PASS |
| Null progress copy and published-data boundary | PASS |
| Direct project refresh stays authenticated | PASS |
| Logout then Back exposes no project facts | PASS |
| Active-session expiry clears facts and shows re-login message | PASS |
| Xugu-aligned desktop frame at 1280×720 | PASS |
| 1024×768 tablet, two columns, no horizontal overflow | PASS |
| 390×844 mobile, one column, no horizontal overflow | PASS |

Desktop visual evidence:

- `.planning/evidence/phase2-xugu-reference-desktop-1440x900.jpg`
- `.planning/evidence/phase2-xugu-aligned-projects-desktop-1280x720.jpg`
- `.planning/evidence/phase2-xugu-aligned-detail-desktop-1280x720.jpg`

## Boundaries retained

- The UI does not implement Phase 3 module renderers; future modules are disabled and labeled “即将开放”.
- The browser reads published project facts only. No AI, proposal, draft merge, publish, or rollback workflow was added.
- The reference Xugu repository was not modified.
