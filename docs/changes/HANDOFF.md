# Handoff

> Precise starting point for the next Agent. Read this first.

---

## Current Position

**Goal**: G01 complete
**Next**: G02 — Baseline Freeze

## What Was Done in G01

1. **Constitution** (`.specify/memory/constitution.md`): 18 non-negotiable engineering principles covering workflow, architecture, naming, testing, security, and automation gates.

2. **Engineering standards** (`docs/engineering/`): Testing (4-layer), Performance (budgets), Security (9 sections).

3. **ADRs** (`docs/adr/`): ADR-001 PostgreSQL, ADR-002 Modular Monolith, ADR-003 Two-Service Budget.

4. **Product docs migrated** to `docs/product/` (PRODUCT.md, REQUIREMENTS.md, ROADMAP.md — all updated for PostgreSQL).

5. **Architecture docs migrated** to `docs/architecture/` (SYSTEM.md, TRACEABILITY.md, README.md).

6. **AGENTS.md and README.md rewritten** for V2 architecture.

7. **Obsolete docs deleted**: PROCESS.md, MIGRATION.md, VUE-MIGRATION-PLAN.md, V1-CONSOLIDATION.md, old architecture/result docs, config.json.

8. **Spec Kit templates** (`specs/TEMPLATES.md`): Goal workflow and file templates.

## Exact Starting Point for G02

Read the following in order (AGENTS.md mandatory reading order):

1. `AGENTS.md`
2. `docs/REFACTOR-PLAN.md` §G02
3. `.specify/memory/constitution.md`
4. `docs/architecture/PROJECT-STRUCTURE.md`
5. `docs/architecture/MIGRATION-MAP.md`
6. `docs/changes/EXECUTION-STATE.md` (this file's companion)
7. `docs/changes/DESIGN-CHANGELOG.md` (latest entries)

### G02 Objective (from REFACTOR-PLAN.md)

Freeze current V1 behavior as the regression baseline:
- Record current API surface (all routes, request/response shapes)
- Record current UI flows (screens, transitions, validations)
- Establish performance baseline (memory, response times)
- Create snapshot tests for critical paths
- This baseline is the parity target for G10 (backend switch) and G16 (frontend switch)

### G02 Allowed

- `tests/baseline/` directory creation
- Baseline snapshot/recording files
- Documentation of current behavior

### G02 Forbidden

- Any source code modification
- Any dependency changes
- Any database changes
- Any UI changes

## Retained V1 Reference Files

These V1 design files are kept for reference during G04-G09 implementation:

| Path | Purpose | Delete In |
|---|---|---|
| `.planning/design/system/modules/01-08/*.md` | V1 module detailed design | After respective Goal completes |
| `.planning/sketches/swimlane-visual-redesign/` | Visual design sketches | G11 (Vue design system) |

## Open Items / Risks

| Item | Status | Notes |
|---|---|---|
| Git history purge | ✅ done | Backup may be cleaned by OS |
| V1 source still runs | active | V1 XuguDB code runs until G10 switch |
| Windows v1.0.5 test | pending | User hasn't re-tested `--child` fix on Windows |
| `.planning/` directory | partially cleaned | Module designs and sketches remain as reference |
