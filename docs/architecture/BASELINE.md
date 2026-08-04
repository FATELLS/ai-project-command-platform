# V1 Baseline: Behavior, API, Data, and Resources

> **Goal**: G02
> **Purpose**: Regression target for all subsequent Goals. This is the frozen snapshot of V1 behavior.
> **Date**: 2026-08-04
> **Environment**: macOS (Apple Silicon), Node 22.22.2
> **Snapshot note**: File counts reflect the tracked set at G02 commit time. Subsequent Goals added V2 skeleton files.

---

## 1. Code Size Baseline

| File | Lines | Description |
|---|---|---|
| `public/app.js` | 1,985 | Frontend SPA (vanilla JS) |
| `public/modules/renderers.js` | 2,827 | 8 module renderers |
| `public/modules/shared.js` | 211 | DOM utilities |
| `public/styles.css` | 2,665 | Global styles |
| `server.mjs` | 164 | Entry point |
| `src/http/app.mjs` | 704 | HTTP routing (69 API endpoints) |
| **Total key files** | **8,556** | |

| Directory | Size |
|---|---|
| `public/` | 3.0 MB |
| `src/` | 648 KB |
| `test/` | 164 KB |
| Git tracked files | 227 |

## 2. API Surface Inventory

**Total API endpoints**: 69 (excluding static files)

### Authentication Levels

| Level | Count | Endpoints |
|---|---|---|
| Public (no auth) | 2 | `/health`, `POST /api/login` |
| Auth (session) | 29 | All GET reads |
| Auth + CSRF | 31 | All mutations |
| Auth + Admin | 6 | Settings reads |
| Auth + Admin + CSRF | 5 | Settings writes |
| Auth + Diagnostics | 3 | Error/test reads |
| Conditional | 1 | `/api/_test/boom` |

### Endpoint Groups

| Group | Endpoints | Key Routes |
|---|---|---|
| Auth & Session | 4 | login, session, logout, password |
| Platform Settings | 6 | AI config (chat/generation/vision), test-connection, fetch-models |
| Users | 3 | list, create, status |
| Projects | 8 | CRUD, archive/restore, suggest, from-material |
| Project Members | 3 | list, update, delete |
| Materials | 12 | upload, manual, evidence search, retry, QA/generation grants |
| Generation Tasks | 6 | create, batch, retry, capabilities |
| Change Proposals | 9 | create, review per module, merge, preview |
| Release | 5 | preview, publish, rollback, history, audit |
| AI Chat | 2 | send message, quota |
| Module Data | 3 | list modules, get module, batch update |
| Diagnostics | 3 | errors, error detail, diagnostic bundle |
| Product Tests | 3 | list, trigger, results |
| Compatibility | 1 | `/api/public` (legacy shortcut) |
| Static/SPA | 13 | index.html, JS, CSS, images |

### API Patterns

- No `/api/v1` prefix (V1 uses bare `/api/`)
- Routes use path segments, not Express-style routers
- Auth via session cookie + CSRF header for mutations
- All project-scoped routes follow `/api/projects/{projectId}/...` pattern
- Errors return `{ error: { code, message } }` (no requestId/details in V1)

## 3. Database Schema Baseline

**Database**: XuguDB (虚谷)
**Tables**: 37
**Migrations**: 8 files (001-008)

### Core Tables by Domain

| Domain | Tables | Key Tables |
|---|---|---|
| Identity | 3 | `users`, `sessions`, `recent_project_access` |
| Projects | 5 | `projects`, `project_members`, `project_versions`, `project_modules`, `templates` |
| Unified Cards | 2 | `project_cards`, `project_card_links` |
| Materials | 9 | `project_materials`, `material_artifacts`, `material_jobs`, `evidence_blocks`, `material_qa_grants`, `material_update_selections`, `material_upload_attempts`, `material_upload_locks`, `ai_usage_events` |
| Generation | 4 | `generation_jobs`, `generation_job_materials`, `generation_job_evidence`, `generation_attempts` |
| Change Proposals | 7 | `change_proposals`, `change_proposal_items`, `change_proposal_evidence`, `material_generation_grants`, `proposal_review_items`, `proposal_merges` |
| Release | 2 | `publication_events`, `material_readiness_snapshots` |
| Operations | 4 | `audit_events`, `operation_traces`, `error_events`, `product_test_runs`, `product_test_case_results` |
| Settings | 1 | `platform_settings` |

### Schema Characteristics (V1 → V2 Migration Notes)

| V1 Pattern | V2 Target | Note |
|---|---|---|
| `VARCHAR(40)` timestamps | `TIMESTAMPTZ` | PG native time type |
| `CLOB` for JSON | `JSONB` | PG native JSON with indexing |
| `INTEGER IDENTITY(1,1)` | `GENERATED ALWAYS AS IDENTITY` | PG standard |
| `INTEGER` for booleans | `BOOLEAN` | PG native |
| Composite PKs with `project_id` | Keep pattern | Good for multi-tenant isolation |
| No CHECK constraints (Xugu limitation) | Add CHECK constraints | PG supports them |
| `SMALLINT` for progress | `SMALLINT` with CHECK (0-100) | |
| Self-referencing chains | Same pattern | publication_events, generation_jobs retry |

### Critical Data Relationships

```
projects → project_versions → project_cards → project_card_links
                            → project_modules
projects → project_materials → evidence_blocks
                            → material_jobs
                            → material_artifacts
projects → change_proposals → change_proposal_items → proposal_review_items
                            → generation_jobs → generation_attempts
                            → proposal_merges → project_versions (draft)
projects → publication_events (publish/rollback chain)
```

## 4. Core Business Journeys

| Journey | Steps | Test Coverage |
|---|---|---|
| Login → Project List → Workspace | auth → project list → module render | E2E: 01-auth |
| Material Upload → Extract → Evidence | upload → job queue → evidence blocks | E2E: materials + integration |
| AI Generation → Proposal → Review → Merge → Publish | generation task → proposal → per-module review → merge to draft → publish | E2E: full workflow |
| Rollback | publish → rollback to previous → audit | E2E: rollback test |
| Cross-Project Isolation | user A project X → cannot access project Y | E2E: auth + isolation |

## 5. Stable IDs and Invariants

| Invariant | Description |
|---|---|
| `xugu-agentic-group` | Stable business project external ID |
| `project_cards` / `project_card_links` | Sole project graph read/write model |
| Version immutability | Published/draft versions are immutable |
| Copy-on-write draft | Merge creates new draft version, never modifies published |
| Direct-predecessor rollback | Rollback only goes to immediate predecessor |
| projectId isolation | All data scoped by projectId |
| AI proposal-only | LLM generates proposals only, never writes draft/published |

## 6. Forbidden Artifact Baseline

| Category | Items | Status |
|---|---|---|
| Secrets in git | `.api-keys*.json`, `.env.local`, `session-cookie.txt` | 0 tracked (gitignored) |
| Logs | `*.log`, `app.log` | 0 tracked (gitignored) |
| Test data/reports | `test-reports/`, `outputs/` | 0 tracked (purged in G00) |
| Database data | `data/` (Xugu volume) | Only `.gitkeep` tracked |
| Build artifacts | `dist/`, `e2e-report/`, `test-results/` | Not tracked |
| Docker images | `vendor/xugudb/image/*.tar*` | 0 tracked (purged in G00) |

## 7. Known Gaps and Limitations

| Gap | Impact | V2 Resolution |
|---|---|---|
| No TypeScript | No compile-time type safety | G03: TS strict |
| No API versioning | `/api/` not `/api/v1/` | G05: `/api/v1` prefix |
| No OpenAPI spec | No machine-readable contract | G05: Fastify OpenAPI |
| No structured error details | Missing requestId, details | G05: Error envelope |
| Xugu SQL limitations | No CHECK constraints, limited JSON | G04: PostgreSQL native types |
| Vanilla JS frontend | No component model, heavy DOM manipulation | G11-G16: Vue 3 |
| No CI gate automation | Manual enforcement only | G03: ESLint + dependency check |
| No bundle analysis | Unknown client payload size | G03: size check gate |
| macOS requires Docker | Xugu has no macOS build | G04: PostgreSQL runs natively |

## 8. Reproduction Commands

```bash
# Clean checkout baseline
git clone <repo> && cd ai-project-command-platform
npm ci

# Code verification
npm run verify:code

# Unit/integration tests
npm test

# E2E tests (requires running app + database)
npm run test:e2e

# Abnormal input tests
npm run test:e2e:abnormal
```

> **Note**: V1 tests require XuguDB running. On macOS, this requires Docker/Colima.
> V2 baseline tests (G04+) will use PostgreSQL and run without Docker.
