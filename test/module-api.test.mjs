import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createModuleService, ModuleServiceError } from "../src/modules/module-service.mjs";
import { createAuthRepository } from "../src/repositories/auth-repository.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";
import { hashPassword } from "../src/security/passwords.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";

const xuguFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const standardFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/standard-project-sample.json", import.meta.url), "utf8"));
const password = "module-api-test-password";
const expectedTypes = ["overview", "roadmap", "units", "gantt", "outcomes", "risks", "metrics", "materials"];

function addUser(database, { id, loginName, role, projectIds = [] }) {
  const at = "2026-07-18T00:00:00.000Z";
  createAuthRepository(database).insertUser({
    id,
    displayName: loginName,
    loginName,
    ...hashPassword(password),
    createdAt: at,
    updatedAt: at
  });
  for (const projectId of projectIds) {
    database.prepare("INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
      .run(projectId, id, role, at);
  }
}

function seededDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "module-api-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  importLegacyProject(database, xuguFixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
  importLegacyProject(database, standardFixture, {
    projectId: "standard-project-sample",
    templateId: "standard-project-v1",
    now: "2027-03-08T09:30:00.000Z"
  });
  return database;
}

async function setup() {
  const database = seededDatabase();
  const authService = createAuthService(database);
  authService.ensureBootstrapAdmin({ loginName: "admin", password, displayName: "Admin" });
  addUser(database, { id: "usr_viewer", loginName: "viewer", role: "viewer", projectIds: ["xugu-agentic-group"] });
  addUser(database, { id: "usr_editor", loginName: "editor", role: "project_editor", projectIds: ["xugu-agentic-group", "standard-project-sample"] });
  addUser(database, { id: "usr_project_admin", loginName: "project-admin", role: "project_admin", projectIds: ["xugu-agentic-group"] });
  addUser(database, { id: "usr_outsider", loginName: "outsider", role: "viewer" });
  const server = createServer(createApp({ database, authService }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    database,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise(resolve => server.close(resolve));
      database.close();
    }
  };
}

async function request(context, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.session) headers.cookie = options.session.cookie;
  if (options.csrf) headers["x-csrf-token"] = options.csrf;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${context.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return { response, payload: await response.json() };
}

async function login(context, loginName) {
  const result = await request(context, "/api/login", { method: "POST", body: { loginName, password } });
  assert.equal(result.response.status, 200);
  return {
    cookie: result.response.headers.get("set-cookie").split(";", 1)[0],
    csrf: result.payload.csrfToken,
    user: result.payload.user
  };
}

function configurationFromManifest(manifest, order = manifest.modules.map(module => module.type)) {
  const byType = new Map(manifest.modules.map(module => [module.type, module]));
  return {
    modules: order.map((type, position) => {
      const module = byType.get(type);
      return {
        type,
        schemaVersion: module.schemaVersion,
        position,
        enabled: module.enabled,
        viewVariant: module.viewVariant
      };
    })
  };
}

test("repository and service return isolated same-version manifests and DTOs", () => {
  const database = seededDatabase();
  try {
    const repository = createProjectRepository(database);
    const xuguGraph = repository.getModuleVersionGraph("xugu-agentic-group", "published");
    const standardGraph = repository.getModuleVersionGraph("standard-project-sample", "published");
    assert.notEqual(xuguGraph.versionId, standardGraph.versionId);
    assert.deepEqual([xuguGraph.units.length, xuguGraph.tasks.length, xuguGraph.stages.length], [7, 29, 6]);
    assert.deepEqual([standardGraph.units.length, standardGraph.tasks.length, standardGraph.stages.length], [3, 7, 4]);
    const service = createModuleService(database);
    const principal = { id: "platform", isPlatformAdmin: true };
    const xugu = service.getModule(principal, "xugu-agentic-group", "public", "roadmap");
    const standard = service.getModule(principal, "standard-project-sample", "public", "roadmap");
    assert.deepEqual([xugu.version, xugu.module.viewVariant], ["v4.2", "campaign-network"]);
    assert.deepEqual([standard.version, standard.module.viewVariant], ["v1.3", "linear-roadmap"]);
    assert.equal(xugu.data.stages.find(stage => stage.id === "launch").previewAssets.length, 1);
    assert.match(xugu.data.stages.find(stage => stage.id === "launch").previewTitle, /首批场景/);
    assert.equal(JSON.stringify(standard).includes("虚谷"), false);
  } finally { database.close(); }
});

test("service draft update is complete-list, atomic, draft-only, reorderable, and fact-preserving", () => {
  const database = seededDatabase();
  try {
    const service = createModuleService(database);
    const principal = { id: "platform", isPlatformAdmin: true };
    const publishedVersion = createProjectRepository(database).resolveVersion("xugu-agentic-group", "published");
    const draftVersion = createProjectRepository(database).resolveVersion("xugu-agentic-group", "draft");
    const serializedRows = versionId => JSON.stringify(database.prepare(
      "SELECT external_id, module_type, position, enabled, data_json FROM project_modules WHERE version_id = ? ORDER BY position"
    ).all(versionId));
    const publishedBefore = serializedRows(publishedVersion.id);
    const factsBefore = database.prepare("SELECT count(*) AS count FROM project_tasks WHERE version_id = ?").get(draftVersion.id).count;
    const manifest = service.listModules(principal, "xugu-agentic-group", "draft");
    const order = ["overview", "units", "roadmap", "gantt", "outcomes", "risks", "metrics", "materials"];
    const input = configurationFromManifest(manifest, order);
    input.modules.find(module => module.type === "metrics").enabled = false;
    const updated = service.updateDraftModules(principal, "xugu-agentic-group", input);
    assert.deepEqual(updated.modules.map(module => module.type), order);
    assert.equal(updated.modules.find(module => module.type === "metrics").enabled, false);
    assert.equal(serializedRows(publishedVersion.id), publishedBefore);
    assert.equal(database.prepare("SELECT count(*) AS count FROM project_tasks WHERE version_id = ?").get(draftVersion.id).count, factsBefore);

    const draftBeforeInvalid = serializedRows(draftVersion.id);
    const invalid = structuredClone(input);
    invalid.modules[0].enabled = false;
    assert.throws(() => service.updateDraftModules(principal, "xugu-agentic-group", invalid), ModuleServiceError);
    assert.equal(serializedRows(draftVersion.id), draftBeforeInvalid);
  } finally { database.close(); }
});

test("module HTTP role matrix enforces public, draft, isolation, disabled, and safe 404 behavior", async () => {
  const context = await setup();
  try {
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public/modules")).response.status, 401);
    const viewer = await login(context, "viewer");
    const viewerManifest = await request(context, "/api/projects/xugu-agentic-group/public/modules", { session: viewer });
    assert.equal(viewerManifest.response.status, 200);
    assert.deepEqual(viewerManifest.payload.modules.map(module => module.type), expectedTypes);
    for (const type of expectedTypes) {
      assert.equal((await request(context, `/api/projects/xugu-agentic-group/public/modules/${type}`, { session: viewer })).response.status, 200);
    }
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft/modules", { session: viewer })).response.status, 404);
    assert.equal((await request(context, "/api/projects/standard-project-sample/public/modules", { session: viewer })).response.status, 404);

    for (const loginName of ["editor", "project-admin", "admin"]) {
      const session = await login(context, loginName);
      assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft/modules", { session })).response.status, 200);
    }
    const outsider = await login(context, "outsider");
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public/modules/overview", { session: outsider })).response.status, 404);
    assert.equal((await request(context, "/api/projects/unknown-project/public/modules/overview", { session: outsider })).response.status, 404);
    const unknown = await request(context, "/api/projects/xugu-agentic-group/public/modules/custom-page", { session: viewer });
    assert.equal(unknown.response.status, 404);
    assert.equal(unknown.payload.code, "MODULE_NOT_FOUND");
  } finally { await context.close(); }
});

test("draft module PATCH requires CSRF, validates bounded input, and never changes published", async () => {
  const context = await setup();
  try {
    const editor = await login(context, "editor");
    const draft = await request(context, "/api/projects/xugu-agentic-group/draft/modules", { session: editor });
    const input = configurationFromManifest(draft.payload);
    input.modules.find(module => module.type === "metrics").enabled = false;
    const publishedBefore = (await request(context, "/api/projects/xugu-agentic-group/public/modules", { session: editor })).payload;
    const missingCsrf = await request(context, "/api/projects/xugu-agentic-group/draft/modules", {
      method: "PATCH", session: editor, body: input
    });
    assert.equal(missingCsrf.response.status, 403);
    const saved = await request(context, "/api/projects/xugu-agentic-group/draft/modules", {
      method: "PATCH", session: editor, csrf: editor.csrf, body: input
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.payload.modules.find(module => module.type === "metrics").enabled, false);
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft/modules/metrics", { session: editor })).response.status, 404);
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/public/modules/metrics", { session: editor })).response.status, 200);
    assert.deepEqual((await request(context, "/api/projects/xugu-agentic-group/public/modules", { session: editor })).payload, publishedBefore);

    const draftBeforeInvalid = saved.payload;
    const invalid = structuredClone(input);
    invalid.modules[1].viewVariant = "<script>alert(1)</script>";
    const rejected = await request(context, "/api/projects/xugu-agentic-group/draft/modules", {
      method: "PATCH", session: editor, csrf: editor.csrf, body: invalid
    });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.payload.code, "INVALID_MODULE_CONFIGURATION");
    assert.ok(rejected.payload.error.length < 300);
    assert.deepEqual((await request(context, "/api/projects/xugu-agentic-group/draft/modules", { session: editor })).payload, draftBeforeInvalid);

    const viewer = await login(context, "viewer");
    assert.equal((await request(context, "/api/projects/xugu-agentic-group/draft/modules", {
      method: "PATCH", session: viewer, csrf: viewer.csrf, body: input
    })).response.status, 404);
  } finally { await context.close(); }
});

test("populated standard module API is data-driven and compatibility public snapshot is unchanged", async () => {
  const context = await setup();
  try {
    const editor = await login(context, "editor");
    const roadmap = await request(context, "/api/projects/standard-project-sample/public/modules/roadmap", { session: editor });
    const gantt = await request(context, "/api/projects/standard-project-sample/public/modules/gantt", { session: editor });
    assert.deepEqual([roadmap.payload.module.viewVariant, roadmap.payload.data.stages.length], ["linear-roadmap", 4]);
    assert.deepEqual([gantt.payload.module.viewVariant, gantt.payload.data.range.end], ["lanes", "2027-04-23"]);
    // task-network 已从公开 API 隐藏
    const hiddenNetwork = await request(context, "/api/projects/standard-project-sample/public/modules/task-network", { session: editor });
    assert.equal(hiddenNetwork.response.status, 404);
    const payloadText = JSON.stringify({ roadmap: roadmap.payload, gantt: gantt.payload });
    for (const value of ["rendererKey", "dataJson", "componentPath", "<script", "javascript:", "SELECT "]) assert.equal(payloadText.includes(value), false);
    const admin = await login(context, "admin");
    assert.deepEqual((await request(context, "/api/public", { session: admin })).payload, xuguFixture.published);
    context.database.prepare("UPDATE projects SET status = 'archived' WHERE id = 'standard-project-sample'").run();
    assert.equal((await request(context, "/api/projects/standard-project-sample/public/modules", { session: admin })).response.status, 404);
  } finally { await context.close(); }
});
