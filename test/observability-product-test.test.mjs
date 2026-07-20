import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthRepository } from "../src/repositories/auth-repository.mjs";
import { hashPassword } from "../src/security/passwords.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const password = "observability-password";
const at = "2026-07-20T00:00:00.000Z";

function addUser(db, id, login, role, projectIds = []) {
  createAuthRepository(db).insertUser({ id, displayName: login, loginName: login, ...hashPassword(password), createdAt: at, updatedAt: at });
  for (const projectId of projectIds) db.prepare("INSERT INTO project_members (project_id,user_id,role,created_at) VALUES (?,?,?,?)").run(projectId, id, role, at);
}

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "observability-api-"));
  const database = openDatabase(join(directory, "db.sqlite"));
  applyMigrations(database);
  importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: at });
  const authService = createAuthService(database);
  authService.ensureBootstrapAdmin({ loginName: "admin", password, displayName: "Admin" });
  addUser(database, "viewer", "viewer", "viewer", ["xugu-agentic-group"]);
  const server = createServer(createApp({ database, authService, enableSyntheticErrors: true }));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { database, baseUrl: `http://127.0.0.1:${server.address().port}`, async close() { await new Promise(resolve => server.close(resolve)); database.close(); } };
}

async function api(c, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.session) headers.cookie = options.session.cookie;
  if (options.csrf) headers["x-csrf-token"] = options.csrf;
  let body;
  if (options.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(options.body); }
  const response = await fetch(`${c.baseUrl}${path}`, { method: options.method ?? "GET", headers, body });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function login(c, loginName) {
  const result = await api(c, "/api/login", { method: "POST", body: { loginName, password } });
  return { cookie: result.response.headers.get("set-cookie").split(";", 1)[0], csrf: result.payload.csrfToken };
}

test("request id is returned and unknown errors are stored as redacted diagnostics", async () => {
  const c = await setup();
  try {
    const requestId = "req-observability-0001";
    const boom = await api(c, "/api/_test/boom", { headers: { "x-request-id": requestId } });
    assert.equal(boom.response.status, 500);
    assert.equal(boom.response.headers.get("x-request-id"), requestId);
    assert.equal(boom.payload.requestId, requestId);
    const admin = await login(c, "admin");
    const errors = await api(c, "/api/diagnostics/errors", { session: admin });
    assert.equal(errors.payload.items[0].requestId, requestId);
    const detail = await api(c, `/api/diagnostics/errors/${errors.payload.items[0].id}`, { session: admin });
    assert.match(detail.payload.event.stack, /Synthetic failure/);
    assert.doesNotMatch(detail.payload.event.stack, /secret-token/);
    const viewer = await login(c, "viewer");
    assert.equal((await api(c, "/api/diagnostics/errors", { session: viewer })).response.status, 404);
  } finally { await c.close(); }
});

test("product test center runs only for admins and stores case results", async () => {
  const c = await setup();
  try {
    const admin = await login(c, "admin");
    const run = await api(c, "/api/projects/xugu-agentic-group/test-runs", { method: "POST", session: admin, csrf: admin.csrf, body: { suiteId: "core" } });
    assert.equal(run.response.status, 201);
    assert.equal(run.payload.run.status, "passed");
    assert.equal(run.payload.cases.length, 5);
    const list = await api(c, "/api/projects/xugu-agentic-group/test-runs", { session: admin });
    assert.equal(list.payload.items.length, 1);
    const viewer = await login(c, "viewer");
    assert.equal((await api(c, "/api/projects/xugu-agentic-group/test-runs", { session: viewer })).response.status, 404);
  } finally { await c.close(); }
});
