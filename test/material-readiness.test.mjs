import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createMaterialReadinessService } from "../src/materials/readiness-service.mjs";
import { buildGenerationContext } from "../src/proposals/context-builder.mjs";

const at = "2026-07-20T00:00:00.000Z";

function setup(text, templateId = "meeting-notes") {
  const db = openDatabase(":memory:");
  applyMigrations(db);
  db.prepare("INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES ('editor','Editor','active',?,?)").run(at, at);
  db.prepare("INSERT INTO projects (id,name,template_id,template_version,created_at,updated_at) VALUES ('project-a','Project','standard-project-v1','1.0.0',?,?)").run(at, at);
  for (const layer of ["published", "draft"]) db.prepare("INSERT INTO project_versions (project_id,layer,version_label,metadata_json,created_at) VALUES ('project-a',?,?,?,?)").run(layer, layer, JSON.stringify({ title: "Project", version: layer }), at);
  for (const row of db.prepare("SELECT id,layer FROM project_versions WHERE project_id='project-a'").all()) db.prepare(`UPDATE projects SET ${row.layer === "published" ? "published_version_id" : "draft_version_id"}=? WHERE id='project-a'`).run(row.id);
  const published = db.prepare("SELECT published_version_id AS id FROM projects WHERE id='project-a'").get().id;
  db.prepare("INSERT INTO project_units (version_id,external_id,position,name,data_json) VALUES (?,'unit-a',0,'Team','{}')").run(published);
  db.prepare(`INSERT INTO project_materials (id,project_id,display_name,canonical_extension,canonical_mime,sha256,byte_size,status,active_extraction_version,created_by,created_at,updated_at) VALUES ('material-00000001','project-a','notes.txt','.txt','text/plain',?,20,'ready',1,'editor',?,?)`).run("a".repeat(64), at, at);
  db.prepare("INSERT INTO material_update_selections (project_id,material_id,template_id,template_version,selected_by,selected_at) VALUES ('project-a','material-00000001',?,'1.0.0','editor',?)").run(templateId, at);
  db.prepare("INSERT INTO material_generation_grants (project_id,material_id,enabled,granted_by,granted_at) VALUES ('project-a','material-00000001',1,'editor',?)").run(at);
  db.prepare(`INSERT INTO evidence_blocks (external_id,project_id,material_id,extraction_version,ordinal,kind,location_json,text,content_hash,created_at) VALUES ('evidence-00000001','project-a','material-00000001',1,0,'paragraph','{"paragraph":1}',?,?,?)`).run(text, "b".repeat(64), at);
  return db;
}

test("readiness marks usable meeting notes as warning when non-critical context is missing", () => {
  const db = setup("需要第一作战单元跟进数据治理行动任务。");
  try {
    const readiness = createMaterialReadinessService(db).compute({ projectId: "project-a", materialId: "material-00000001", extractionVersion: 1, templateId: "meeting-notes", templateVersion: "1.0.0" });
    assert.equal(readiness.status, "warning");
    assert.equal(readiness.missing.length, 0);
    assert.ok(readiness.warnings.some(item => item.id === "source_date"));
    assert.equal(buildGenerationContext(db, { projectId: "project-a", materialIds: ["material-00000001"] }).materials[0].readiness.status, "warning");
  } finally { db.close(); }
});

test("readiness blocks generation when critical template content is missing", () => {
  const db = setup("寒暄与背景资料，没有行动项。", "metrics-data");
  try {
    const readiness = createMaterialReadinessService(db).compute({ projectId: "project-a", materialId: "material-00000001", extractionVersion: 1, templateId: "metrics-data", templateVersion: "1.0.0" });
    assert.equal(readiness.status, "blocked");
    assert.throws(() => buildGenerationContext(db, { projectId: "project-a", materialIds: ["material-00000001"] }), error => error.code === "MATERIAL_READINESS_BLOCKED");
  } finally { db.close(); }
});
