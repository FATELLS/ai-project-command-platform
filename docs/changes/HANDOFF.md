# Handoff

> Precise starting point for the next Agent. Read this first.

---

## Current Position

**Goal**: G00 complete
**Next**: G01 — Cross-Agent Engineering Governance

## What Was Done in G00

1. **Git history purged** of all sensitive files (real employee names, company data, Xugu proprietary content) and large Docker image tarballs
   - Tool: `git-filter-repo`
   - Repo: 226MB → 97MB
   - Force pushed

2. **REFACTOR-PLAN.md** Node version corrected: all `Node24` → `Node22`

3. **Three deliverables written**:
   - `docs/architecture/PROJECT-STRUCTURE.md` — locked target directory tree with ownership, responsibilities, forbidden content, dependency direction
   - `docs/architecture/MIGRATION-MAP.md` — all 218 tracked files mapped to keep/move/replace/delete with target path, owner module, and goal number
   - `docs/changes/` — DESIGN-CHANGELOG, EXECUTION-STATE, HANDOFF initialized

## Exact Starting Point for G01

Read the following in order:

1. `docs/REFACTOR-PLAN.md` §G01 (Cross-Agent Engineering Governance)
2. `docs/architecture/PROJECT-STRUCTURE.md` (target structure)
3. `docs/architecture/MIGRATION-MAP.md` (which files G01 owns)
4. `docs/changes/EXECUTION-STATE.md` (current state)

### G01 Objective (from REFACTOR-PLAN.md)

Create engineering governance artifacts:
- `.specify/memory/constitution.md` — non-negotiable engineering rules
- `docs/adr/` — Architecture Decision Records (migrated from `.planning/DECISIONS.md`)
- Rewrite `AGENTS.md` per REFACTOR-PLAN §1.2
- Rewrite `README.md` for new architecture
- Move `.planning/` docs to `docs/product/` and `docs/architecture/`
- Delete obsolete docs (`.planning/PROCESS.md`, `docs/MIGRATION.md`, `docs/VUE-MIGRATION-PLAN.md`)

### G01 Allowed

- `.specify/` directory creation
- `docs/adr/` directory creation
- `docs/product/` directory creation
- `AGENTS.md`, `README.md` rewrite
- `.planning/` → `docs/` moves
- Obsolete doc deletion

### G01 Forbidden

- Any source code modification (no `.mjs`/`.js`/`.ts` files)
- No `apps/` or `packages/` creation
- No database changes
- No dependency changes

## Open Items / Risks

| Item | Status | Notes |
|---|---|---|
| Git history purge | ✅ done | Backup at `/tmp/aicp-git-backup-*` (may be cleaned by OS) |
| `.specify/` via CLI | blocked | Use manual creation; `specify init` network blocked |
| Windows v1.0.5 test | pending | User hasn't re-tested `--child` fix on Windows |
| Vue migration plan doc | will be deleted in G01 | Superseded by REFACTOR-PLAN G11-G16 |
