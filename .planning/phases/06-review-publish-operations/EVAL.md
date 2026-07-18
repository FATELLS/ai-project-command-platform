# Phase 6 Evaluation Report

Dataset: `fixtures/evals/change-proposal-cases.json` (`phase6-eval-v1`)

The ten reference cases cover grounded plans, missing evidence, cross-project sources,
stale bases, task cycles, invalid dates, duplicates, invalid human edits, atomic merge
failure, and direct-predecessor rollback. Every rejection is mapped to a stable server
error family and exercised by deterministic validator, service, or API tests. The model
is never used to decide publish or rollback.

Acceptance threshold: all deterministic tests pass; no cross-project case may degrade
to a partial result; every publish/rollback mutation produces an append-only audit event.
