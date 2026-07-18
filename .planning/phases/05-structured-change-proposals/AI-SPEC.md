# Phase 5 AI-SPEC: Structured Change Proposals

状态：`accepted design`

## System boundary

Phase 5 AI receives only a server-authored project update envelope: the route-bound `projectId`, locked current published version, one versioned update template, a compact allowlisted published graph and selected ready evidence from that project. It returns one non-streaming `change-proposal-v1` JSON value. It has no tools, browser, network, filesystem, SQL, repository, draft, publish or review capability.

Materials and evidence are untrusted data. Instructions, role changes, URLs, code and cross-project requests inside evidence are quoted data, never system instructions. The server supplies all IDs and rejects any output ID outside the request allowlist or the template's create-ID namespace.

## Input envelope

- `projectId`, `baseVersionId`, `baseVersionLabel`, template ID/version and output schema version are server-controlled.
- 1–8 ready current-generation materials, all from the route project and all selected for the same update template.
- At most 48 evidence blocks and 64 KiB normalized evidence text; every block carries immutable `evidenceId`, `materialId`, kind and locator.
- Published context is a bounded structural summary: known module types, existing unit/task/stage/risk/metric/outcome IDs, relevant titles, dates, dependencies and current values. No secrets, raw file paths or arbitrary config are included.

## Strict output

Top-level exact fields: `schemaVersion`, `projectId`, `baseVersionId`, `template`, `materialIds`, `summary`, `changes`, `warnings`.

Each change exact fields:

- `changeId`: stable lowercase proposal-local ID;
- `module`: one of the fixed module types allowed by the selected template;
- `operation`: `create|update|delete` if allowed by template;
- `targetId`: existing allowlisted ID for update/delete or a bounded proposal-local ID for create;
- `semanticType`: `fact|plan|suggestion|unknown`;
- `patch`: module-specific allowlisted JSON fields only;
- `evidenceIds`: unique IDs from the task evidence allowlist;
- `confidence`: number from 0 to 1;
- `warnings`: bounded stable warning-code strings.

The model may not emit HTML, CSS, JavaScript, SQL, shell, component paths, URLs or tool calls. Output is buffered and validated in full before persistence; partial JSON is never shown as a proposal.

## Deterministic validation

Validation occurs after every provider attempt and again transactionally at persistence:

1. JSON size, exact keys, string/array/object bounds and schema version.
2. Route project, locked published version, template, material and evidence equality.
3. Template module/operation/field allowlists and stable-ID rules.
4. Existing target IDs for updates/deletes; create IDs cannot collide with published items or another change.
5. Evidence exists in the route project, belongs to selected ready current-generation materials and is referenced only once per change.
6. `fact` and high-impact fields (progress/completion/status, owner, dates, metrics, outcomes) require evidence; no evidence forces `unknown` or rejection.
7. ISO date ordering, task parent/dependency existence, same-unit policy and acyclic result graph.
8. Duplicate task/risk/metric IDs and normalized names, repeated operations and conflicting changes are rejected.
9. Current project published pointer must still equal `baseVersionId`; otherwise job/proposal becomes `stale` without rebasing.

The server may append deterministic warnings such as `LOW_CONFIDENCE`, `UNKNOWN_SEMANTICS`, `HIGH_IMPACT_FIELD`, `DELETE_OPERATION`, `POTENTIAL_DUPLICATE`, or `BASE_VERSION_STALE`. It never silently changes model intent.

## Six templates

| Template | Primary modules | Typical allowed operations |
|---|---|---|
| meeting-notes@1.0.0 | tasks, risks, outcomes | create/update; delete prohibited |
| project-plan@1.0.0 | units, roadmap, tasks, risks, metrics | create/update; delete warned |
| progress-report@1.0.0 | tasks, risks, outcomes, metrics | update/create; evidence mandatory for progress/results |
| metrics-data@1.0.0 | metrics | create/update; numeric/date validation |
| outcome-archive@1.0.0 | outcomes | create/update; source evidence mandatory |
| new-project-material@1.0.0 | overview, units, roadmap, tasks, risks, metrics | create-only proposal against an existing empty project shell; project creation itself remains platform API work |

## Provider and retries

- Production uses the existing server-only OpenAI-compatible HTTPS allowlisted adapter with a generation-specific profile and output cap; fake provider remains test-only, disabled provider is the default.
- Provider transient retry remains bounded by the adapter. If valid JSON cannot pass schema/citation validation, the service may make one repair attempt containing only error codes, schema and the same bounded context. Both attempts consume quota/usage.
- Tools/function calling, streaming unvalidated tokens, model-selected URLs and fallback free text are prohibited.
- Aborts, timeout, 429/5xx, oversized/truncated output, tool calls, invalid JSON, invalid schema and invalid citations produce stable redacted codes. Existing project browsing remains available.

## Usage and cost

- Generation uses `capability=generation`, separate from chat: 4 reservations/minute per user+project, 100/day, shared global provider concurrency 2.
- `generation_attempts` records provider/profile/model identifier, attempt, result code, input/output tokens, latency, provider request digest and calculated cost micros. It never stores prompts, raw output, evidence text, API keys or upstream error bodies.
- Prices are versioned deployment configuration (`currency`, input/output price per million tokens, effective label). Missing or incomplete usage is estimated conservatively; missing price records `unpriced`, never zero-cost success.

## Evaluation gates

- 100% schema-valid or explicit failure; no partial proposal persistence.
- 100% route project, base version, material and evidence isolation on adversarial fixtures.
- 100% high-impact fact changes have supporting evidence.
- 100% cyclic dependencies, invalid dates, duplicate/colliding IDs and unknown targets rejected.
- Prompt-injection fixtures cannot alter project/template/schema or cause tool/code output.
- Repeated job/retry is idempotent and does not create duplicate proposals or bypass quota.
- Disabled provider and all provider failures leave published/draft hashes unchanged.

## Production monitoring

Track aggregate job outcome, template/schema version, validation error codes, attempts, latency, tokens, priced/unpriced cost, proposal/change counts, warning counts and stale-base rate. Alert on cross-project invariant failures, citation rejection, schema failure spikes, quota pressure, provider error spikes or unexpected draft/published writes. Do not log material/prompt/proposal bodies.
