# ADR-003: Two-Service Operational Budget

- **Status**: Accepted
- **Date**: 2026-08-04
- **Authority**: G01, REFACTOR-PLAN §4.3, constitution C-02

## Context

The original platform shipped with XuguDB bundled, requiring complex lifecycle management:
- Platform binary + Xugu binary + Docker (on macOS) + DLLs (on Windows)
- Three lifecycle modes (native/managed/external) with different code paths
- Bootstrap scripts for each platform
- Container image management

This created significant operational and maintenance overhead.

## Decision

Enforce a strict **two-service operational budget**:

| Mode | Services | Description |
|---|---|---|
| Compact (default) | app + PostgreSQL | Application process + local PostgreSQL instance |
| External DB | app only | Application connects to external/shared PostgreSQL |

### Rules
- **Maximum 2 running services** in any deployment
- No Redis, no message queue, no object storage, no Kubernetes
- Background jobs (material extraction, AI generation) run **in-process** within the app
- Frontend is served by the same Fastify process (no separate frontend server)
- Vue built assets are static files served by Fastify static plugin

### Background Job Handling
- Long-running tasks (material extraction, AI provider calls) execute in-process
- No external worker process — the app handles everything
- Jobs are tracked in PostgreSQL with status updates
- Quota and concurrency limits prevent resource exhaustion

## Consequences

### Positive
- Dramatically simpler operations: `npm start` + `pg_ctl start`
- One command install: `curl | bash` (Linux/macOS), `irm | iex` (Windows)
- No container orchestration needed
- Lower memory footprint (no separate processes)
- Easier debugging (single process, single log stream)

### Negative
- Background job failure can affect request handling if not properly isolated
- Cannot scale background processing independently
- In-process jobs consume app memory (mitigated by concurrency limits)

### Mitigation
- Use `worker_threads` for CPU-intensive extraction if needed
- Set hard concurrency limits per job type
- Monitor RSS against 256 MiB budget
- If load grows beyond capacity, write ADR to revisit (don't silently add services)

## Supersedes

- `CONTAINER_CLI` environment variable
- `scripts/manage-server.mjs` (Xugu lifecycle management)
- Three lifecycle modes (native/managed/external)
- Docker image management (`vendor/xugudb/image/`)
