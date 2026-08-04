# Handoff

> Precise starting point for the next Agent. Read this first.

---

## Current Position

**Goal**: G03 complete
**Next**: G04 — PostgreSQL Data Baseline

## What Was Done in G03

1. **npm workspaces** root: 6 workspaces (apps/api, apps/web, packages/{contracts,database,domain,test-kit}), Node 22 engines, V1 scripts under `v1:*` prefix.
2. **TypeScript strict**: tsconfig.base.json with strict + safety flags. Each workspace has tsconfig.json.
3. **Skeleton files**: API (main.ts + build-app.ts), Web (main.ts + index.html), 4 packages (index.ts each).
4. **Structure verification**: `scripts/verify-structure.mjs` — checks 17 dirs + 9 files + 4 forbidden dirs → PASS.

## Exact Starting Point for G04

Read in order:

1. `AGENTS.md`
2. `docs/REFACTOR-PLAN.md` §G04
3. `.specify/memory/constitution.md` (C-03, C-11)
4. `docs/architecture/BASELINE.md` §3 (V1 schema reference)
5. `docs/architecture/PROJECT-STRUCTURE.md` §2.5 (packages/database)
6. `docs/changes/DESIGN-CHANGELOG.md`

### G04 Objective

From business invariants, rebuild PostgreSQL 18 schema:
- Design `0001_create_baseline_schema.sql` (consolidated from V1 8 migrations)
- Use UUID, timestamptz, jsonb, real FK/UNIQUE/CHECK constraints
- Keep `project_cards` / `project_card_links` as sole project graph
- Build Kysely DB types, client, and transaction primitive
- Build desensitized fixtures with stable external ID
- Test empty DB replay, idempotent reruns, Chinese/JSON/time/transaction/concurrency
- Test pg_dump/pg_restore roundtrip

### G04 Allowed

- `packages/database/` (schema, migrations, client, types)
- `packages/domain/` (business rules if needed for constraints)
- `packages/test-kit/` (fixtures, test DB lifecycle)
- `tests/integration/`
- `ops/compose.yaml` (PostgreSQL service)
- Database docs and ADRs

### G04 Forbidden

- Runtime dual-write
- Second PG schema
- Importing real/old Xugu data
- Modifying project graph semantics

## Retained V1 Reference Files

| Path | Purpose | Delete In |
|---|---|---|
| `.planning/design/system/modules/01-runtime-persistence/` | V1 DB design | After G04 |
| `.planning/design/system/modules/01-08/*.md` | V1 module designs | After respective Goals |
| `.planning/sketches/` | Visual design | G11 |
