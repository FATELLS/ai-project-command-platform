import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createModuleService } from "../src/modules/module-service.mjs";
import { getModuleDefinition, listModuleDefinitions, moduleRegistry, moduleTypes } from "../src/modules/registry.mjs";
import { ModuleValidationError, validateVersionGraph } from "../src/modules/schemas.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";
import { createProjectService } from "../src/services/project-service.mjs";

const xuguFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const standardFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/standard-project-sample.json", import.meta.url), "utf8"));
const expectedTypes = ["overview", "roadmap", "units", "task-network", "gantt", "outcomes", "risks", "metrics", "materials"];
const visibleExpectedTypes = expectedTypes.filter(type => type !== "task-network");

function database() {
  const directory = mkdtempSync(join(tmpdir(), "module-registry-"));
  const result = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(result);
  return result;
}

function populatedDatabase() {
  const db = database();
  importLegacyProject(db, xuguFixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
  importLegacyProject(db, standardFixture, {
    projectId: "standard-project-sample",
    templateId: "standard-project-v1",
    now: "2027-03-08T09:30:00.000Z"
  });
  return db;
}

const platformAdmin = { id: "admin", isPlatformAdmin: true };

test("registry exposes exactly nine versioned server definitions and no executable response metadata", () => {
  assert.deepEqual(moduleTypes, expectedTypes);
  assert.deepEqual(Object.keys(moduleRegistry), expectedTypes);
  assert.deepEqual(listModuleDefinitions().map(definition => definition.name), [
    "Overview", "Roadmap", "Units", "Task Network", "Gantt", "Outcomes", "Risks", "Metrics", "Materials"
  ]);
  for (const definition of listModuleDefinitions()) {
    assert.equal(definition.schemaVersion, "1.0.0");
    assert.equal(typeof definition.loader, "function");
    assert.ok(definition.allowedViews.length >= 1);
    assert.equal(Object.isFrozen(definition), true);
    for (const key of ["renderer", "rendererKey", "component", "path", "html", "sql"]) assert.equal(key in definition, false);
  }
});

test("loaders create stable same-version envelopes for all Xugu and standard modules", () => {
  const db = populatedDatabase();
  try {
    const service = createModuleService(db);
    for (const [projectId, templateId, version] of [
      ["xugu-agentic-group", "campaign-map-v1", "v4.2"],
      ["standard-project-sample", "standard-project-v1", "v1.3"]
    ]) {
      const manifest = service.listModules(platformAdmin, projectId, "public");
      assert.deepEqual(manifest.modules.map(module => module.type), visibleExpectedTypes);
      for (const type of visibleExpectedTypes) {
        const envelope = service.getModule(platformAdmin, projectId, "public", type);
        assert.equal(envelope.projectId, projectId);
        assert.equal(envelope.layer, "published");
        assert.equal(envelope.version, version);
        assert.deepEqual(envelope.template, { id: templateId, version: "1.0.0" });
        assert.equal(envelope.module.type, type);
        assert.equal(JSON.stringify(envelope).includes("renderer"), false);
      }
    }
    const materials = service.getModule(platformAdmin, "xugu-agentic-group", "public", "materials");
    assert.deepEqual(materials.data, {
      availability: "phase-4",
      summary: { count: 0, readyCount: 0 },
      items: []
    });
  } finally { db.close(); }
});

test("standard fixture drives arbitrary linear, dependency-list, and lane DTOs without Xugu facts", () => {
  const db = populatedDatabase();
  try {
    const service = createModuleService(db);
    const roadmap = service.getModule(platformAdmin, "standard-project-sample", "public", "roadmap");
    const gantt = service.getModule(platformAdmin, "standard-project-sample", "public", "gantt");
    assert.equal(roadmap.module.viewVariant, "linear-roadmap");
    assert.equal(gantt.module.viewVariant, "lanes");
    // task-network 已从公开 API 隐藏，但后端 loader 仍可用（proposal 预览等内部路径使用）
    const repo = createProjectRepository(db);
    const graph = repo.getModuleVersionGraph("standard-project-sample", "published");
    const networkDefinition = getModuleDefinition("task-network");
    const networkData = networkDefinition.loader(graph);
    assert.deepEqual([roadmap.data.stages.length, networkData.units.length, networkData.nodes.length], [4, 3, 7]);
    assert.deepEqual(gantt.data.range, { start: "2027-01-06", end: "2027-04-23" });
    assert.deepEqual(gantt.data.unscheduledIds, ["delivery-runbook"]);
    assert.deepEqual(networkData.edges.find(edge => edge.to === "engineering-orders"), {
      from: "engineering-identity", to: "engineering-orders", kind: "depends-on"
    });
    for (const term of ["虚谷", "作战单元", "战役", "战果"]) assert.equal(JSON.stringify({ roadmap, networkData, gantt }).includes(term), false);
  } finally { db.close(); }
});

test("empty standard project returns honest empty DTOs without invented dates or progress", () => {
  const db = database();
  try {
    db.prepare(`
      INSERT INTO users (id, display_name, status, created_at, updated_at, is_platform_admin)
      VALUES ('admin', 'Admin', 'active', '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z', 1)
    `).run();
    createProjectService(db, { now: () => Date.parse("2027-03-08T09:30:00.000Z") }).createProject(
      platformAdmin,
      { id: "empty-standard", name: "空白标准项目", templateId: "standard-project-v1" }
    );
    const service = createModuleService(db);
    assert.equal(service.getModule(platformAdmin, "empty-standard", "public", "overview").data.overallProgress, null);
    assert.deepEqual(service.getModule(platformAdmin, "empty-standard", "public", "gantt").data, {
      range: { start: null, end: null }, lanes: [], tasks: [], unscheduledIds: []
    });
    assert.deepEqual(service.getModule(platformAdmin, "empty-standard", "public", "risks").data, { risks: [] });
    assert.deepEqual(service.getModule(platformAdmin, "empty-standard", "public", "metrics").data, { metrics: [] });
  } finally { db.close(); }
});

test("graph, reference, DAG, date, schema, view, and asset violations fail closed", () => {
  const db = populatedDatabase();
  try {
    const repository = createProjectRepository(db);
    const valid = repository.getModuleVersionGraph("standard-project-sample", "published");
    assert.equal(validateVersionGraph(valid), valid);

    const missingStage = structuredClone(valid);
    missingStage.closures[0].between.push("missing-stage");
    assert.throws(() => validateVersionGraph(missingStage), /missing stage/);

    const cycle = structuredClone(valid);
    cycle.tasks[0].dependsOn = [cycle.tasks[1].id];
    assert.throws(() => validateVersionGraph(cycle), /cycle/);

    const reverseDate = structuredClone(valid);
    reverseDate.tasks[0].startDate = "2027-06-01";
    reverseDate.tasks[0].endDate = "2027-05-01";
    assert.throws(() => validateVersionGraph(reverseDate), /starts after/);

    const impossibleDate = structuredClone(valid);
    impossibleDate.tasks[0].startDate = "2027-02-30";
    assert.throws(() => validateVersionGraph(impossibleDate), /ISO calendar date/);

    const unsafe = structuredClone(valid);
    unsafe.closures[0].previewAssets = ["javascript:alert(1)"];
    assert.throws(() => validateVersionGraph(unsafe), /unsafe asset/);

    const invalidRisk = structuredClone(valid);
    invalidRisk.risks.push({ id: "risk-one", title: "Risk", severity: "urgent", status: "open", dueDate: "" });
    assert.throws(() => validateVersionGraph(invalidRisk), /severity/);

    const version = repository.resolveVersion("standard-project-sample", "published");
    db.prepare("UPDATE project_modules SET data_json = ? WHERE version_id = ? AND module_type = 'roadmap'")
      .run(JSON.stringify({ schemaVersion: "2.0.0", viewVariant: "linear-roadmap" }), version.id);
    assert.throws(() => createModuleService(db).listModules(platformAdmin, "standard-project-sample", "public"), ModuleValidationError);
    db.prepare("UPDATE project_modules SET data_json = ? WHERE version_id = ? AND module_type = 'roadmap'")
      .run(JSON.stringify({ schemaVersion: "1.0.0", viewVariant: "remote-page" }), version.id);
    assert.throws(() => createModuleService(db).listModules(platformAdmin, "standard-project-sample", "public"), ModuleValidationError);
  } finally { db.close(); }
});
