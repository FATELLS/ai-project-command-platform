import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createProposalService } from "../src/services/proposal-service.mjs";

const at = "2026-07-18T00:00:00.000Z";
const sha = (seed) => seed.repeat(64).slice(0, 64);

// Phase 8：交互发起的 manual proposal 服务层契约。无 HTTP/端口，直接测服务。
function setup() {
  const db = openDatabase(":memory:");
  applyMigrations(db);
  db.prepare("INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES ('editor','Editor','active',?,?)").run(at, at);
  db.prepare("INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES ('viewer','Viewer','active',?,?)").run(at, at);
  db.prepare("INSERT INTO projects (id,name,template_id,template_version,created_at,updated_at) VALUES ('project-a','Project','standard-project-v1','1.0.0',?,?)").run(at, at);
  for (const layer of ["published", "draft"]) {
    db.prepare("INSERT INTO project_versions (project_id,layer,version_label,metadata_json,created_at) VALUES ('project-a',?,?,?,?)")
      .run(layer, layer === "published" ? "v1" : "draft", JSON.stringify({ title: "Project", version: layer === "published" ? "v1" : "draft" }), at);
  }
  const versions = db.prepare("SELECT id,layer FROM project_versions WHERE project_id='project-a'").all();
  for (const value of versions) db.prepare(`UPDATE projects SET ${value.layer === "published" ? "published_version_id" : "draft_version_id"}=? WHERE id='project-a'`).run(value.id);
  const published = versions.find(item => item.layer === "published").id;
  const unitData = JSON.stringify({ status: "active", objective: "目标", owner: "负责人" });
  const taskData = JSON.stringify({ owner: "负责人", state: "进行中", expectedOutput: "产出" });
  db.prepare("INSERT INTO project_units (version_id,external_id,position,name,data_json) VALUES (?,'unit-a',0,'Team A',?)").run(published, unitData);
  db.prepare("INSERT INTO project_tasks (version_id,external_id,unit_external_id,parent_external_id,title,position,start_date,end_date,progress,data_json) VALUES (?,'task-001','unit-a',NULL,'开放任务',0,'2026-07-01','2026-07-31',30,?)").run(published, taskData);
  db.prepare("INSERT INTO project_materials (id,project_id,display_name,canonical_extension,canonical_mime,sha256,byte_size,status,active_extraction_version,created_by,created_at,updated_at) VALUES ('material-00000001','project-a','纪要.txt','.txt','text/plain',?,20,'ready',1,'editor',?,?)").run(sha("a"), at, at);
  db.prepare("INSERT INTO evidence_blocks (external_id,project_id,material_id,extraction_version,ordinal,kind,location_json,text,content_hash,created_at) VALUES ('evidence-00000001','project-a','material-00000001',1,0,'paragraph','{\"paragraph\":1}','开放任务进入待审核。',?,?)").run(sha("b"), at);
  db.prepare("INSERT INTO project_members (project_id,user_id,role,created_at) VALUES ('project-a','editor','project_editor',?)").run(at);
  db.prepare("INSERT INTO project_members (project_id,user_id,role,created_at) VALUES ('project-a','viewer','viewer',?)").run(at);
  return db;
}

function throwsCode(fn, code) {
  try { fn(); throw new Error("expected throw"); }
  catch (error) { if (error.code === undefined) throw error; assert.equal(error.code, code); return error; }
}

function evidencedChange(changeId, evidenceIds, patch = { state: "review" }) {
  return { changeId, module: "task-network", operation: "update", targetId: "task-001", semanticType: "plan", patch, confidence: 0.5, warnings: [], evidenceIds };
}

test("interaction proposal accepts evidenced high-impact change and stays pending without writing draft/published", () => {
  const db = setup();
  try {
    const before = db.prepare("SELECT published_version_id AS published, draft_version_id AS draft FROM projects WHERE id='project-a'").get();
    const service = createProposalService(db);
    const result = service.createInteractionProposal({ id: "editor", isPlatformAdmin: false }, "project-a", {
      summary: "推进任务到待审核",
      materialIds: ["material-00000001"],
      evidenceIds: ["evidence-00000001"],
      changes: [evidencedChange("change-001", ["evidence-00000001"])]
    });
    assert.equal(result.proposal.status, "pending");
    assert.equal(result.proposal.template.id, "interaction");
    assert.equal(result.proposal.changes.length, 1);
    assert.deepEqual(db.prepare("SELECT published_version_id AS published, draft_version_id AS draft FROM projects WHERE id='project-a'").get(), before);
    assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE action='proposal.interaction_created'").get().count, 1);
  } finally { db.close(); }
});

test("interaction proposal rejects high-impact change without evidence", () => {
  const db = setup();
  try {
    const service = createProposalService(db);
    throwsCode(() => service.createInteractionProposal({ id: "editor" }, "project-a", {
      summary: "无证据推进",
      materialIds: ["material-00000001"],
      evidenceIds: [],
      changes: [evidencedChange("change-002", [])]
    }), "EVIDENCE_REQUIRED");
  } finally { db.close(); }
});

test("interaction proposal allows source-free low-impact edits and rejects foreign evidence", () => {
  const db = setup();
  try {
    const service = createProposalService(db);
    const lowImpact = service.createInteractionProposal({ id: "editor" }, "project-a", {
      summary: "标题修正",
      materialIds: [],
      evidenceIds: [],
      changes: [{ changeId: "change-003", module: "task-network", operation: "update", targetId: "task-001", semanticType: "plan", patch: { title: "开放任务（修正）" }, confidence: 1, warnings: [], evidenceIds: [] }]
    });
    assert.equal(lowImpact.proposal.status, "pending");
    assert.deepEqual(lowImpact.proposal.materialIds, []);
    throwsCode(() => service.createInteractionProposal({ id: "editor" }, "project-a", {
      summary: "伪造证据",
      materialIds: ["material-00000001"],
      evidenceIds: ["evidence-does-not-exist-1234567890"],
      changes: [{ changeId: "change-004", module: "task-network", operation: "update", targetId: "task-001", semanticType: "plan", patch: { owner: "负责人" }, confidence: 0.6, warnings: [], evidenceIds: ["evidence-does-not-exist-1234567890"] }]
    }), "EVIDENCE_NOT_ALLOWED");
  } finally { db.close(); }
});

test("interaction proposal delete requires evidence", () => {
  const db = setup();
  try {
    const service = createProposalService(db);
    const change = { changeId: "delete-001", module: "task-network", operation: "delete", targetId: "task-001", semanticType: "plan", patch: {}, confidence: 1, warnings: ["DELETE_OPERATION"], evidenceIds: [] };
    throwsCode(() => service.createInteractionProposal({ id: "editor" }, "project-a", {
      summary: "删除任务",
      materialIds: [],
      evidenceIds: [],
      changes: [change]
    }), "EVIDENCE_REQUIRED");
    const result = service.createInteractionProposal({ id: "editor" }, "project-a", {
      summary: "删除任务",
      materialIds: ["material-00000001"],
      evidenceIds: ["evidence-00000001"],
      changes: [{ ...change, changeId: "delete-002", evidenceIds: ["evidence-00000001"] }]
    });
    assert.equal(result.proposal.changes[0].operation, "delete");
  } finally { db.close(); }
});

test("viewer cannot create interaction proposal (uniform 404)", () => {
  const db = setup();
  try {
    const service = createProposalService(db);
    throwsCode(() => service.createInteractionProposal({ id: "viewer" }, "project-a", {
      summary: "viewer 推进",
      materialIds: ["material-00000001"],
      evidenceIds: ["evidence-00000001"],
      changes: [evidencedChange("change-005", ["evidence-00000001"])]
    }), "CHANGE_PROPOSAL_NOT_FOUND");
  } finally { db.close(); }
});
