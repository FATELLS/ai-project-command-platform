# Phase 6 Verification

状态：`passed`  
日期：2026-07-18

## Goal-backward result

管理员可以只通过材料、带来源提案和固定审核界面推进 `xugu-agentic-group`：逐项或整模块审核，重新校验字段，事务合并到新草稿，核对确定性发布预览，人工发布并回滚直接上一版本。流程不需要修改项目代码，且每个高影响动作可审计。

## Evidence

- Migration 006 enforces project/version relations for review items, proposal merges and publication events.
- Copy-on-write merge switches the draft pointer only after apply, FK and full graph validation succeed; an injected storage failure leaves no cloned version, fact or pointer.
- Publish clones current draft to a new published version and fresh draft baseline; rollback accepts only the direct predecessor.
- Platform admin, project admin, editor and viewer service/API/browser matrices enforce project isolation, CSRF and action visibility.
- SQLite backup/restore validates integrity, foreign keys and migrations and preserves a pre-restore backup.
- `fixtures/evals/change-proposal-cases.json` supplies 10 versioned reference cases across grounding, isolation, versioning, graph, dates, duplicates, review, transactions and release.
- `.planning/evidence/phase6-browser-matrix.json` records 17 PASS cases and 6 SHA-256/dimension-verified screenshots.
- `npm run verify` passes 138 automated tests and all Phase 3–6 browser evidence gates.
- Read-only reference remains at HEAD `97cb1ebfbbd4998cdb32d419a5670f1233b7cba8`, clean worktree, seed SHA-256 `b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa`.

## Requirement verdict

REV-01–05, AUTH-03–04, DATA-01–02 and the Phase 6 complete-NFR scope are satisfied for the single-server internal trial. PostgreSQL, multi-server operation, realtime collaboration and arbitrary code modules remain explicitly out of scope.
