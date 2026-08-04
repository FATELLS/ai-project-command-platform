# G04 Tasks

## T001: Write 0001_create_baseline_schema.sql
- Status: ✅ done
- Owner: agent
- Result: 37 tables, 50+ CHECK, 45 FK, 38 indexes, PG-native types

## T002: Write Kysely types and client
- Status: ✅ done
- Owner: agent
- Result: db.ts (37 interfaces), create-client.ts, transaction.ts

## T003: Write sanitized fixtures
- Status: ✅ done
- Owner: agent
- Result: seed-baseline.sql — 3 users, 1 project, 9 modules, 8 cards

## T004: Write integration tests
- Status: ✅ done (artifacts ready, live test pending PG instance)
- Owner: agent
- Result: migration runner with checksum tracking; compose.yaml for PG 18

## T005: Write docker-compose for PostgreSQL
- Status: ✅ done
- Owner: agent
- Result: ops/compose.yaml — PostgreSQL 18 Alpine

## T006: Update changes docs + VERIFICATION
- Status: ✅ done
- Owner: agent
- Result: DESIGN-CHANGELOG, EXECUTION-STATE, HANDOFF, VERIFICATION, ADR-004
