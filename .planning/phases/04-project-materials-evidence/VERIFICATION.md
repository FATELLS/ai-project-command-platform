# Phase 4 Verification

Status: `passed`
Verified: 2026-07-18

## Goal verdict

Phase 4 is complete. Projects can ingest bounded local files or manual text into isolated material records, process them into stable source-located evidence, grant selected sources to read-only project Q&A, and return only allowlisted citations. No Phase 4 path creates a `ChangeProposal` or writes `draft`/`published` state.

## Automated evidence

`REQUIRE_PHASE4_BROWSER_EVIDENCE=1 npm run verify` passes with 94/94 tests, 0 failures, 0 skipped and 0 todo. It also verifies JavaScript syntax, migration checksums and rollback, no-key operation, sensitive/runtime file exclusions, Phase 3 and Phase 4 browser evidence, Xugu semantic equivalence and the read-only reference snapshot.

| Requirement | Verified evidence |
|---|---|
| MAT-01 | Migration 004, project-scoped ledger/API/repository queries, duplicate isolation and cross-project foreign-key rejection |
| MAT-02 | Bounded manual/text/JSON/CSV/DOCX/PPTX/XLSX/PDF/image adapters with typed failures and honest optional-dependency degradation |
| MAT-03 | Stable paragraph/slide/cell/page/OCR locators, generation swap, FTS synchronization and browser evidence navigation |
| MAT-04 | Streaming size/signature/type gates, archive traversal/bomb limits, persistent rate/concurrency reservations, scanner fail-closed mode and orphan cleanup |
| MAT-05 | Independent material, artifact, processing, QA-grant and update-intent state plus server-authoritative capability/quota envelopes |
| CHAT-01 | One-SQL project/published/grant/current-generation filtering and deterministic top-eight FTS retrieval |
| CHAT-02 | Untrusted evidence prompt boundary, citation allowlist, injection/refusal/provider-failure matrix and stable citation navigation |
| CHAT-03 | Viewer/editor/admin role matrix, separate persistent chat/generation quotas and shared bounded provider concurrency |
| NFR-01 | Disabled-by-default provider, fake limited to tests, OpenAI-compatible HTTPS allowlist, no secret/runtime artifacts tracked |

## Real-browser evidence

`node scripts/verify-browser-evidence.mjs .planning/evidence/phase4-browser-matrix.json` passes 15 required cases and verifies four JPEGs by SHA-256 and dimensions.

| Evidence | Size | SHA-256 |
|---|---:|---|
| Xugu materials desktop | 1440×900 | `4785432b6ff3c6ea1a380a431bba32f6026b7b917d90dc887be0ee2d604e313d` |
| Standard materials desktop | 1440×900 | `3a7ab62c4a5b2f5e285cd67ed553453f6f857eac83c856f6e84b8e72b022f11e` |
| Tablet | 1024×768 | `887b1307962cfecc015331ac7869e73f3bf69d205e38a7ab13e6eb8597287ad9` |
| Mobile | 390×844 | `f3463effdda78c673ade3ce320f1f4c293f37c8a2d014a963f9ab020693977dd` |

The matrix covers both project ledgers, intake gates, manual material, exact evidence navigation, citation/refusal contracts, disabled provider, roles, project-switch clearing, tablet/mobile layouts, security payloads, zero browser warnings/errors/dialogs and reference integrity.

## Reference integrity

- HEAD: `97cb1ebfbbd4998cdb32d419a5670f1233b7cba8`
- `git status --short`: empty
- `data/state.seed.json` SHA-256: `b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa`

## Boundary

Update-template choice remains metadata only. Q&A is read-only. Phase 4 does not generate proposals, merge changes, publish versions or roll back projects; those actions remain Phase 5–6.
