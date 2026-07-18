import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { exportLegacyProject, importLegacyProject, semanticallyEqual } from "../src/migration/legacy-project.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "platform-migration-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  return database;
}

test("Xugu fixture imports into separate version graphs and exports losslessly", () => {
  const database = setup();
  try {
    const result = importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
    assert.equal(result.imported, true);
    assert.notEqual(result.publishedVersionId, result.draftVersionId);
    const repository = createProjectRepository(database);
    const project = repository.getProject("xugu-agentic-group");
    assert.equal(project.templateId, "campaign-map-v1");
    assert.deepEqual(repository.countVersion(project.publishedVersionId), {
      units: 7, tasks: 29, stages: 6, closures: 2, workstreams: 4
    });
    assert.deepEqual(repository.countVersion(project.draftVersionId), {
      units: 7, tasks: 29, stages: 6, closures: 2, workstreams: 4
    });
    const exported = exportLegacyProject(database, "xugu-agentic-group");
    assert.ok(semanticallyEqual(exported, fixture));
    assert.deepEqual(exported, fixture);
  } finally {
    database.close();
  }
});

test("identical imports are idempotent and conflicting imports are rejected", () => {
  const database = setup();
  try {
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
    const repeated = importLegacyProject(database, structuredClone(fixture), { projectId: "xugu-agentic-group" });
    assert.equal(repeated.imported, false);
    assert.equal(database.prepare("SELECT count(*) AS count FROM projects").get().count, 1);
    const conflict = structuredClone(fixture);
    conflict.published.title = "Conflicting title";
    assert.throws(() => importLegacyProject(database, conflict, { projectId: "xugu-agentic-group" }), /different content/);
  } finally {
    database.close();
  }
});

test("invalid fixtures leave no partial project", () => {
  const database = setup();
  try {
    const invalid = structuredClone(fixture);
    invalid.published.tasks[0].dependsOn = ["missing-task"];
    assert.throws(() => importLegacyProject(database, invalid, { projectId: "invalid-project" }), /missing task/);
    assert.equal(database.prepare("SELECT count(*) AS count FROM projects").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM project_versions").get().count, 0);
  } finally {
    database.close();
  }
});

test("repository reads are isolated by project ID", () => {
  const database = setup();
  try {
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
    const second = structuredClone(fixture);
    second.published.title = "Second project";
    second.draft.title = "Second project draft";
    importLegacyProject(database, second, { projectId: "second-project", name: "Second project" });
    const repository = createProjectRepository(database);
    assert.equal(repository.getSnapshot("xugu-agentic-group", "published").title, fixture.published.title);
    assert.equal(repository.getSnapshot("second-project", "published").title, "Second project");
    assert.equal(repository.getSnapshot("unknown-project", "published"), undefined);
    assert.equal(repository.listProjects().length, 2);
  } finally {
    database.close();
  }
});
