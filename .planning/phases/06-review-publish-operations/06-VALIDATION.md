# Phase 6 Validation Architecture

状态：`ready`

| Layer | Blocking evidence |
|---|---|
| Migration/version store | migration 006 repeat/rollback, composite project FKs, copy-on-write clone fidelity |
| Review | role/CSRF, original/proposed values, edit revalidation, module accept, complete decision gate |
| Merge/release | atomic draft merge, graph validation, stale block, publish clone, new draft baseline, direct-predecessor rollback |
| Operations | append-only audit, backup quick_check/restore safety, sanitized import/export |
| Eval/security | reference cases, cross-project IDs, high-impact checks, no proposal direct publish, Xugu UAT |
| Browser/unified | Xugu/standard review, release preview, permissions, three viewports, console, reference integrity |

Any partial pointer update, direct proposal-to-published path, cross-project review/version relation, invalid graph, unreviewed merge, arbitrary rollback target, missing audit, unsafe restore, Xugu fact loss or browser blocker fails the phase.
