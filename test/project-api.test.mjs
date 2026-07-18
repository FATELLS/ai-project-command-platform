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
import { createAuthService } from "../src/services/auth-service.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));

async function withApi(operation) {
  const directory = mkdtempSync(join(tmpdir(), "platform-api-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
  const second = structuredClone(fixture);
  second.published.title = "Second public project";
  second.draft.title = "Second draft project";
  importLegacyProject(database, second, { projectId: "second-project", name: "Second project" });
  const auth = createAuthService(database);
  auth.ensureBootstrapAdmin({ loginName: "admin", password: "phase-one-api-password", displayName: "Admin" });
  const server = createServer(createApp({ database, authService: auth }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const login = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginName: "admin", password: "phase-one-api-password" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";", 1)[0];
    await operation(baseUrl, { cookie });
  } finally {
    await new Promise(resolve => server.close(resolve));
    database.close();
  }
}

test("health, authenticated project list, project layers, and compatibility route work", async () => {
  await withApi(async (baseUrl, auth) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    assert.equal((await fetch(`${baseUrl}/api/projects`)).status, 401);
    const list = await fetch(`${baseUrl}/api/projects`, { headers: auth });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).projects.length, 2);

    const publicResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`, { headers: auth });
    const publicSnapshot = (await publicResponse.json()).snapshot;
    assert.equal(publicResponse.status, 200);
    assert.equal(publicSnapshot.version, "v4.2");
    assert.equal(publicSnapshot.groups.length, 7);
    assert.equal(publicSnapshot.tasks.length, 29);

    const draftResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/draft`, { headers: auth });
    assert.deepEqual((await draftResponse.json()).snapshot, fixture.draft);

    const compatibility = await fetch(`${baseUrl}/api/public`, { headers: auth });
    assert.deepEqual(await compatibility.json(), publicSnapshot);
  });
});

test("project namespaces do not leak data", async () => {
  await withApi(async (baseUrl, auth) => {
    const first = (await (await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`, { headers: auth })).json()).snapshot;
    const secondPublic = (await (await fetch(`${baseUrl}/api/projects/second-project/public`, { headers: auth })).json()).snapshot;
    const secondDraft = (await (await fetch(`${baseUrl}/api/projects/second-project/draft`, { headers: auth })).json()).snapshot;
    assert.equal(first.title, fixture.published.title);
    assert.equal(secondPublic.title, "Second public project");
    assert.equal(secondDraft.title, "Second draft project");
    assert.notEqual(first.title, secondPublic.title);
  });
});

test("invalid, unknown, and unsupported project paths fail uniformly", async () => {
  await withApi(async (baseUrl, auth) => {
    const invalid = await fetch(`${baseUrl}/api/projects/INVALID/public`, { headers: auth });
    assert.equal(invalid.status, 404);
    assert.equal((await invalid.json()).code, "PROJECT_NOT_FOUND");

    const unknown = await fetch(`${baseUrl}/api/projects/unknown-project/public`, { headers: auth });
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).code, "PROJECT_NOT_FOUND");

    const method = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`, { method: "POST", headers: auth });
    assert.equal(method.status, 404);
    assert.equal((await method.json()).code, "NOT_FOUND");
  });
});
