# Phase 4 Validation Architecture

状态：`ready`
Nyquist：`enabled`

## Layers

| Layer | Command | Blocking scope |
|---|---|---|
| Migration/intake | `node --test test/db-foundation.test.mjs test/material-gate.test.mjs` | 004 repeat/rollback, storage cleanup, all upload gates |
| Extraction/evidence | `node --test test/material-extraction.test.mjs test/evidence-isolation.test.mjs` | locators, bounds, leases, project/grant isolation |
| RAG/provider | `node --test test/chat-retrieval.test.mjs test/chat-provider.test.mjs test/ai-quota.test.mjs` | recall, citations, refusal, injection, failures, separate quotas |
| API/UI contracts | `node --test test/material-api.test.mjs test/material-ui-server.test.mjs` | roles, CSRF, uniform 404, safe DOM, responsive/a11y states |
| Unified | `npm run verify` | all tests, no-key operation, secrets/runtime exclusions, Xugu reference unchanged |
| Browser | `node scripts/verify-browser-evidence.mjs .planning/evidence/phase4-browser-matrix.json` | UI-SPEC matrix and three viewports |

## Requirement evidence

| Requirement | Primary evidence |
|---|---|
| MAT-01 | migration relations, repository/API two-project isolation |
| MAT-02 | text/manual/OOXML/PDF/image fixture extraction and honest dependency degradation |
| MAT-03 | typed locator/unit tests plus browser evidence navigation |
| MAT-04 | adversarial gate matrix and orphan reconciliation |
| MAT-05 | independent original/processed/grant/published states and capability tests |
| CHAT-01 | same-SQL project+published+grant filtering and project-switch browser clearing |
| CHAT-02 | citation allowlist, faithfulness/refusal/injection eval and citation navigation |
| CHAT-03 | persistent separate chat/generation quotas and role/capability matrix |
| NFR-01 | local no-key startup, optional extractor capability probe, unified verify |

## Wave gates

1. Baseline: Phase 3 `npm run verify` passes and reference hashes captured.
2. Wave 1: migration and every gate/cleanup test pass before extractors consume receipts.
3. Wave 2: all fixture locators and isolation/failure-recovery cases pass before retrieval.
4. Wave 3: EVAL retrieval/citation/refusal/provider/quota matrix passes with disabled/fake providers.
5. Wave 4: API/UI static and role/security contracts pass without proposal/review/publish routes.
6. Wave 5: full verify, browser matrix, screenshots and reference read-only checks pass before project memory changes.

Any cross-project result, orphan accepted artifact, unsupported material marked ready, invalid citation display, fabricated fact, prompt-injection effect, quota bypass, secret/body log, draft/published write, viewport blocker or Xugu regression blocks completion.
