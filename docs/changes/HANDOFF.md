# Handoff

> **Last updated**: 2026-08-04 (after G04)
> **Next agent**: read REFACTOR-PLAN.md → EXECUTION-STATE.md → this file.

---

## Current State

G00-G04 complete. V1 system is still running unchanged. V2 workspace skeleton and PostgreSQL baseline schema are in place.

**What works now**:
- V1: Full application (vanilla JS + XuguDB) — untouched
- V2: Workspace structure, TS config, PG schema, Kysely types, migration runner

**What doesn't work yet**:
- V2 API server (no Fastify app — G05)
- V2 frontend (no Vue app — G11)
- V2 integration tests (need running PG instance — G04 artifacts ready, tests to run in G05)

## Immediate Next Steps (G05)

1. Read `docs/REFACTOR-PLAN.md` section G05
2. Create Fastify 5 app in `apps/api/src/app/build-app.ts`
3. Implement `/api/v1/health` endpoint
4. Set up OpenAPI auto-generation
5. Establish error envelope (with requestId)
6. Wire Fastify plugins: @fastify/cors, @fastify/cookie, @fastify/csrf-protection

## Important Constraints

- **One Goal at a time**: do not start G06 until G05 passes review
- **V1 untouched**: do not modify any V1 source files until G10
- **No business logic yet**: G05 is platform plumbing only
- **PostgreSQL only**: all new DB code uses Kysely + PG
- **Review gate**: after completing each Goal, a separate review Agent must audit quality before unlocking the next

## Retained V1 Reference Files

| Path | Purpose | Deletion |
|---|---|---|
| `.planning/design/system/modules/01-08_*.md` (16 files) | V1 module detailed design — reference for G06-G09 | After G09 |
| `src/db/xugu-migrations/001-008_*.sql` (8 files) | V1 schema — already mapped to PG in G04 | After G10 |

## Key Decisions from G04

1. **No V1 data migration**: V2 starts fresh with sanitized fixtures
2. **37 tables** preserved with same domain coverage; all V1-skipped CHECK constraints recovered
3. **project_cards/project_card_links** remain the sole project graph model
4. **Kysely** is the query builder; no raw SQL outside migrations
5. **Migration runner** tracks checksums in `_migrations` table
6. **Docker Compose** uses PostgreSQL 18 Alpine
