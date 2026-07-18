import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createEvidenceService } from "../src/materials/evidence-service.mjs";
import { createMaterialIngestService } from "../src/materials/ingest-service.mjs";
import { createMaterialProcessingService } from "../src/materials/processing-service.mjs";

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "evidence-isolation-")); const database = openDatabase(join(directory, "platform.sqlite")); applyMigrations(database);
  const at = "2026-07-18T00:00:00.000Z";
  database.prepare("INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES ('owner', 'Owner', 'active', ?, ?)").run(at, at);
  for (const id of ["project-a", "project-b"]) database.prepare(`INSERT INTO projects (id, name, template_id, template_version, created_at, updated_at) VALUES (?, ?, 'standard-project-v1', '1.0.0', ?, ?)`)
    .run(id, id, at, at);
  const storageRoot = join(directory, "storage"); const ingest = createMaterialIngestService(database, { storageRoot });
  const receipts = {};
  for (const projectId of ["project-a", "project-b"]) receipts[projectId] = await ingest.ingest({ projectId, userId: "owner", filename: "same.txt", mime: "text/plain", source: Readable.from([Buffer.from(`${projectId} 共同证据层 keyword`)]), contentLength: Buffer.byteLength(`${projectId} 共同证据层 keyword`) });
  return { database, storageRoot, receipts };
}

function grant(database, projectId, materialId, audience = "project_members") {
  database.prepare("UPDATE material_qa_grants SET enabled = 1, audience = ?, granted_by = 'owner', granted_at = '2026-07-18T00:00:00.000Z' WHERE project_id = ? AND material_id = ?")
    .run(audience, projectId, materialId);
}

test("processing swaps a bounded generation atomically and FTS/list/get never cross projects", async () => {
  const { database, storageRoot, receipts } = await setup();
  try {
    const processor = createMaterialProcessingService(database, { storageRoot, workerId: "worker" });
    assert.equal((await processor.processNext({ projectId: "project-a" })).status, "ready");
    assert.equal((await processor.processNext({ projectId: "project-b" })).status, "ready");
    grant(database, "project-a", receipts["project-a"].id); grant(database, "project-b", receipts["project-b"].id);
    const evidence = createEvidenceService(database);
    const a = evidence.search({ projectId: "project-a", query: "共同证据层" }); const b = evidence.search({ projectId: "project-b", query: "共同证据层" });
    assert.equal(a.length, 1); assert.equal(b.length, 1); assert.match(a[0].text, /project-a/); assert.match(b[0].text, /project-b/);
    assert.equal(evidence.get({ projectId: "project-b", evidenceId: a[0].id }), null);
    assert.deepEqual(evidence.list({ projectId: "project-b", materialId: receipts["project-a"].id }), []);
    assert.equal(evidence.search({ projectId: "project-a", query: "共同" }).length, 1, "short Chinese fallback remains project-scoped");
  } finally { database.close(); }
});

test("QA grants are independent from ready evidence and audience filters fail closed", async () => {
  const { database, storageRoot, receipts } = await setup();
  try {
    const processor = createMaterialProcessingService(database, { storageRoot }); await processor.processNext({ projectId: "project-a" });
    const evidence = createEvidenceService(database); const materialId = receipts["project-a"].id;
    assert.equal(evidence.list({ projectId: "project-a", materialId }).length, 1, "edit evidence remains visible without QA grant");
    assert.deepEqual(evidence.search({ projectId: "project-a", query: "keyword" }), []);
    grant(database, "project-a", materialId, "editors");
    assert.equal(evidence.search({ projectId: "project-a", query: "keyword", audience: "project_member" }).length, 0);
    assert.equal(evidence.search({ projectId: "project-a", query: "keyword", audience: "editor" }).length, 1);
    database.prepare("UPDATE material_artifacts SET status = 'removed', removed_at = '2026-07-18T01:00:00.000Z' WHERE project_id = 'project-a' AND material_id = ?").run(materialId);
    assert.equal(evidence.list({ projectId: "project-a", materialId }).length, 1, "original retention is independent from derived evidence");
    database.prepare("UPDATE material_qa_grants SET enabled = 0, audience = 'disabled', granted_by = NULL, granted_at = NULL WHERE project_id = 'project-a' AND material_id = ?").run(materialId);
    assert.equal(evidence.search({ projectId: "project-a", query: "keyword", audience: "editor" }).length, 0);
  } finally { database.close(); }
});

test("failure injection leaves no partial generation and a fresh queued job recovers idempotently", async () => {
  const { database, storageRoot, receipts } = await setup();
  try {
    const failing = createMaterialProcessingService(database, { storageRoot, workerId: "failer", beforeCommit() { throw Object.assign(new Error("injected"), { code: "injected_failure" }); } });
    assert.equal((await failing.processNext({ projectId: "project-a" })).status, "failed");
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_blocks WHERE project_id = 'project-a'").get().count, 0);
    database.prepare("UPDATE material_jobs SET state = 'queued', error_code = NULL WHERE project_id = 'project-a'").run();
    database.prepare("UPDATE project_materials SET status = 'queued' WHERE project_id = 'project-a'").run();
    const recovered = createMaterialProcessingService(database, { storageRoot, workerId: "recovered" });
    assert.equal((await recovered.processNext({ projectId: "project-a" })).status, "ready");
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_blocks WHERE project_id = 'project-a'").get().count, 1);
    assert.equal(database.prepare("SELECT attempts FROM material_jobs WHERE project_id = 'project-a'").get().attempts, 2);
    assert.equal(receipts["project-a"].projectId, "project-a");
  } finally { database.close(); }
});

test("reprocessing advances the generation and atomically removes stale FTS evidence", async () => {
  const { database, storageRoot, receipts } = await setup();
  try {
    await createMaterialProcessingService(database, { storageRoot, workerId: "first" }).processNext({ projectId: "project-a" });
    const materialId = receipts["project-a"].id;
    const oldId = database.prepare("SELECT external_id AS id FROM evidence_blocks WHERE project_id = 'project-a'").get().id;
    database.prepare(`INSERT INTO material_jobs (id, project_id, material_id, kind, state, created_at, updated_at)
      VALUES ('reprocess-job-0001', 'project-a', ?, 'extract', 'queued', '2026-07-18T01:00:00.000Z', '2026-07-18T01:00:00.000Z')`).run(materialId);
    const processor = createMaterialProcessingService(database, { storageRoot, workerId: "second", extractor: async () => ({ blocks: [{ ordinal: 0, kind: "text", location: { type: "line", line: 1 }, text: "全新证据层" }], stats: { blocks: 1, textBytes: 15 } }) });
    const result = await processor.processNext({ projectId: "project-a" });
    assert.equal(result.extractionVersion, 2);
    grant(database, "project-a", materialId);
    const evidence = createEvidenceService(database);
    assert.equal(evidence.get({ projectId: "project-a", evidenceId: oldId }), null);
    assert.equal(evidence.search({ projectId: "project-a", query: "全新证据层" }).length, 1);
    assert.equal(evidence.search({ projectId: "project-a", query: "project-a" }).length, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_blocks WHERE project_id = 'project-a'").get().count, 1);
  } finally { database.close(); }
});

test("expired leases reconcile while active leases and other projects remain untouched", async () => {
  const { database, storageRoot } = await setup();
  try {
    database.prepare("UPDATE material_jobs SET state = 'leased', lease_owner = 'dead', lease_expires_at = '2020-01-01T00:00:00.000Z' WHERE project_id = 'project-a'").run();
    database.prepare("UPDATE material_jobs SET state = 'leased', lease_owner = 'live', lease_expires_at = '2099-01-01T00:00:00.000Z' WHERE project_id = 'project-b'").run();
    const processor = createMaterialProcessingService(database, { storageRoot, now: () => Date.parse("2026-07-18T00:00:00.000Z") });
    assert.equal(processor.reconcileAbandonedJobs(), 1);
    assert.equal(database.prepare("SELECT state FROM material_jobs WHERE project_id = 'project-a'").get().state, "queued");
    const active = database.prepare("SELECT state, lease_owner AS owner FROM material_jobs WHERE project_id = 'project-b'").get();
    assert.equal(active.state, "leased"); assert.equal(active.owner, "live");
  } finally { database.close(); }
});
