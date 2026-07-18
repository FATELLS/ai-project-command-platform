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
  const server = createServer(createApp({ database }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await operation(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    database.close();
  }
}

test("health, project list, project layers, and compatibility route work", async () => {
  await withApi(async baseUrl => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const list = await fetch(`${baseUrl}/api/projects`);
    assert.equal(list.status, 200);
    assert.equal((await list.json()).projects.length, 2);

    const publicResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`);
    const publicSnapshot = await publicResponse.json();
    assert.equal(publicResponse.status, 200);
    assert.equal(publicSnapshot.version, "v4.2");
    assert.equal(publicSnapshot.groups.length, 7);
    assert.equal(publicSnapshot.tasks.length, 29);

    const draftResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/draft`);
    assert.deepEqual(await draftResponse.json(), fixture.draft);

    const compatibility = await fetch(`${baseUrl}/api/public`);
    assert.deepEqual(await compatibility.json(), publicSnapshot);
  });
});

test("project namespaces do not leak data", async () => {
  await withApi(async baseUrl => {
    const first = await (await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`)).json();
    const secondPublic = await (await fetch(`${baseUrl}/api/projects/second-project/public`)).json();
    const secondDraft = await (await fetch(`${baseUrl}/api/projects/second-project/draft`)).json();
    assert.equal(first.title, fixture.published.title);
    assert.equal(secondPublic.title, "Second public project");
    assert.equal(secondDraft.title, "Second draft project");
    assert.notEqual(first.title, secondPublic.title);
  });
});

test("invalid and unknown project paths fail deterministically", async () => {
  await withApi(async baseUrl => {
    const invalid = await fetch(`${baseUrl}/api/projects/INVALID/public`);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, "INVALID_PROJECT_ID");

    const unknown = await fetch(`${baseUrl}/api/projects/unknown-project/public`);
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).code, "PROJECT_NOT_FOUND");

    const method = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`, { method: "POST" });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "GET");
  });
});
