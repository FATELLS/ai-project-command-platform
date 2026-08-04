# Handoff

> Precise starting point for the next Agent. Read this first.

---

## Current Position

**Goal**: G02 complete
**Next**: G03 — Workspace Walking Skeleton

## What Was Done in G02

1. **BASELINE.md** (`docs/architecture/BASELINE.md`): Complete V1 behavior snapshot.
   - 70 API endpoints (14 groups, with auth levels and route patterns)
   - 37 database tables (schema, indexes, unique constraints, relationships)
   - 5 core business journeys
   - Code size: 8,556 lines across 6 key files, 227 tracked files
   - 0 tracked forbidden artifacts
   - 9 known gaps with V2 resolution mapping
   - V1→V2 schema migration notes (types, constraints, naming)

2. **VERIFICATION.md**: PASS — all exit criteria met.

## Exact Starting Point for G03

Read the following in order (AGENTS.md mandatory reading order):

1. `AGENTS.md`
2. `docs/REFACTOR-PLAN.md` §G03
3. `.specify/memory/constitution.md`
4. `docs/architecture/PROJECT-STRUCTURE.md`
5. `docs/architecture/BASELINE.md` (regression target)
6. `docs/changes/DESIGN-CHANGELOG.md`

### G03 Objective (from REFACTOR-PLAN.md)

Create minimal Node22/TypeScript/npm workspaces skeleton:
- `apps/api/`, `apps/web/`, `packages/` directory structure
- TypeScript strict, ESLint, Prettier
- Build/lint/typecheck/test/structure/doc/artifact gates
- npm workspaces configuration
- CI pipeline skeleton
- No business logic migration

### G03 Allowed

- `apps/`, `packages/`, `tests/`, `ops/` directory creation
- Root `package.json` → workspace root
- `tsconfig.json`, `eslint.config.js`, `.prettierrc`
- CI workflow files
- New `.github/workflows/` CI config

### G03 Forbidden

- Business logic migration (no module code)
- Database changes
- V1 code modification
- Dependency installation beyond tooling

## Retained V1 Reference Files

| Path | Purpose | Delete In |
|---|---|---|
| `.planning/design/system/modules/01-08/*.md` | V1 module detailed design | After respective Goal completes |
| `.planning/sketches/swimlane-visual-redesign/` | Visual design sketches | G11 (Vue design system) |
