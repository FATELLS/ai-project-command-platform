# Phase 3 Validation Architecture

Status: `ready`
Nyquist: `enabled`

## Layers and commands

| Layer | Scope | Command |
|---|---|---|
| Syntax | templates/modules/services/repositories/browser modules | `node --check <file>` |
| Unit | template manifests, schema/view allowlists, loader validation | `node --test test/template-catalog.test.mjs test/module-registry.test.mjs` |
| Migration | 003 repeat/checksum/backfill/rollback | `node --test test/db-foundation.test.mjs` |
| Integration | nine module routes, roles, layers, configuration, isolation | `node --test test/module-api.test.mjs` |
| HTTP/static | fixed renderer, safe DOM, route and state contracts | `node --test test/module-ui-server.test.mjs test/platform-ui-server.test.mjs` |
| Unified | all tests, Xugu equivalence, sensitive/reference checks | `npm run verify` |
| Browser | UI-SPEC matrix, populated templates, three viewports | `node scripts/verify-browser-evidence.mjs .planning/evidence/phase3-browser-matrix.json` |

## Requirement evidence

| Requirement | Automated | Browser |
|---|---|---|
| MOD-01 | nine registry types, DTO/loaders, routes and renderers | all nine Xugu and standard module pages |
| MOD-02 | unknown type/view/schema rejection; safe DOM/static scan | malicious payload renders as text or fails closed |
| TPL-01 | immutable manifest validation, required/enabled/order/view rules | draft configuration does not alter published navigation |
| TPL-02 | campaign catalog, Xugu migration/API facts | Xugu Banner/terms/route/network/Gantt/outcomes regression |
| TPL-03 | standard creation/API/empty copy | standard terminology and arbitrary counts/dates without code changes |
| NFR-04 | migration 003 and explicit template/schema versions | envelope/template version switches atomically by project |

## Gates

- Wave 0: Phase 2 verify passes; reference HEAD/status/seed hash captured; test skeletons named in plans.
- Wave 1: catalog, migration 003, populated standard fixture and legacy/new-project initialization tests pass without changing 001/002.
- Wave 2: registry/loaders/API/draft configuration and two-project isolation matrix pass.
- Wave 3: fixed renderers, safe DOM, nine routes and responsive static contracts pass.
- Wave 4: unified verifier knows migration 003/Phase 3 files; `npm run verify`, machine-checked browser evidence and reference read-only checks pass before project memory is updated.

Each feature task creates or extends its owned tests in the same commit. A later verification plan may add evidence and run gates, but cannot defer missing implementation tests.

## Browser matrix

- Desktop 1440x900: Xugu Overview/Roadmap/Task Network/Gantt/Outcomes, standard variants, project switch and draft configuration.
- Tablet 1024x768: scrollable module navigation, two-column cards and labeled local visualization scrolling.
- Mobile 390x844: list-first Roadmap/Network/Gantt, bottom configuration sheet, 40px targets and no page-level overflow.
- Roles: platform/project admin, editor and viewer; public/draft controls and direct denial.
- Security: project text containing markup/event/URL payloads cannot execute; browser console has no warnings/errors or payload dumps.

## Blocking policy

Any migration checksum/rollback, cross-project/layer, fixed-renderer safety, template version, Xugu fact/visual, draft-only, supported viewport, keyboard or reference-integrity failure blocks Phase 3 completion. Empty visual polish may be flagged only when meaning, access and task completion remain correct.
