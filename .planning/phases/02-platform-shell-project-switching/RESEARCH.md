# Phase 2 Research: Platform Shell, Authentication, and Project Switching

Status: `complete`
Date: 2026-07-18

## Inputs

- Accepted Phase 2 roadmap and PLAT-01/02, AUTH-01/02 requirements.
- Phase 1 schema, repository, API, migration tests, and verification evidence.
- Phase 2 `UI-SPEC.md` and the read-only Xugu application's visual language.
- Node.js crypto documentation and OWASP password/session guidance.

## Decisions

### Runtime shape

Continue with the dependency-free Node.js HTTP server, SQLite repositories, and local static assets. Do not add a frontend framework or remote CDN in Phase 2. Route handling, authorization, and UI state remain small enough for tested local modules.

### Password storage

- Use `node:crypto` `scryptSync` with a random 16-byte salt and `timingSafeEqual` verification.
- Use `N=2^15`, `r=8`, `p=3`, 64-byte output, and an explicit memory ceiling above the algorithm requirement.
- Accept passwords from 12 to 128 Unicode characters for bootstrap and login.
- Store salt, derived hash, and algorithm parameters; never plaintext or reversible encryption.
- Return one generic login failure for unknown user, disabled user, and wrong password.

OWASP lists scrypt as the fallback when Argon2id is unavailable and includes `N=2^15, r=8, p=3` among its equivalent minimum configurations: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Bootstrap administrator

- A fresh database requires `PLATFORM_BOOTSTRAP_PASSWORD` of at least 12 characters.
- Default login name is `admin`, overridable with `PLATFORM_BOOTSTRAP_USERNAME`.
- Bootstrap occurs only when no platform administrator exists; the password is never logged.
- Once an administrator exists, later starts do not require or consume the bootstrap password.
- Verification and browser tests inject a temporary bootstrap password through the child-process environment.

### Session model

- Generate a 32-byte random session token and store only its SHA-256 hash.
- Send the raw token only in an HttpOnly, `SameSite=Strict`, `Path=/` cookie with no Domain attribute.
- Add `Secure` when the server is configured for HTTPS. Local HTTP is explicitly development-only.
- Do not store session tokens, passwords, or CSRF tokens in local/session storage.
- Enforce 30-minute idle timeout and 8-hour absolute timeout on the server.
- Logout deletes the database session and expires the cookie.
- Store a separate random CSRF token with the session; authenticated session JSON may return it, and all state-changing requests require `X-CSRF-Token`.

OWASP recommends CSPRNG session IDs with at least 64 bits of entropy, cookie-only exchange, HttpOnly, explicit SameSite, and server-enforced idle/absolute expiry: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

### Login abuse control

- Bound JSON bodies to 64 KiB.
- Rate-limit login by normalized remote address with a small in-memory sliding window.
- Perform one dummy scrypt verification for unknown users to reduce username timing disclosure.
- Add `Cache-Control: no-store` to all session and project API responses.

### Authorization model

Roles remain the accepted values:

- `platform_admin`: all projects and project lifecycle operations.
- `project_admin`: assigned project public/draft reads and later project member administration.
- `project_editor`: assigned project public/draft reads; no lifecycle operations.
- `viewer`: assigned project published reads only.

Rules:

- Platform admin access is an explicit user attribute; membership rows still use project roles.
- Project lists are filtered in SQL by the authenticated user.
- Public project reads require any membership or platform admin.
- Draft reads require platform admin, project admin, or project editor.
- Unauthorized, missing, and inaccessible archived project reads return the same 404 contract.
- Every mutating API re-resolves session and role inside the request; frontend visibility is not authorization.

### Project lifecycle

- Create is platform-admin only and accepts a stable lowercase ID, display name, and allowlisted template ID.
- Creation makes distinct empty published/draft version graphs and assigns the creator as project admin.
- Edit permits only display name, one of three theme presets, and one of two terminology presets.
- Archive/restore changes project status and timestamp; it never deletes versions.
- List supports query, status, and sort filters after authorization.
- Opening a project records `(user_id, project_id, last_accessed_at)` for recent ordering.

### Audit slice

Create an append-only `audit_events` table now and record login success/failure, logout, project create/edit/archive/restore, and denied high-impact mutations. Full audit coverage remains Phase 6.

## Schema migration

Add `002_auth_project_access.sql` without changing the applied Phase 1 migration:

- user login/password/platform-admin columns and a partial unique login index;
- `sessions` with token hash, CSRF token, timestamps, and expiry;
- `recent_project_access` keyed by user/project;
- `audit_events` with optional project/user association and JSON metadata.

Never edit `001_initial.sql`; migration checksum protection is already an accepted invariant.

## API contract

Public:

```text
GET  /health
POST /api/login
GET  /login and static assets
```

Authenticated:

```text
GET  /api/session
POST /api/logout
GET  /api/projects?q=&status=&sort=
GET  /api/projects/:projectId/public
GET  /api/projects/:projectId/draft
GET  /api/public
```

Platform admin + CSRF:

```text
POST  /api/projects
PATCH /api/projects/:projectId
POST  /api/projects/:projectId/archive
POST  /api/projects/:projectId/restore
```

`/api/public` remains a URL compatibility alias but now requires authorization to the Xugu project.

## Static application contract

- Serve committed files from `public/` with exact MIME types and path allowlisting.
- `/login`, `/projects`, and `/projects/:projectId` return the same application HTML for client routing.
- API and static responses use CSP, frame denial, no-sniff, referrer policy, and appropriate cache headers.
- Client fetch uses same-origin cookies; CSRF token remains in module memory.
- DOM rendering uses `textContent` and element construction for project data, never `innerHTML` with server content.

## Verification strategy

Automated:

- Migration 002 apply/repeat/checksum behavior.
- Bootstrap required, one-time creation, password hashing, generic failures, and login rate limit.
- Cookie attributes, token hashing, CSRF enforcement, logout invalidation, idle and absolute expiry.
- Four-role access matrix for list/public/draft/lifecycle routes.
- Search/status/recent ordering after authorization.
- Create/edit/archive/restore transaction behavior and stable-ID immutability.
- Unauthorized-or-missing indistinguishable 404 responses.
- Static route, CSP, direct `/projects/:id` refresh, and no project data before login.
- Two-project switch flow with URL/data isolation.

Browser:

- Execute the 12-item `UI-SPEC.md` browser acceptance checklist at desktop and mobile viewport.
- Capture evidence in `.planning/evidence/`; do not add QA screenshots to result assets.

## Deferred

- Password change/recovery, MFA/SSO, member-management UI, complete audit, HTTPS termination, module renderers, materials, AI proposals, publishing, and rollback.
