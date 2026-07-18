import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { MaterialGateError, mergeMaterialLimits } from "./policy.mjs";

function iso(value) { return new Date(value).toISOString(); }

export function createMaterialRepository(database, options = {}) {
  const now = options.now ?? Date.now;
  const limits = mergeMaterialLimits(options.limits);

  function reserveUpload({ projectId, userId, attemptId = randomUUID() }) {
    const timestamp = now();
    let rejection;
    withTransaction(database, () => {
      if (!database.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId)) throw new MaterialGateError("project_not_found", "Project was not found");
      if (!database.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(userId)) throw new MaterialGateError("user_not_found", "User was not found");
      database.prepare("DELETE FROM material_upload_locks WHERE expires_at <= ?").run(iso(timestamp));
      const recent = database.prepare(`
        SELECT count(*) AS count FROM material_upload_attempts
        WHERE project_id = ? AND user_id = ? AND created_at >= ?
      `).get(projectId, userId, iso(timestamp - 60_000)).count;
      const locked = database.prepare("SELECT 1 FROM material_upload_locks WHERE project_id = ? AND user_id = ?").get(projectId, userId);
      if (recent >= limits.maxUploadsPerMinute) rejection = ["upload_rate_limited", "Upload attempt rate limit exceeded"];
      else if (locked) rejection = ["upload_concurrency_limited", "Only one concurrent upload is allowed"];
      database.prepare(`
        INSERT INTO material_upload_attempts (id, project_id, user_id, outcome, error_code, created_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(attemptId, projectId, userId, rejection ? "rejected" : "started", rejection?.[0] ?? null, iso(timestamp), rejection ? iso(timestamp) : null);
      if (!rejection) database.prepare(`
        INSERT INTO material_upload_locks (project_id, user_id, attempt_id, expires_at) VALUES (?, ?, ?, ?)
      `).run(projectId, userId, attemptId, iso(timestamp + limits.uploadLeaseMs));
    });
    if (rejection) throw new MaterialGateError(...rejection);
    return { attemptId, expiresAt: iso(timestamp + limits.uploadLeaseMs) };
  }

  function finishUpload(attemptId, outcome, errorCode = null) {
    if (!new Set(["accepted", "rejected", "aborted"]).has(outcome)) throw new TypeError("Invalid upload outcome");
    withTransaction(database, () => {
      database.prepare("DELETE FROM material_upload_locks WHERE attempt_id = ?").run(attemptId);
      database.prepare(`UPDATE material_upload_attempts SET outcome = ?, error_code = ?, finished_at = ? WHERE id = ? AND outcome = 'started'`)
        .run(outcome, errorCode, iso(now()), attemptId);
    });
  }

  function createReceipt(input, commitArtifact) {
    const timestamp = iso(now());
    return withTransaction(database, () => {
      const reservation = database.prepare(`
        SELECT 1 FROM material_upload_locks WHERE project_id = ? AND user_id = ? AND attempt_id = ? AND expires_at > ?
      `).get(input.projectId, input.userId, input.attemptId, timestamp);
      if (!reservation) throw new MaterialGateError("upload_reservation_expired", "Upload reservation is missing or expired");
      const count = database.prepare(`SELECT count(*) AS count FROM project_materials WHERE project_id = ? AND status <> 'deleting'`).get(input.projectId).count;
      if (count >= limits.maxMaterialsPerProject) throw new MaterialGateError("project_material_limit", "Project material count limit exceeded");
      const usage = database.prepare(`SELECT coalesce(sum(byte_size), 0) AS bytes FROM material_artifacts WHERE project_id = ? AND status = 'available'`).get(input.projectId).bytes;
      if (usage + input.byteSize > limits.maxProjectArtifactBytes) throw new MaterialGateError("project_capacity_limit", "Project material storage limit exceeded");
      if (database.prepare("SELECT 1 FROM project_materials WHERE project_id = ? AND sha256 = ?").get(input.projectId, input.sha256)) {
        throw new MaterialGateError("duplicate_material", "This project already contains the same material");
      }
      database.prepare(`
        INSERT INTO project_materials (
          id, project_id, display_name, canonical_extension, canonical_mime, sha256, byte_size,
          status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)
      `).run(input.materialId, input.projectId, input.displayName, input.extension, input.mime, input.sha256, input.byteSize, input.userId, timestamp, timestamp);
      const storageKey = commitArtifact();
      database.prepare(`
        INSERT INTO material_artifacts (id, project_id, material_id, kind, storage_key, byte_size, sha256, status, created_at)
        VALUES (?, ?, ?, 'original', ?, ?, ?, 'available', ?)
      `).run(input.artifactId, input.projectId, input.materialId, storageKey, input.byteSize, input.sha256, timestamp);
      database.prepare(`
        INSERT INTO material_jobs (id, project_id, material_id, kind, state, created_at, updated_at)
        VALUES (?, ?, ?, 'extract', 'queued', ?, ?)
      `).run(input.jobId, input.projectId, input.materialId, timestamp, timestamp);
      database.prepare(`
        INSERT INTO material_qa_grants (project_id, material_id, audience, enabled)
        VALUES (?, ?, 'disabled', 0)
      `).run(input.projectId, input.materialId);
      database.prepare(`
        INSERT INTO material_generation_grants (project_id, material_id, enabled)
        VALUES (?, ?, 0)
      `).run(input.projectId, input.materialId);
      database.prepare("DELETE FROM material_upload_locks WHERE attempt_id = ?").run(input.attemptId);
      database.prepare(`UPDATE material_upload_attempts SET outcome = 'accepted', finished_at = ? WHERE id = ? AND outcome = 'started'`).run(timestamp, input.attemptId);
      return { id: input.materialId, projectId: input.projectId, status: "queued", jobId: input.jobId, storageKey };
    });
  }

  function claimJob({ workerId, projectId = null, leaseMs = 120_000 }) {
    const timestamp = now();
    return withTransaction(database, () => {
      const job = database.prepare(`
        SELECT project_id AS projectId, id FROM material_jobs
        WHERE (? IS NULL OR project_id = ?)
          AND (state = 'queued' OR (state = 'leased' AND lease_expires_at <= ?))
        ORDER BY created_at, id LIMIT 1
      `).get(projectId, projectId, iso(timestamp));
      if (!job) return null;
      const changed = database.prepare(`
        UPDATE material_jobs SET state = 'leased', lease_owner = ?, lease_expires_at = ?,
          attempts = attempts + 1, updated_at = ?
        WHERE project_id = ? AND id = ? AND (state = 'queued' OR lease_expires_at <= ?)
      `).run(workerId, iso(timestamp + leaseMs), iso(timestamp), job.projectId, job.id, iso(timestamp)).changes;
      return changed ? { ...job, workerId, leaseExpiresAt: iso(timestamp + leaseMs) } : null;
    });
  }

  return Object.freeze({ limits, reserveUpload, finishUpload, createReceipt, claimJob });
}
