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

test("Phase 9 decomposition links: parentId survives import/export and stay same-unit", () => {
  // 种子里必须有真实同单元拆解链（parentId 非空）
  const linkedPublished = fixture.published.tasks.filter(task => task.parentId);
  const linkedDraft = fixture.draft.tasks.filter(task => task.parentId);
  assert.ok(linkedPublished.length >= 3, `expected >=3 same-unit parentId links in published, got ${linkedPublished.length}`);
  assert.ok(linkedDraft.length >= 3, `expected >=3 same-unit parentId links in draft, got ${linkedDraft.length}`);

  // parentId 必须引用同版本内存在的任务，且同作战单元（方向 A：跨单元被 validator 禁止）
  for (const doc of [fixture.published, fixture.draft]) {
    const byId = new Map(doc.tasks.map(task => [task.id, task]));
    for (const task of doc.tasks) {
      if (!task.parentId) continue;
      const parent = byId.get(task.parentId);
      assert.ok(parent, `${task.id} references missing parent ${task.parentId}`);
      assert.equal(parent.groupId, task.groupId, `${task.id}(${task.groupId}) has cross-unit parent ${task.parentId}(${parent.groupId})`);
      // parentId 与 dependsOn 合并去重（schemas.mjs validateTaskDag），不得重复否则 MODULE_VALIDATION_FAILED
      assert.ok(!(task.dependsOn || []).includes(task.parentId), `${task.id} parentId ${task.parentId} also in dependsOn (duplicate link)`);
    }
  }

  // parentId 必须经过迁移往返不丢失
  const database = setup();
  try {
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
    const repository = createProjectRepository(database);
    const snapshot = repository.getSnapshot("xugu-agentic-group", "published");
    const linked = snapshot.tasks.filter(task => task.parentId);
    assert.ok(linked.length >= 3, `parentId lost after import: only ${linked.length} linked tasks`);
    const sample = linked.find(task => task.id === "finance-scale" && task.parentId === "finance-data-security");
    assert.ok(sample, "expected finance-scale to retain parentId=finance-data-security after import");
  } finally {
    database.close();
  }
});
