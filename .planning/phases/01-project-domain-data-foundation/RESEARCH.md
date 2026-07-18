# Phase 1 Research: Project Domain and Data Foundation

Status: `complete`
Date: 2026-07-18

## Inputs inspected

- Current accepted architecture, requirements, migration contract, AI contract, and Xugu fixture.
- Read-only reference application at `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`.
- Reference `data/state.seed.json`, `server.mjs`, validation logic, and verification script.
- Official Node.js SQLite documentation for the locally available runtime family.

## Baseline facts

- The committed fixture and the reference application's sanitized seed have the same SHA-256: `b134f5493834d55f61aa47d9b9fac855c502ee67c0b59253e9498c214e4adcfa`.
- The fixture contains published and draft `v4.2` snapshots, 7 units, 29 tasks, 6 stages, 2 closures, 4 company workstreams, and no material records.
- Task IDs are unique. Parent and dependency links are project-local and unit-local; validation must also reject cycles.
- The reference `/api/public` returns only `published`; admin writes `draft`; publishing is explicit. The platform must preserve this behavior while adding a project namespace.

## Runtime and SQLite decision

Use the built-in `node:sqlite` `DatabaseSync` API and raise the platform runtime floor to Node.js 24.15.

Rationale:

- The current development runtime is Node.js 25.9 and already provides the API.
- Node.js documents `node:sqlite` as available since 22.5, no longer flag-gated since 22.13, and release-candidate stability since 24.15.
- This avoids a native npm dependency and keeps the single-server distribution small.
- The reference application's Node 18 compatibility remains unchanged because the reference application is not modified.

Risk control:

- Fail fast with a clear runtime-version error.
- Keep all SQLite usage behind `src/db/` and repository interfaces so a future driver or PostgreSQL migration does not leak into HTTP handlers.
- Enable foreign keys, WAL, busy timeout, and transactional migrations.

## Domain and persistence model

Use normalized, version-scoped entities rather than one project JSON document.

Core tables:

- `schema_migrations`
- `templates`
- `users`
- `projects`
- `project_members`
- `project_versions`
- `project_modules`
- `project_units`
- `project_stages`
- `project_closures`
- `project_tasks`
- `task_links`
- `project_workstreams`
- `workstream_tasks`
- `change_proposals`

Model rules:

- `projects.id` is the stable external project ID; the first value is `xugu-agentic-group`.
- `projects.published_version_id` and `projects.draft_version_id` point to different version rows even when their content is initially equal.
- `project_versions.layer` is limited to `published` or `draft`; proposals live in `change_proposals`, never in either version layer.
- Units, stages, closures, tasks, modules, and workstreams are separate version-scoped rows with stable external IDs and explicit ordering.
- Task parent/dependency relations are relational rows, not trusted only from JSON.
- Entity-specific JSON may retain presentation fields not yet promoted to columns, but no table stores the entire project as a single opaque JSON blob.
- Every query for project content begins with a resolved `project_id` and version owned by that project.

## Transaction and integrity rules

- Apply migrations in a single exclusive transaction and record their checksums.
- Import one fixture in a single transaction.
- Use foreign keys and composite uniqueness for `(version_id, external_id)`.
- Validate duplicate IDs, missing units, missing parents/dependencies, cross-unit links, self-links, and cycles before writing.
- Roll back the full import on any error; never leave a partial project.
- Treat an identical repeated import as idempotent. Reject a conflicting project unless an explicit replace mode is introduced later.

## Import and export contract

Importer input remains the sanitized legacy fixture shape:

```text
{ published, draft, materials }
```

Import behavior:

1. Require an empty `materials` list for the Phase 1 fixture.
2. Validate both snapshots before opening the write transaction.
3. Upsert the `campaign-map-v1` template metadata.
4. Create the stable project and separate published/draft version rows.
5. Insert all version-scoped entities and task/workstream links in source order.
6. Point the project to the two imported versions only after both are complete.

Exporter behavior:

- Reconstruct the legacy semantic shape from normalized rows.
- Preserve stable IDs, ordering, null versus empty-string values, parent/dependency arrays, and presentation metadata.
- Verification compares canonicalized JSON semantics, not whitespace.

## API contract for Phase 1

Implement a small JSON HTTP server with no UI or authentication claims yet:

- `GET /health`
- `GET /api/projects`
- `GET /api/projects/:projectId/public`
- `GET /api/projects/:projectId/draft`
- `GET /api/public` as a temporary compatibility alias for `xugu-agentic-group` published data

Rules:

- Validate project IDs before lookup.
- Return 404 for unknown projects without falling back to another project.
- Public reads resolve only `published_version_id`; draft reads resolve only `draft_version_id`.
- No Phase 1 route publishes, merges proposals, uploads materials, or claims authentication/authorization.
- Phase 2 must place draft access behind roles/sessions before broader deployment.

## Verification strategy

Automated tests must cover:

- Fresh database migration and repeat migration.
- Fixture import counts: 1 project, 2 versions, 14 unit rows, 58 task rows, plus expected stages/closures/workstreams per layer.
- Stable IDs and project pointers.
- Missing dependency, cross-unit dependency, self-link, and cycle rejection.
- Transaction rollback after an invalid import.
- Idempotent repeat import and conflicting import rejection.
- Export semantic equality for published and draft.
- API namespace isolation using a second synthetic project.
- Compatibility `/api/public` response equivalence.
- Reference repository Git status and seed checksum unchanged after execution.

## Implementation guidance

- Keep SQL migrations in `src/db/migrations/` and make migration order deterministic.
- Keep legacy-shape validation/canonicalization in `src/domain/`.
- Keep all SQL in `src/repositories/` or narrowly scoped persistence modules.
- Make `PLATFORM_DATA_DIR` select the runtime data directory for tests and parallel instances; never write the database into Git.
- Extend `npm run verify` to run syntax checks, unit/integration tests, migration/import/export checks, API smoke tests, sensitive-file checks, and the reference read-only assertion.

## Deferred work

- Login, sessions, complete role enforcement, project creation UI, module renderers, materials, evidence, AI generation, review, publish, rollback, and audit are later phases.
- Phase 1 may create schema placeholders required by accepted architecture, but must not claim those later capabilities are implemented.
