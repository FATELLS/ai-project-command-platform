import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createMaterialIngestService } from "../src/materials/ingest-service.mjs";
import { createMaterialRepository } from "../src/materials/material-repository.mjs";
import { declaredMaterialType } from "../src/materials/policy.mjs";
import { createMaterialStorage } from "../src/materials/storage.mjs";

function setup(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "material-gate-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  const at = "2026-07-18T00:00:00.000Z";
  database.prepare("INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES ('owner', 'Owner', 'active', ?, ?)").run(at, at);
  for (const id of ["project-a", "project-b"]) database.prepare(`
    INSERT INTO projects (id, name, template_id, template_version, created_at, updated_at)
    VALUES (?, ?, 'standard-project-v1', '1.0.0', ?, ?)
  `).run(id, id, at, at);
  const service = createMaterialIngestService(database, { storageRoot: join(directory, "storage"), ...overrides });
  return { database, directory, service };
}

function upload(service, body, options = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return service.ingest({
    projectId: options.projectId ?? "project-a",
    userId: "owner",
    filename: options.filename ?? "notes.txt",
    mime: options.mime ?? "text/plain",
    contentLength: options.contentLength ?? buffer.length,
    truncated: options.truncated ?? false,
    source: Readable.from([buffer]),
    signal: options.signal
  });
}

function storedFiles(root) {
  return readdirSync(root, { recursive: true }).map(name => join(root, name)).filter(path => statSync(path).isFile()).sort();
}

test("text-like gate formats match the file types offered by the UI", () => {
  assert.deepEqual(declaredMaterialType("notes.md", "text/markdown"), { extension: ".md", mime: "text/markdown", detected: null });
  assert.deepEqual(declaredMaterialType("ledger.csv", "text/csv"), { extension: ".csv", mime: "text/csv", detected: null });
  assert.deepEqual(declaredMaterialType("status.json", "application/json"), { extension: ".json", mime: "application/json", detected: null });
  assert.deepEqual(declaredMaterialType("status.yaml", "application/yaml"), { extension: ".yaml", mime: "application/yaml", detected: null });
});

test("secure intake streams a valid file into one project-scoped receipt and sanitizes its display name", async () => {
  const { database, service } = setup();
  try {
    const receipt = await upload(service, "alpha evidence", { filename: "../unsafe\u0000 name.txt" });
    assert.equal(receipt.projectId, "project-a");
    assert.equal(receipt.status, "queued");
    assert.equal(database.prepare("SELECT display_name AS name FROM project_materials").get().name, "unsafe name.txt");
    assert.equal(database.prepare("SELECT count(*) AS count FROM material_artifacts").get().count, 1);
    assert.equal(database.prepare("SELECT count(*) AS count FROM material_jobs WHERE state = 'queued'").get().count, 1);
    assert.equal(storedFiles(service.storage.root).length, 1);
  } finally { database.close(); }
});

test("oversize, signature spoof, truncation and required scanner failure reject without orphan files or rows", async () => {
  const { database, service } = setup({ limits: { maxFileBytes: 8 } });
  try {
    for (const [body, options, code] of [
      ["123456789", {}, "file_too_large"],
      ["fake", { filename: "fake.pdf", mime: "application/pdf" }, "magic_mismatch"],
      ["short", { truncated: true }, "upload_truncated"]
    ]) await assert.rejects(upload(service, body, options), error => error.code === code);
    assert.equal(database.prepare("SELECT count(*) AS count FROM project_materials").get().count, 0);
    assert.deepEqual(storedFiles(service.storage.root), []);
  } finally { database.close(); }

  const required = setup({ requireScan: true });
  try {
    await assert.rejects(upload(required.service, "clean"), error => error.code === "scanner_unavailable");
    assert.deepEqual(storedFiles(required.service.storage.root), []);
  } finally { required.database.close(); }
});

test("duplicate is isolated by project and transactional capacity recheck leaves no extra object", async () => {
  const { database, service } = setup({ limits: { maxProjectArtifactBytes: 20 } });
  try {
    await upload(service, "same bytes");
    await assert.rejects(upload(service, "same bytes"), error => error.code === "duplicate_material");
    await upload(service, "same bytes", { projectId: "project-b" });
    await assert.rejects(upload(service, "012345678901234567890"), error => error.code === "project_capacity_limit");
    assert.equal(database.prepare("SELECT count(*) AS count FROM project_materials").get().count, 2);
    assert.equal(storedFiles(service.storage.root).length, 2);
  } finally { database.close(); }
});

test("rate and concurrency reservations are server-side, persistent and independently released", () => {
  let clock = Date.parse("2026-07-18T00:00:00.000Z");
  const { database } = setup();
  try {
    const repository = createMaterialRepository(database, { now: () => clock });
    const first = repository.reserveUpload({ projectId: "project-a", userId: "owner" });
    assert.throws(() => repository.reserveUpload({ projectId: "project-a", userId: "owner" }), error => error.code === "upload_concurrency_limited");
    repository.finishUpload(first.attemptId, "aborted", "test");
    // maxUploadsPerMinute is 20; first + 1 rejected concurrency attempt = 2 attempts so far
    // fill remaining window: 20 - 2 = 18 more successful attempts
    for (let index = 0; index < 18; index += 1) {
      const slot = repository.reserveUpload({ projectId: "project-a", userId: "owner" });
      repository.finishUpload(slot.attemptId, "aborted", "test");
    }
    assert.throws(() => repository.reserveUpload({ projectId: "project-a", userId: "owner" }), error => error.code === "upload_rate_limited");
    clock += 60_001;
    const afterWindow = repository.reserveUpload({ projectId: "project-a", userId: "owner" });
    repository.finishUpload(afterWindow.attemptId, "aborted", "test");
  } finally { database.close(); }
});

test("aborted streams and failed artifact commits release staging and database reservations", async () => {
  const aborted = setup();
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(upload(aborted.service, "bytes", { signal: controller.signal }), error => error.code === "upload_aborted");
    assert.deepEqual(storedFiles(aborted.service.storage.root), []);
    assert.equal(aborted.database.prepare("SELECT count(*) AS count FROM material_upload_locks").get().count, 0);
  } finally { aborted.database.close(); }

  const directory = mkdtempSync(join(tmpdir(), "material-commit-fail-"));
  const base = createMaterialStorage({ root: join(directory, "storage") });
  const failed = setup({ storage: { ...base, commitStage() { throw new Error("disk unavailable"); } } });
  try {
    await assert.rejects(upload(failed.service, "bytes"), /disk unavailable/);
    assert.equal(failed.database.prepare("SELECT count(*) AS count FROM project_materials").get().count, 0);
    assert.equal(failed.database.prepare("SELECT count(*) AS count FROM material_upload_locks").get().count, 0);
    assert.deepEqual(storedFiles(base.root), []);
  } finally { failed.database.close(); }
});

test("job leasing is transactional, project-scoped and recovers an expired lease", async () => {
  let clock = Date.parse("2026-07-18T00:00:00.000Z");
  const { database, service } = setup({ now: () => clock });
  try {
    await upload(service, "lease me");
    const repository = createMaterialRepository(database, { now: () => clock });
    const first = repository.claimJob({ workerId: "worker-a", projectId: "project-a", leaseMs: 1_000 });
    assert.ok(first);
    assert.equal(repository.claimJob({ workerId: "worker-b", projectId: "project-a" }), null);
    assert.equal(repository.claimJob({ workerId: "worker-b", projectId: "project-b" }), null);
    clock += 1_001;
    const recovered = repository.claimJob({ workerId: "worker-b", projectId: "project-a" });
    assert.equal(recovered.id, first.id);
    assert.equal(database.prepare("SELECT attempts FROM material_jobs WHERE id = ?").get(first.id).attempts, 2);
  } finally { database.close(); }
});
