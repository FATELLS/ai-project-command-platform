# Phase 7 Validation Architecture

状态：`ready`

| Layer | Blocking evidence |
|---|---|
| Material readiness | six template rules, ready/warning/blocked snapshots, critical missing blocks or downgrades generation |
| Unit lifecycle | create/archive/exit schema, no physical delete, inactive-unit graph checks, companion task migration gates |
| Review/release | lifecycle warnings, blocked accept/merge cases, copy-on-write integrity, published history preservation |
| Observability | requestId headers/body, error_events, operation_traces, redacted stacks, background job trace linkage |
| Diagnostics UI | admin-only error search, diagnostic bundle export, no secret/material/prompt leakage |
| Product tests | versioned catalog, isolated runs, persisted results, verify integration, browser coverage |
| Security | project isolation, role boundaries, CSRF, uniform unauthorized responses, redaction tests |

Any material-driven high-impact update without evidence, inactive unit with unresolved active work, hidden physical unit deletion, missing requestId on errors, unredacted secret/material text in diagnostics, test-center mutation of real published data or viewer access to diagnostics blocks Phase 7 completion.
