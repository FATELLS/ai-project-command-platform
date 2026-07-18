# Phase 2 Validation Architecture

Status: `ready`
Nyquist: `enabled`

## Layers and commands

| Layer | Scope | Command |
|---|---|---|
| Syntax | server/repositories/services/browser JS | `node --check <file>` |
| Unit | password/session/CSRF/clocks/cookies | `node --test test/auth-foundation.test.mjs` |
| Integration | roles/lifecycle/recent/isolation | `node --test test/auth-project-api.test.mjs` |
| HTTP/static | CSP/routes/bootstrap/login/switch | `node --test test/platform-ui-server.test.mjs` |
| Unified | all tests/migrations/reference read-only | `npm run verify` |
| Browser | 12 UI-SPEC checks, 3 viewports | `.planning/evidence/` |

## Requirement evidence

| Requirement | Automated | Browser |
|---|---|---|
| PLAT-01 | authorized list/search/filter/recent/switch | login, search, recent, two-project switch, refresh/back |
| PLAT-02 | lifecycle transaction/CSRF/audit | admin dialogs, archive, archived restore |
| AUTH-01 | bootstrap and four-role matrix | admin controls present, viewer controls absent |
| AUTH-02 | SQL authorization, uniform 404, layer separation | assigned-only viewer and direct denial |
| NFR-02 | cross-project/high-impact tests | URL/data switch and denial |

## Gates

- Wave 0: Phase 1 verify passes; migration 001 and reference HEAD/status/hash captured.
- Wave 1: `node --test test/auth-foundation.test.mjs` passes all migration/bootstrap/password/session/CSRF/expiry/audit cases.
- Wave 2: `node --test test/auth-project-api.test.mjs` passes unauthenticated+four roles, response schema, lifecycle atomicity, recent top-4, uniform 404, isolation.
- Wave 3: static/client suite and `npm run verify` pass before browser acceptance.

Each implementation task creates/extends its named tests before running its `<automated>` command; there is no later test-only dependency.

## Browser matrix

- Desktop 1440x900: all applicable checks, keyboard-only, 200% zoom.
- Tablet 1024x768: two-column grid, horizontal project navigation, switch/lifecycle.
- Mobile 390x844: drawer/stacking, dialogs, expiry, logout/Back, switching.

## Blocking policy

Any authorization, CSRF, transaction, expiry, cross-project, reference-integrity, supported-viewport, or keyboard failure blocks completion. Minor polish may be flagged only when meaning, access, and task completion are unaffected.
