import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { exportLegacyProject, importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";
import { createProjectService } from "../src/services/project-service.mjs";
import {
  campaignMapTemplate,
  listTemplates,
  resolveTemplate,
  standardProjectTemplate
} from "../src/templates/catalog.mjs";
import { TemplateValidationError, validateTemplateManifest } from "../src/templates/template-validator.mjs";

const xuguFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const standardFixture = JSON.parse(readFileSync(new URL("../fixtures/projects/standard-project-sample.json", import.meta.url), "utf8"));
const moduleOrder = ["overview", "roadmap", "units", "task-network", "gantt", "outcomes", "risks", "metrics", "materials"];

function database() {
  const directory = mkdtempSync(join(tmpdir(), "template-catalog-"));
  const result = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(result);
  return result;
}

test("catalog exposes two immutable, valid, versioned nine-module manifests", () => {
  assert.deepEqual(listTemplates().map(template => `${template.id}@${template.version}`), [
    "campaign-map-v1@1.0.0",
    "standard-project-v1@1.0.0"
  ]);
  for (const manifest of listTemplates()) {
    assert.equal(validateTemplateManifest(manifest), manifest);
    assert.equal(Object.isFrozen(manifest), true);
    assert.equal(Object.isFrozen(manifest.modules), true);
    assert.deepEqual(manifest.modules.map(module => module.type), moduleOrder);
    assert.deepEqual(manifest.modules.map(module => module.position), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(manifest.requiredModules, ["overview"]);
    assert.equal(manifest.modules[0].required, true);
    assert.equal(manifest.modules[0].enabled, true);
    assert.throws(() => { manifest.modules[0].title = "mutated"; }, TypeError);
  }
  assert.equal(resolveTemplate("campaign-map-v1"), campaignMapTemplate);
  assert.equal(resolveTemplate("standard-project-v1"), standardProjectTemplate);
  assert.throws(() => resolveTemplate("unknown-template"), /Unknown template/);
});

test("template validation fails closed for unknown, duplicate, malformed, and executable-looking configuration", () => {
  const unknown = structuredClone(standardProjectTemplate);
  unknown.modules[8].type = "custom-page";
  assert.throws(() => validateTemplateManifest(unknown), TemplateValidationError);

  const duplicate = structuredClone(standardProjectTemplate);
  duplicate.modules[8].type = "metrics";
  assert.throws(() => validateTemplateManifest(duplicate), /duplicate module type/);

  const badPosition = structuredClone(standardProjectTemplate);
  badPosition.modules[2].position = 7;
  assert.throws(() => validateTemplateManifest(badPosition), /normalized/);

  const missingOverview = structuredClone(standardProjectTemplate);
  missingOverview.requiredModules = [];
  missingOverview.modules[0].required = false;
  assert.throws(() => validateTemplateManifest(missingOverview), /must include overview/);

  const badView = structuredClone(standardProjectTemplate);
  badView.modules[1].viewVariant = "mission-status";
  assert.throws(() => validateTemplateManifest(badView), /not allowed/);

  for (const payload of [
    { componentPath: "./custom.mjs" },
    { renderer: "remote-component" },
    { note: "<script>alert(1)</script>" },
    { link: "javascript:alert(1)" }
  ]) {
    const unsafe = structuredClone(standardProjectTemplate);
    Object.assign(unsafe, payload);
    assert.throws(() => validateTemplateManifest(unsafe), /executable|component path/);
  }
});

test("standard template copy is isolated from Xugu campaign language", () => {
  const text = JSON.stringify(standardProjectTemplate);
  for (const term of ["虚谷", "作战", "战役", "战果", "作战单元"]) assert.equal(text.includes(term), false, term);
  assert.equal(standardProjectTemplate.copy.banner, "STANDARD PROJECT SCHEDULE");
  assert.equal(standardProjectTemplate.terminology.unit, "团队");
  assert.equal(standardProjectTemplate.modules.find(module => module.type === "roadmap").viewVariant, "linear-roadmap");
});

test("catalog import persists exact config and independent module graphs for both templates", () => {
  const db = database();
  try {
    const xugu = importLegacyProject(db, xuguFixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
    const standard = importLegacyProject(db, standardFixture, {
      projectId: "standard-project-sample",
      templateId: "standard-project-v1",
      now: "2027-03-08T09:30:00.000Z"
    });
    assert.notEqual(xugu.publishedVersionId, xugu.draftVersionId);
    assert.notEqual(standard.publishedVersionId, standard.draftVersionId);
    for (const manifest of listTemplates()) {
      const row = db.prepare("SELECT config_json AS configJson FROM templates WHERE id = ? AND version = ?")
        .get(manifest.id, manifest.version);
      assert.deepEqual(JSON.parse(row.configJson), manifest);
    }
    const moduleRows = versionId => db.prepare(`
      SELECT module_type AS type, position, enabled, data_json AS dataJson
      FROM project_modules WHERE version_id = ? ORDER BY position
    `).all(versionId).map(row => ({ ...row, data: JSON.parse(row.dataJson) }));
    for (const versionId of [xugu.publishedVersionId, xugu.draftVersionId]) {
      const rows = moduleRows(versionId);
      assert.deepEqual(rows.map(row => row.type), moduleOrder);
      assert.equal(rows[1].data.viewVariant, "campaign-network");
    }
    for (const versionId of [standard.publishedVersionId, standard.draftVersionId]) {
      const rows = moduleRows(versionId);
      assert.deepEqual(rows.map(row => row.type), moduleOrder);
      assert.equal(rows[1].data.viewVariant, "linear-roadmap");
      assert.equal(rows[3].data.viewVariant, "dependency-list");
    }
    assert.deepEqual(exportLegacyProject(db, "xugu-agentic-group"), xuguFixture);
    assert.deepEqual(exportLegacyProject(db, "standard-project-sample"), standardFixture);
  } finally {
    db.close();
  }
});

test("project creation resolves the catalog and creates honest template-specific empty snapshots", () => {
  const db = database();
  try {
    db.prepare(`
      INSERT INTO users (id, display_name, status, created_at, updated_at, is_platform_admin)
      VALUES ('admin', 'Admin', 'active', '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z', 1)
    `).run();
    const service = createProjectService(db, { now: () => Date.parse("2027-03-08T09:30:00.000Z") });
    const principal = { id: "admin", isPlatformAdmin: true };
    service.createProject(principal, { id: "empty-standard", name: "空白标准项目", templateId: "standard-project-v1" });
    const repository = createProjectRepository(db);
    const project = repository.getProject("empty-standard");
    const published = repository.getSnapshot("empty-standard", "published");
    const draft = repository.getSnapshot("empty-standard", "draft");
    assert.notEqual(project.publishedVersionId, project.draftVersionId);
    assert.deepEqual(published, draft);
    assert.equal(published.summary, "项目已创建，待配置团队、任务与里程碑。");
    assert.equal(published.overallProgress, null);
    assert.deepEqual([published.groups.length, published.tasks.length, published.stages.length], [0, 0, 0]);
    assert.equal(JSON.stringify(published).includes("作战"), false);
    assert.equal(db.prepare("SELECT count(*) AS count FROM project_modules WHERE version_id IN (?, ?)")
      .get(project.publishedVersionId, project.draftVersionId).count, 18);
  } finally {
    db.close();
  }
});

test("populated standard fixture has independent non-Xugu facts and dates", () => {
  assert.deepEqual({
    units: standardFixture.published.groups.length,
    tasks: standardFixture.published.tasks.length,
    stages: standardFixture.published.stages.length,
    closures: standardFixture.published.closures.length,
    workstreams: standardFixture.published.companyWorkstreams.length
  }, { units: 3, tasks: 7, stages: 4, closures: 1, workstreams: 2 });
  assert.match(JSON.stringify(standardFixture), /2027-05/);
  for (const term of ["虚谷", "作战单元", "战役", "战果"]) assert.equal(JSON.stringify(standardFixture).includes(term), false, term);
});
