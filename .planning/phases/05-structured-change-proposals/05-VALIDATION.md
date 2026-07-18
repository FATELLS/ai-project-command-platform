# Phase 5 Validation Architecture

状态：`ready`
Nyquist：`enabled`

## Layers

| Layer | Command | Blocking scope |
|---|---|---|
| Migration/catalog/schema | `node --test test/proposal-schema.test.mjs test/db-foundation.test.mjs` | migration 005, template/schema immutability, normalized relations, rollback |
| Deterministic validator | `node --test test/proposal-validator.test.mjs` | project/base/evidence, modules/fields, dates/DAG, duplicates/conflicts, high-impact evidence |
| Generation orchestration | `node --test test/generation-service.test.mjs test/generation-provider.test.mjs test/ai-quota.test.mjs` | leases/idempotency, strict output/repair, disabled/failures, token/cost, no draft/published writes |
| API/UI contracts | `node --test test/proposal-api.test.mjs test/proposal-ui-server.test.mjs` | roles/CSRF/isolation, stable states, fixed safe DOM, explicit Phase 6 boundary |
| Unified | `npm run verify` | all phases, migration, no-key, sensitive/runtime files, Xugu reference unchanged |
| Browser | Phase 5 matrix and screenshots | Xugu/standard task+proposal UI, three viewports, disabled provider, project clearing, console/security |

## Requirement evidence

| Requirement | Primary evidence |
|---|---|
| AIU-01 | authorized material/template selection creates one project-scoped generation job |
| AIU-02 | exact `change-proposal-v1@1.0.0` schema and template-specific module/field allowlists |
| AIU-03 | high-impact/every fact evidence validator and citation navigation |
| AIU-04 | exact semantic enum, unknown/suggestion warnings and UI labels |
| AIU-05 | locked published base and delta-only operations; no snapshot rewrite field |
| AIU-06 | target/date/DAG/evidence/duplicate/base-conflict validators and adversarial API matrix |
| AIU-07 | provider has no tools/writes; draft/published hashes/pointers unchanged across every generation exit |
| NFR-03 | disabled/timeout/invalid/oversize/retry failures preserve browsing and durable job state |
| AUTH-04 | environment-only credentials, redacted attempts/audit, no browser configuration payload |

## Wave gates

1. Phase 4 unified/browser baseline and reference hashes pass.
2. Migration 005 and catalog/schema tests pass before service work.
3. Every deterministic adversarial validator case passes before provider output can persist.
4. Generation leases, repair, quota/token/cost and no-key failure matrix pass before API exposure.
5. Role/CSRF/isolation and safe fixed UI pass without Phase 6 review/merge/publish routes.
6. Full verify, browser evidence, draft/published pointer/hash checks and reference integrity pass before project memory advances.

Any cross-project relation, unsupported field/code, unreferenced fact, cyclic graph, stale-base fallback, duplicate proposal, quota bypass, raw provider/prompt logging, model-triggered write, Phase 6 action, viewport blocker or Xugu regression blocks completion.
