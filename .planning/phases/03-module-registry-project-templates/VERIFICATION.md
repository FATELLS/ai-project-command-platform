# Phase 3 Verification

Status: `passed`
Verified: 2026-07-18

## Goal verdict

Phase 3 is complete. Both `campaign-map-v1@1.0.0` and `standard-project-v1@1.0.0` use the same repository-local nine-module registry and fixed renderers. Project differences come from versioned data, template, terminology, theme and allowlisted views; no project or AI content selects executable code.

## Automated evidence

`npm run verify` passes with 55/55 tests, 0 failures, 0 skipped and 0 todo. It additionally checks JavaScript syntax, required Phase 3 artifacts, sensitive tracked files, migration/import/API/static behavior, the browser evidence manifest and the read-only reference snapshot.

| Requirement | Verified evidence |
|---|---|
| MOD-01 | Exactly nine registered types; published/draft manifest/detail APIs; fixed Overview, Units, Roadmap, Task Network, Gantt, Outcomes, Risks, Metrics and Materials renderers |
| MOD-02 | Unknown type/schema/view and invalid graph/date/asset contracts fail closed; client registry contains no project component path; markup/URL payloads do not execute |
| TPL-01 | Immutable manifests validate fields, statuses, required/enabled/order rules, terminology, theme and allowlisted views; draft configuration is complete-list, transactional and does not touch published |
| TPL-02 | Xugu import/export remains semantically exact with v4.2, 7 units, 29 tasks, 6 stages, 2 closures and 4 workstreams |
| TPL-03 | Populated standard fixture renders 3 teams, 7 tasks, 4 milestones and 2 workflows through linear roadmap, dependency list and lane Gantt without campaign copy |
| NFR-04 | Migration `003_module_registry_templates.sql`, template `1.0.0` and module schema `1.0.0` are explicit; repeat/checksum/upgrade and rollback behavior pass |

The 55 focused tests cover migration repeat/checksum/rollback, template immutability, nine-module registry/loaders, two-project and version-layer isolation, role/CSRF controls, draft-only changes, fixed safe DOM/SVG renderers, responsive/accessibility contracts, legacy equivalence and HTTP/static behavior.

## Real-browser evidence

`node scripts/verify-browser-evidence.mjs .planning/evidence/phase3-browser-matrix.json` passes 16 required cases and verifies four screenshot files by SHA-256 and JPEG dimensions.

| Evidence | Size | SHA-256 |
|---|---:|---|
| Xugu desktop | 1440×900 | `5b5d21865e8010419216dbe195ce64cbb2269a526598b6fb91a86b9d03769559` |
| Standard desktop | 1440×900 | `09f4ccb74945c7fb7cca3d7daab54b3fc578d61b491e1691837c935865c8d9ea` |
| Tablet | 1024×768 | `b39fe3356d948cad9763d044989e646b27c9701f33a5a5d34c8888b502f07dc5` |
| Mobile | 390×844 | `d45288ab3cdf88c08126395f3d0f600591ef3fb392c14f1ba8243ec0938e309a` |

The matrix passes both project homes; the five blocking Xugu module regressions; standard terminology and variants; project switching; draft configuration/public separation; viewer denial; honest Phase 4 Materials boundary; tablet/mobile overflow; keyboard/reduced-motion contract; malicious project text; zero browser warnings, errors and dialogs; and reference integrity.

## Reference integrity

- HEAD: `97cb1ebfbbd4998cdb32d419a5670f1233b7cba8`
- `git status --short`: empty
- `data/state.seed.json` SHA-256: `b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa`
- The committed Xugu fixture has the same seed SHA-256.

## Boundary

Materials is an honest contract-only page. Phase 3 does not implement file upload, preprocessing, evidence search or Q&A. It also does not implement LLM proposals, review, merge, publish or rollback. Those remain Phase 4–6 work.
