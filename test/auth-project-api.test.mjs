import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthRepository } from "../src/repositories/auth-repository.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";
import { createProjectService } from "../src/services/project-service.mjs";
import { hashPassword } from "../src/security/passwords.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const testPassword = "a-secure-test-password";

function addUser(database, input) {
  const repository = createAuthRepository(database);
  const at = "2026-07-18T00:00:00.000Z";
  repository.insertUser({
    id: input.id,
    displayName: input.displayName,
    loginName: input.loginName,
    ...hashPassword(input.password ?? testPassword),
    status: input.status ?? "active",
    isPlatformAdmin: input.isPlatformAdmin ?? false,
    createdAt: at,
    updatedAt: at
  });
}

async function setup(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "platform-auth-api-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
  const authService = createAuthService(database, options.authOptions);
  authService.ensureBootstrapAdmin({ loginName: "admin", password: testPassword, displayName: "Admin" });
  const projectService = createProjectService(database, options.projectOptions);
  const server = createServer(createApp({
    database,
    authService,
    projectService,
    now: options.now,
    loginLimit: options.loginLimit,
    loginWindowMs: options.loginWindowMs
  }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    database,
    authService,
    projectService,
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise(resolve => server.close(resolve));
      database.close();
    }
  };
}

async function request(context, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-csrf-token"] = options.csrf;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${context.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json();
  return { response, payload };
}

async function login(context, loginName = "admin", password = testPassword) {
  const { response, payload } = await request(context, "/api/login", {
    method: "POST",
    body: { loginName, password }
  });
  assert.equal(response.status, 200);
  return {
    cookie: response.headers.get("set-cookie").split(";", 1)[0],
    csrf: payload.csrfToken,
    user: payload.user
  };
}

test("unauthenticated routes require login and session/logout route works", async () => {
  const context = await setup();
  try {
    assert.equal((await request(context, "/api/projects")).response.status, 401);
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public")).response.status, 401);
    const admin = await login(context);
    const session = await request(context, "/api/session", { cookie: admin.cookie });
    assert.equal(session.payload.user.isPlatformAdmin, true);
    assert.equal(session.payload.csrfToken, admin.csrf);
    const logout = await request(context, "/api/logout", { method: "POST", cookie: admin.cookie, csrf: admin.csrf });
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal((await request(context, "/api/session", { cookie: admin.cookie })).response.status, 401);
  } finally { await context.close(); }
});

test("viewer, editor, project admin, and platform admin role matrix is enforced", async () => {
  const context = await setup();
  try {
    for (const role of ["viewer", "project_editor", "project_admin"]) {
      const id = `usr_${role}`;
      addUser(context.database, { id, loginName: role, displayName: role });
      context.database.prepare("INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
        .run("xugu-agentic-group", id, role, "2026-07-18T00:00:00.000Z");
    }
    addUser(context.database, { id: "usr_outsider", loginName: "outsider", displayName: "Outsider" });

    const viewer = await login(context, "viewer");
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public", { cookie: viewer.cookie })).response.status, 200);
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft", { cookie: viewer.cookie })).response.status, 404);
    const viewerList = await request(context, "/api/projects", { cookie: viewer.cookie });
    assert.equal(viewerList.payload.projects[0].role, "viewer");
    assert.equal(JSON.stringify(viewerList.payload).includes("draftVersion"), false);

    for (const role of ["project_editor", "project_admin"]) {
      const user = await login(context, role);
      assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft", { cookie: user.cookie })).response.status, 200);
    }
    const outsider = await login(context, "outsider");
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public", { cookie: outsider.cookie })).response.status, 404);
    assert.equal((await request(context, "/api/projects/does-not-exist/public", { cookie: outsider.cookie })).response.status, 404);
    assert.equal(context.database.prepare("SELECT count(*) AS count FROM recent_project_access WHERE user_id = ?").get("usr_outsider").count, 0);

    const admin = await login(context);
    const adminList = await request(context, "/api/projects", { cookie: admin.cookie });
    assert.equal(adminList.payload.projects[0].role, "platform_admin");
    assert.equal((await request(context, "/api/public", { cookie: admin.cookie })).payload.version, "v4.2");
  } finally { await context.close(); }
});

test("authorized list supports factual summaries, search, status, and recent top four", async () => {
  let clock = Date.parse("2026-07-18T08:00:00.000Z");
  const context = await setup({ now: () => clock, projectOptions: { now: () => clock } });
  try {
    const admin = await login(context);
    const principal = { id: admin.user.id, isPlatformAdmin: true };
    for (let index = 1; index <= 5; index += 1) {
      context.projectService.createProject(principal, {
        id: `sample-project-${index}`,
        name: `Sample Project ${index}`,
        templateId: "standard-project-v1"
      });
      clock += 1_000;
      const opened = await request(context, `/api/projects/sample-project-${index}/public`, { cookie: admin.cookie });
      assert.equal(opened.response.status, 200);
      assert.equal(opened.payload.snapshot.overallProgress, null);
    }
    const list = await request(context, "/api/projects?sort=recent", { cookie: admin.cookie });
    assert.equal(list.payload.recent.length, 4);
    assert.deepEqual(list.payload.recent.map(item => item.id), [
      "sample-project-5", "sample-project-4", "sample-project-3", "sample-project-2"
    ]);
    const xugu = list.payload.projects.find(item => item.id === "xugu-agentic-group");
    assert.deepEqual({ units: xugu.unitCount, tasks: xugu.taskCount, stages: xugu.stageCount }, { units: 7, tasks: 29, stages: 6 });
    assert.equal(xugu.publishedVersion, "v4.2");
    const search = await request(context, "/api/projects?q=sample-project-3&sort=name", { cookie: admin.cookie });
    assert.deepEqual(search.payload.projects.map(item => item.id), ["sample-project-3"]);
  } finally { await context.close(); }
});

test("platform admin lifecycle is CSRF-protected and transactionally audited", async () => {
  const context = await setup();
  try {
    const admin = await login(context);
    const missingCsrf = await request(context, "/api/projects", {
      method: "POST", cookie: admin.cookie, body: { id: "second-project", name: "Second project", templateId: "standard-project-v1" }
    });
    assert.equal(missingCsrf.response.status, 403);
    assert.equal(context.database.prepare("SELECT count(*) AS count FROM projects WHERE id = 'second-project'").get().count, 0);

    const created = await request(context, "/api/projects", {
      method: "POST", cookie: admin.cookie, csrf: admin.csrf,
      body: { id: "second-project", name: "Second project", templateId: "standard-project-v1" }
    });
    assert.equal(created.response.status, 201);
    const project = context.database.prepare("SELECT * FROM projects WHERE id = 'second-project'").get();
    assert.notEqual(project.published_version_id, project.draft_version_id);
    assert.equal(context.database.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get("second-project", admin.user.id).role, "project_admin");

    const edited = await request(context, "/api/projects/second-project", {
      method: "PATCH", cookie: admin.cookie, csrf: admin.csrf,
      body: { name: "Second project renamed", themePreset: "deep-navy", terminologyPreset: "standard" }
    });
    assert.equal(edited.payload.project.name, "Second project renamed");
    const archived = await request(context, "/api/projects/second-project/archive", { method: "POST", cookie: admin.cookie, csrf: admin.csrf });
    assert.equal(archived.payload.project.status, "archived");
    assert.equal((await request(context, "/api/projects/second-project/public", { cookie: admin.cookie })).response.status, 404);
    const archivedList = await request(context, "/api/projects?status=archived", { cookie: admin.cookie });
    assert.deepEqual(archivedList.payload.projects.map(item => item.id), ["second-project"]);
    const restored = await request(context, "/api/projects/second-project/restore", { method: "POST", cookie: admin.cookie, csrf: admin.csrf });
    assert.equal(restored.payload.project.status, "active");
    assert.deepEqual(
      context.database.prepare("SELECT action FROM audit_events WHERE project_id = ? ORDER BY id").all("second-project").map(row => row.action),
      ["project.created", "project.edited", "project.archived", "project.restored"]
    );
  } finally { await context.close(); }
});

test("non-admin lifecycle is forbidden even with valid CSRF", async () => {
  const context = await setup();
  try {
    addUser(context.database, { id: "usr_viewer", loginName: "viewer", displayName: "Viewer" });
    context.database.prepare("INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'viewer', ?)")
      .run("xugu-agentic-group", "usr_viewer", "2026-07-18T00:00:00.000Z");
    const viewer = await login(context, "viewer");
    const result = await request(context, "/api/projects", {
      method: "POST", cookie: viewer.cookie, csrf: viewer.csrf,
      body: { id: "forbidden-project", name: "Forbidden project", templateId: "standard-project-v1" }
    });
    assert.equal(result.response.status, 403);
    assert.equal(context.database.prepare("SELECT count(*) AS count FROM projects WHERE id = 'forbidden-project'").get().count, 0);
  } finally { await context.close(); }
});

test("login route is rate limited", async () => {
  const context = await setup({ loginLimit: 2, loginWindowMs: 60_000 });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await request(context, "/api/login", { method: "POST", body: { loginName: "admin", password: "wrong-password-value" } });
      assert.equal(result.response.status, 401);
      assert.equal(result.payload.error, "账号或密码不正确");
    }
    assert.equal((await request(context, "/api/login", { method: "POST", body: { loginName: "admin", password: "wrong-password-value" } })).response.status, 429);
  } finally { await context.close(); }
});

function waitForOutput(child, pattern, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for server output: ${output}`)), timeoutMs);
    const onData = chunk => {
      output += chunk;
      if (pattern.test(output)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolve(output);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", code => {
      if (!pattern.test(output)) {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${output}`));
      }
    });
  });
}

async function stopChild(child) {
  child.kill("SIGTERM");
  await new Promise(resolve => child.once("exit", resolve));
}

test("bootstrap server requires first-run secret and later restarts without it", async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "platform-bootstrap-server-"));
  const baseEnv = { ...process.env, PLATFORM_DATA_DIR: dataDirectory, HOST: "127.0.0.1", PORT: "0" };
  const missing = spawnSync(process.execPath, ["server.mjs"], { cwd: new URL("..", import.meta.url), env: baseEnv, encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /PLATFORM_BOOTSTRAP_PASSWORD/);

  const first = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...baseEnv, PLATFORM_BOOTSTRAP_PASSWORD: testPassword },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForOutput(first, /listening/);
  await stopChild(first);

  const second = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url), env: baseEnv, stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForOutput(second, /listening/);
  await stopChild(second);
});
