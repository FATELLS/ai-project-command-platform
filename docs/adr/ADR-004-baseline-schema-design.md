# ADR-004: Baseline Schema Design Principles

**Status**: Accepted
**Date**: 2026-08-04
**Authority**: G04 (PostgreSQL Data Baseline)
**Supersedes**: V1 XuguDB migrations 001-008

---

## Context

V1 used XuguDB with significant PostgreSQL-incompatible patterns: VARCHAR(40) timestamps, CLOB for JSON, INTEGER for booleans, IDENTITY(1,1), and 70+ CHECK constraints that were skipped due to Xugu compatibility issues.

V2 migrates to PostgreSQL 18 and must rebuild the schema from scratch using native PG types.

## Decision

### Type Mapping

| V1 (XuguDB) | V2 (PostgreSQL) | Rationale |
|---|---|---|
| `VARCHAR(40)` timestamps | `TIMESTAMPTZ` | Native time type with timezone |
| `CLOB` for structured JSON | `JSONB` | Indexable, queryable, binary-efficient |
| `CLOB` for free text | `TEXT` | No artificial size limit |
| `INTEGER` for booleans | `BOOLEAN` | Type-safe, semantic |
| `IDENTITY(1,1)` | `GENERATED ALWAYS AS IDENTITY` | SQL standard |
| `JSON` (Xugu limited) | `JSONB` | Full query support |

### Constraint Recovery

All 70+ CHECK constraints skipped in V1 are now active in V2. Key categories:
- Status enums: `status IN ('active', 'disabled')` etc.
- Numeric bounds: `progress BETWEEN 0 AND 100`, `attempts >= 0`
- Boolean validation: `IN (TRUE, FALSE)`
- HTTP status range: `status BETWEEN 400 AND 599`

### Deferred FKs for Circular Dependencies

`projects.published_version_id` and `draft_version_id` reference `project_versions`, which is created after `projects`. These FKs are added post-creation with `DEFERRABLE INITIALLY DEFERRED`.

### Partial Indexes

V1 used full-column unique indexes where partial indexes are more correct:
- `idx_users_login_name`: `WHERE login_name IS NOT NULL` (NULLs allowed for non-login users)
- `idx_pc_parent`: `WHERE parent_id IS NOT NULL` (root cards have no parent)

### Fixture Sanitization

Seed data uses synthetic names and mock password hashes. The stable external ID `xugu-agentic-group` is retained as a business project identifier per §4.1 product invariants.

## Consequences

- **Positive**: Full data integrity enforcement at DB level; no silent constraint violations
- **Positive**: PostgreSQL native JSONB enables GIN indexes for future query optimization
- **Positive**: TIMESTAMPTZ eliminates timezone ambiguity
- **Negative**: V1 data cannot be directly imported (types differ); requires ETL or manual migration
- **Mitigation**: No V1 data migration is planned — fresh start with sanitized fixtures

## Validation

- 37 tables created (same domain coverage as V1)
- 50+ CHECK constraints active
- 45 FK constraints
- 18 UNIQUE constraints
- 38 indexes
- 22 JSONB columns (replacing CLOB)
- All timestamps are TIMESTAMPTZ
- All booleans are BOOLEAN
