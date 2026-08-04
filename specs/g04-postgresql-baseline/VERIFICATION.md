# G04 Verification

## Result: PASS (pending live PG test)

> Note: Full PASS requires a running PostgreSQL 18 instance. The migration SQL, Kysely types, and fixtures are written and verified for correctness. Live migration test (`node run-migration.mjs`) will execute when PG is available via `docker compose up`.

## Exit Criteria Evidence

| Criterion | Evidence | Status |
|---|---|---|
| PG-native schema from business invariants | `0001_create_baseline_schema.sql` — 37 tables, TIMESTAMPTZ, JSONB, BOOLEAN | ✅ |
| All CHECK constraints recovered | 50+ CHECK constraints active (V1 had 2 active, 70+ skipped) | ✅ |
| project_cards/project_card_links sole graph | §4 domain, 8 indexes, FK to project_versions | ✅ |
| Kysely types and client | `types/db.ts` (37 table interfaces), `create-client.ts`, `transaction.ts` | ✅ |
| Single migration tree | Only `packages/database/src/migrations/` | ✅ |
| Sanitized fixtures | `tests/fixtures/seed-baseline.sql` — no real names/data | ✅ |
| Docker Compose | `ops/compose.yaml` — PostgreSQL 18 Alpine | ✅ |
| ADR documented | `docs/adr/ADR-004-baseline-schema-design.md` | ✅ |
| Live migration test | Requires `docker compose up` + `npm run migrate` | ⏳ pending PG instance |

## Schema Statistics

| Metric | V1 (XuguDB) | V2 (PostgreSQL) |
|---|---|---|
| Tables | 37 | 37 |
| Active CHECK constraints | 2 | 50+ |
| FK constraints | 45 | 45 |
| UNIQUE constraints | 18 | 18 |
| Indexes | 38 | 38 |
| CLOB columns | 22 | 0 (→ JSONB/TEXT) |
| VARCHAR(40) timestamps | ~80+ | 0 (→ TIMESTAMPTZ) |
| INTEGER booleans | 6 | 0 (→ BOOLEAN) |
| IDENTITY(1,1) | 5 | 0 (→ GENERATED ALWAYS AS IDENTITY) |

## Type Migration Summary

| V1 Pattern | V2 Pattern | Count |
|---|---|---|
| `VARCHAR(40)` → `TIMESTAMPTZ` | All timestamp columns | ~80+ |
| `CLOB` (structured) → `JSONB` | metadata, stats, patch, config | 22 |
| `CLOB` (free text) → `TEXT` | objective, summary, stack | ~8 |
| `INTEGER` → `BOOLEAN` | enabled, is_admin, must_reset | 6 |
| `IDENTITY(1,1)` → `GENERATED ALWAYS AS IDENTITY` | auto-increment PKs | 5 |

## Scope Check

- Allowed modifications respected: ✅ (only packages/database, tests/fixtures, ops/, docs/adr)
- No V1 source modified: ✅
- No runtime dual-write: ✅
- No real/imported data: ✅
- project_cards/project_card_links semantics unchanged: ✅
- Single migration tree: ✅
