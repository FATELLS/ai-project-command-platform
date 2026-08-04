# ADR-002: Modular Monolith Architecture

- **Status**: Accepted
- **Date**: 2026-08-04
- **Authority**: G01, REFACTOR-PLAN §6.1, constitution C-02

## Context

The platform needs an architecture that:
- Supports multiple business domains (projects, materials, AI services, change governance)
- Can be developed and tested independently per domain
- Doesn't introduce distributed system complexity (network calls, serialization, deployment coordination)
- Can scale to the product's expected load (team-level, not internet-scale)

Options considered:
1. **Microservices** — overkill for the expected load; adds network latency, deployment complexity, distributed transaction challenges
2. **Modular monolith** — domain-separated code with single deployment unit
3. **Single-layer monolith** (current vanilla JS) — no domain boundaries, hard to maintain

## Decision

Adopt **modular monolith**: a single application with clear module boundaries.

### Structure
```
apps/api/src/modules/<domain>/
├── <domain>.routes.ts       # HTTP protocol layer
├── <domain>.schemas.ts      # JSON Schema + derived types
├── <domain>.service.ts      # Business logic + transaction boundary
├── <domain>.repository.ts   # Database queries (Kysely)
├── <domain>.mapper.ts       # Pure data transformation
├── <domain>.errors.ts       # Stable error types + codes
└── <domain>.types.ts        # Types not derivable from schema/DB
```

### Rules
- Modules communicate only through each other's `index.ts` public API
- No cross-module imports of internal files (repository, service internals)
- No circular dependencies between modules
- Each module owns its database tables
- Shared infrastructure (DB, config, logging) via Fastify plugins

## Consequences

### Positive
- Clear ownership and boundaries without network overhead
- Easy to test: mock module boundaries or use real PostgreSQL
- Can extract to microservices later if needed (module boundaries are the seam)
- Single deployment, single process, simple debugging

### Negative
- Cannot independently scale individual domains (acceptable for expected load)
- Module boundary discipline must be enforced by CI (dependency graph check)

## Enforcement

- ESLint import rules: `no-restricted-paths` + `no-cycle`
- CI dependency graph check
- Code review checklist (constitution C-17)
