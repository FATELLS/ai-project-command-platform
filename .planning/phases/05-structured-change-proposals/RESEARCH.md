# Phase 5 Research: Structured Change Proposals

状态：`complete`
日期：2026-07-18

## Executive finding

Phase 5 should extend the existing Phase 4 provider/quota/evidence boundary, not introduce an agent framework. The safest implementation is a server-owned job pipeline: lock one project/published base/template/material/evidence envelope, request one strict no-tools JSON result, validate it independently against repository state, then atomically persist an immutable proposal plus normalized change/evidence rows. There is no code-generation, tool, draft or publish path.

## Existing foundations

- `projects.published_version_id` and `draft_version_id` already point to independent normalized graphs; triggers enforce project/layer ownership.
- `change_proposals` already provides proposal identity, `project_id`, `base_version_id`, status, schema version and payload JSON, but needs normalized job, item, evidence and attempt records for Phase 5 operations and audits.
- Phase 4 materials have composite project ownership, current extraction generation, stable evidence IDs and versioned update-template selections.
- The provider adapter already requires an allowlisted HTTPS host, disables streaming/tools, caps output and retries only bounded transient failures. The factory defaults to disabled; fake is test-injected only.
- `ai_usage_events` already separates `chat` and `generation`, persists reservation outcomes and shares a bounded global semaphore.
- `createProjectRepository().getModuleVersionGraph(projectId, "published")` returns the fixed-module structural graph needed to validate targets, dates, dependencies, risks and metrics.

## Recommended data model

Migration 005 should preserve migrations 001–004 and add:

- `material_generation_grants(project_id, material_id, enabled, granted_by, granted_at)` independent from Q&A grants.
- `generation_jobs`: project, base version, template/schema versions, state/lease, selected-material digest, idempotency key, creator, error/validation summary, proposal link and timestamps.
- `generation_job_materials`: normalized ordered selected materials plus locked extraction version.
- `generation_job_evidence`: normalized ordered evidence allowlist and content hash.
- `generation_attempts`: attempt kind/result, aggregate usage/latency/provider-safe label/pricing metadata; no prompt or raw output.
- `change_proposal_items`: proposal-local stable change ID, module, operation, target, semantic type, patch JSON, confidence, warnings and validation status.
- `change_proposal_evidence`: item-to-evidence relation with the same project enforced through composite foreign keys.

The existing `change_proposals.payload_json` may retain the exact validated immutable envelope for export/audit, while operational queries use normalized items. Neither triggers nor services may update project version pointers.

## Six-template catalog

Use immutable server definitions matching the existing material intent IDs. Each definition includes ID/version/label variants, allowed module types, operations, patch-field schemas, high-impact fields and maximum changes. Unknown IDs/versions fail closed.

- Meeting notes: task/risk/outcome create/update, no delete.
- Project plan: unit/roadmap/task/risk/metric create/update with warned delete where explicitly allowed.
- Progress report: task/risk/outcome/metric update/create; progress/completion/results require evidence.
- Metrics data: metric create/update, typed values, dates and units.
- Outcome archive: outcome create/update and mandatory source evidence.
- New project material: create-only deltas against an already-created empty project shell; it does not create the project or replace a whole snapshot.

## Validation order

1. Parse bounded JSON with exact keys and `change-proposal-v1@1.0.0`.
2. Require output project/base/template/material arrays to exactly equal the locked job envelope.
3. Validate stable IDs, semantic enum, confidence, warnings, module/operation/patch field allowlists and executable-content prohibition.
4. Requery route project, current published pointer, job materials and evidence in one transaction; stale base never auto-rebases.
5. Validate evidence project/material/current-generation/content hash; all facts and high-impact fields require direct evidence.
6. Apply changes to an in-memory structural copy for validation only: target existence, create collisions, duplicates, ISO date order, same-unit parents/dependencies and DAG cycle checks.
7. Reject conflicting repeated operations and excessive/whole-project rewrites; append deterministic warning codes for low confidence, suggestions, unknowns, deletes and high-impact fields.
8. Persist top-level proposal, item and evidence rows atomically only after all blocking checks pass.

## Generation pipeline

- `POST` creates one job using a client idempotency key plus server digest of project/base/template/materials. Role, grant, readiness, template agreement, evidence limits and generation quota are checked before acceptance.
- A worker claims an expiring lease, rebuilds the locked context, and fails stale if the published pointer changed.
- The prompt contains a fixed system contract, exact compact schema, template constraints, published allowlist and evidence marked as untrusted. The model cannot choose project, base, URLs, files or tools.
- Provider output is buffered. Invalid JSON/schema/reference may receive one repair request with only safe validation codes and the same context; all attempts count toward usage and are logged as aggregates.
- Success writes proposal/items/evidence and terminal job status in one transaction. Failure stores a stable redacted error and never exposes raw output.
- Retrying creates a new immutable lineage/idempotent job as appropriate; it never overwrites a successful proposal or bypasses generation quota.

## API and UI

Canonical APIs live below `/api/projects/:projectId/generation-tasks` and `/api/projects/:projectId/change-proposals`. Every object lookup rebinds route project. Writes require CSRF; viewer is read-only; editor/admin can create and retry; only admins manage generation grants. No endpoint exists for accept/reject/edit/merge/publish/rollback in Phase 5.

The fixed Materials renderer adds proposal/task surfaces. It displays task lifecycle, locked context, token/cost aggregates, validated items, semantics, confidence, warnings and evidence deep links as text. It must state that the proposal has not changed draft/published and must not expose prompt/model/key controls.

## Failure modes and tests

Blocking cases include cross-project material/evidence/target IDs, stale base, mixed templates, non-ready or stale-generation materials, invalid schema/extra keys, tool calls, output truncation/oversize, high-impact fact without evidence, suggestion rendered as fact, invalid/cross-unit/cyclic dependencies, date inversion, duplicate IDs/names, repeated/conflicting changes, double submit, expired lease, provider disabled/timeout/429/5xx, repair failure, quota/concurrency bypass and prompt injection.

For every exit, fingerprint `published`/`draft` pointers and graphs before/after. They must be byte/semantic unchanged. `npm run verify` must remain no-key and preserve the read-only Xugu reference snapshot.

## Planning implication

Implement in four waves: persistence/catalog/schema; validator/context/generation; API/fixed UI; unified/browser verification and closure. Phase 6 alone owns review decisions, draft merge, preview, publish and rollback.
