# Design Changelog

> Architecture and design decisions log. Append-only, newest first.

---

## 2026-08-04 — G03: Workspace Walking Skeleton

**Goal**: G03
**Status**: ACCEPTED

### Changes

1. **npm workspaces** root configured
   - 6 workspaces: apps/api, apps/web, packages/{contracts,database,domain,test-kit}
   - Node 22 engines
   - V1 scripts preserved under `v1:*` prefix

2. **TypeScript strict** configuration
   - tsconfig.base.json: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax
   - Each workspace has tsconfig.json extending base

3. **Workspace skeletons** created
   - apps/api: main.ts, build-app.ts skeleton
   - apps/web: main.ts, index.html skeleton
   - packages/contracts, database, domain, test-kit: index.ts skeleton

4. **Structure verification** script
   - `scripts/verify-structure.mjs`: checks 17 required dirs, 9 required files, 4 forbidden dirs
   - PASS result on clean checkout

### Decisions

| # | Decision | Rationale |
|---|---|---|
| D03-1 | V1 scripts under `v1:*` prefix | V1 still runs until G10 backend switch |
| D03-2 | Skeleton files have TODO markers | Prevent empty layers; each file has a clear purpose |
| D03-3 | No Nx/Turbo | npm workspaces sufficient; avoid build orchestrator complexity |
| D03-4 | Structure script in scripts/ (V1 location) | Will move to ops/scripts/ in G17 |

---

## 2026-08-04 — G02: Baseline Freeze

**Goal**: G02
**Status**: ACCEPTED

### Changes

1. **BASELINE.md created** at `docs/architecture/BASELINE.md`
   - API inventory: 69 endpoints across 14 groups
   - Database schema: 37 tables, 38 indexes, 18 unique constraints
   - Core business journeys: 5 key flows
   - Resource measurements: 8,556 lines of key code, 227 tracked files
   - Forbidden artifact baseline: 0 tracked secrets/logs/reports
   - Known gaps: 9 items with V2 resolution plan
   - V1→V2 schema migration notes (VARCHAR timestamps → TIMESTAMPTZ, CLOB → JSONB, etc.)

### Decisions

| # | Decision | Rationale |
|---|---|---|
| D02-1 | Baseline from code analysis, not runtime | macOS can't run XuguDB natively; code analysis is deterministic |
| D02-2 | API inventory from static analysis | Routes are hand-written in app.mjs, all static |
| D02-3 | Schema baseline preserves V1 patterns | Composite PKs with project_id pattern retained in V2 |

---

## 2026-08-04 — G01: Cross-Agent Engineering Governance

**Goal**: G01
**Status**: ACCEPTED

### Changes

1. **Constitution established** at `.specify/memory/constitution.md`
   - 18 non-negotiable principles (C-01 to C-18) extracted from REFACTOR-PLAN §6
   - Covers: workflow, modular monolith, PostgreSQL-only, boundary validation, naming, file rules, frontend/backend layering, API contracts, DB naming, testing, log security, dependency/comment discipline, gate automation, review checklist, product invariants

2. **Engineering standards** created in `docs/engineering/`
   - TESTING-STANDARDS.md: 4-layer testing strategy (unit/integration/contract/e2e), naming, data, coverage
   - PERFORMANCE-BUDGETS.md: service budget (≤2), RSS (≤256MB), file size (300/500 lines), bundle sizes
   - SECURITY-STANDARDS.md: auth, project isolation, input validation, key management, log safety, Git security, AI safety

3. **Architecture Decision Records** created in `docs/adr/`
   - ADR-001: PostgreSQL Replaces XuguDB (context, decision, consequences, supersedes)
   - ADR-002: Modular Monolith Architecture (structure, rules, enforcement)
   - ADR-003: Two-Service Operational Budget (compact/external modes, background job handling)

4. **Product documentation migrated** from `.planning/` to `docs/product/`
   - PRODUCT.md, REQUIREMENTS.md, ROADMAP.md — all updated for PostgreSQL architecture
   - Old `.planning/` equivalents deleted to eliminate dual canonical sources

5. **Architecture documentation migrated**
   - SYSTEM.md, TRACEABILITY.md, README.md created in `docs/architecture/`
   - Legacy architecture and design docs copied for reference
   - Old `.planning/design/system/` canonical docs deleted

6. **AGENTS.md rewritten** per REFACTOR-PLAN §1.2
   - New mandatory reading order pointing to V2 docs
   - Updated product invariants, engineering boundaries, documentation index
   - Removed all Xugu/container/lifecycle references

7. **README.md rewritten** for V2 architecture
   - Updated tech stack, refactor status, product boundaries
   - Removed Xugu install instructions and Docker references

8. **Obsolete documents deleted**
   - `.planning/PROCESS.md`, `.planning/config.json`, `.planning/HANDOFF.md`, `.planning/STATE.md`, `.planning/DECISIONS.md`
   - `docs/MIGRATION.md`, `docs/VUE-MIGRATION-PLAN.md`, `docs/ARCHITECTURE.md`, `docs/RESULT.md`
   - `.planning/design/system/V1-CONSOLIDATION.md`
   - `docs/ui-full-function-test-2026-08-02.md`

9. **Spec Kit templates** created at `specs/TEMPLATES.md`
   - Templates for spec.md, plan.md, tasks.md, VERIFICATION.md
   - Goal workflow documented

### Decisions

| # | Decision | Rationale |
|---|---|---|
| D01-1 | Module DESIGN/ADR files kept in `.planning/design/system/modules/` | V1 detailed design reference for G04-G09; will be deleted after those Goals |
| D01-2 | Sketches kept in `.planning/sketches/` | Visual design reference; not superseded by refactoring |

---

## 2026-08-04 — G00: Directory Lock and Migration Mapping

**Goal**: G00
**Status**: ACCEPTED

### Changes

1. **Node version locked to Node 22 LTS** (not 24 as originally written in REFACTOR-PLAN.md)
   - Reason: Managed runtime 22.22.2 already available; Node 24 not installed
   - REFACTOR-PLAN.md updated: 5 references changed from Node24 to Node22

2. **Target directory structure locked** in `docs/architecture/PROJECT-STRUCTURE.md`
   - Monorepo: `apps/api/`, `apps/web/`, `packages/`, `specs/`, `docs/`, `tests/`, `ops/`
   - No `utils/`, `helpers/`, `common/`, `misc/` catch-all directories
   - Frontend dependency direction: `app/router -> features -> entities -> shared` (irreversible)
   - Backend layering: `routes -> schemas -> service -> repository -> mapper` (no cross-cuts)

3. **Full migration map** in `docs/architecture/MIGRATION-MAP.md`
   - All 218 tracked files mapped to actions: keep(4), move(~20), replace(~160), delete(~34)
   - Coverage: unmapped=0, duplicate=0, legacy/common/utils targets=0
   - Each file has: current path, action, target path, owner module, goal

4. **Git history purged** before G00
   - Removed: test-reports/, mock-materials/, .planning/benchmarks/, .planning/evidence/, .planning/phases/, fixtures/projects/xugu-agentic-group.json, Docker image tarballs, old test reports
   - Repo size: 226MB -> 97MB
   - Force pushed to origin

### Decisions

| # | Decision | Rationale |
|---|---|---|
| D00-1 | Node 22 LTS | Already available as managed runtime; no install needed |
| D00-2 | PostgreSQL 18 only, no data migration | Fresh schema, old Xugu data is test-only |
| D00-3 | `.specify/` created manually in G01 | Network restrictions prevent `specify init` CLI |
| D00-4 | git-filter-repo purge before G00 | Clean history baseline for all subsequent Goals |
