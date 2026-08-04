# ADR-001: PostgreSQL Replaces XuguDB as the Sole Database

- **Status**: Accepted
- **Date**: 2026-08-04
- **Authority**: G01, REFACTOR-PLAN §0

## Context

The platform originally used XuguDB (虚谷) as its sole database, supported by three lifecycle modes (native, managed, external). This created significant operational complexity:

- Platform-specific binaries (Linux ARM64/x86_64, Windows amd64) bundled in `vendor/xugudb/server/` (~150MB)
- macOS required Docker/Colima because Xugu has no macOS build
- Windows startup issues with DLL dependencies (`libcrypto-1_1-x64.dll`) and mode confusion (`--service` vs `--child`)
- Non-standard SQL dialect required a custom `sql-dialect.mjs` translation layer
- Node.js native driver bridging via Worker callback (`xugu-worker.cjs`)
- Docker image archives consuming 14MB+ in git

## Decision

Replace XuguDB entirely with **PostgreSQL 18** as the sole database.

- No data migration from Xugu — old data is test-only
- Fresh migration tree starting from `0001_create_baseline_schema.sql`
- Use **Kysely** as the query builder (type-safe, no ORM lock-in)
- Standard SQL, no dialect translation layer needed
- All 8 Xugu migration files consolidated into one PostgreSQL baseline

## Consequences

### Positive
- Zero platform-specific binaries — PostgreSQL is available everywhere
- Standard SQL eliminates `sql-dialect.mjs`
- Kysely provides compile-time type safety for queries
- Docker no longer required for development on any platform
- Simpler install (PostgreSQL is typically pre-installed or one command away)
- Mature tooling ecosystem (pg_dump, pgAdmin, psql)

### Negative
- Existing Xugu data is lost (acceptable: it was test data only)
- `project_cards` / `project_card_links` schema must be rewritten for PG types
- Team must learn Kysely API (low learning curve — it's thin SQL builder)

## Supersedes

- XuguDB native/managed/external three-mode lifecycle
- `CONTAINER_CLI` environment variable concept
- `vendor/xugudb/` entire directory tree
- `src/db/sql-dialect.mjs`
- `src/db/xugu-database.cjs` and `xugu-worker.cjs`
