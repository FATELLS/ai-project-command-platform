# Design Changelog

> Architecture and design decisions log. Append-only, newest first.

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
