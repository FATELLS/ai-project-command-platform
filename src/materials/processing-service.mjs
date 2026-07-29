import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { upsert } from "../db/sql-dialect.mjs";
import { createMaterialRepository } from "./material-repository.mjs";
import { createMaterialStorage } from "./storage.mjs";
import { extractMaterial, MissingCapabilityError } from "./extractors/index.mjs";

function iso(value) { return new Date(value).toISOString(); }


// Auto-infer update template from filename and extension
function inferTemplate(filename, extension) {
  const name = String(filename ?? "").toLowerCase();
  const ext = String(extension ?? "").toLowerCase();
  if (/会议|纪要|meeting|minutes/.test(name)) return "meeting-notes";
  if (/计划|plan|规划/.test(name)) return "project-plan";
  if (/进度|汇报|progress|report|周报|月报/.test(name)) return "progress-report";
  if (/指标|数据|metric|data|统计/.test(name) || [".xlsx", ".xls", ".csv"].includes(ext)) return "metrics-data";
  if (/成果|归档|outcome|交付|deliv/.test(name)) return "outcome-archive";
  // Default to meeting-notes for docx/txt (most common use case)
  if ([".docx", ".doc", ".txt"].includes(ext)) return "meeting-notes";
  return null;
}

export function createMaterialProcessingService(database, options = {}) {
  const now = options.now ?? Date.now;
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const repository = options.repository ?? createMaterialRepository(database, { now });
  const storage = options.storage ?? createMaterialStorage({ root: options.storageRoot });

  // 构建 capabilities：注入 LLM vision 配置给 PDF/图片提取器
  const capabilities = options.visionConfig
    ? { visionConfig: options.visionConfig }
    : {};

  const extractor = options.extractor ?? ((input) => extractMaterial(input, { ...options.extraction, capabilities }));

  function reconcileAbandonedJobs() {
    return database.prepare(`
      UPDATE material_jobs SET state = 'queued', lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE state = 'leased' AND lease_expires_at <= ?
    `).run(iso(now()), iso(now())).changes;
  }

  function finishFailure(job, error) {
    const code = error?.code ?? "extraction_failed";
    withTransaction(database, () => {
      database.prepare(`UPDATE material_jobs SET state = 'failed', lease_owner = NULL, lease_expires_at = NULL, error_code = ?, updated_at = ? WHERE project_id = ? AND id = ? AND lease_owner = ?`)
        .run(code, iso(now()), job.projectId, job.id, workerId);
      database.prepare(`UPDATE project_materials SET status = CASE
          WHEN active_extraction_version IS NOT NULL THEN 'ready' ELSE ? END, updated_at = ?
        WHERE project_id = ? AND id = ?`)
        .run(error instanceof MissingCapabilityError ? "dependency_missing" : "failed", iso(now()), job.projectId, job.materialId);
    });
  }

  async function processNext({ projectId = null } = {}) {
    const lease = repository.claimJob({ workerId, projectId, leaseMs: options.leaseMs ?? 120_000 });
    if (!lease) return null;
    const job = database.prepare(`
      SELECT j.id, j.project_id AS projectId, j.material_id AS materialId, m.canonical_extension AS extension,
        m.display_name AS displayName, m.created_by AS createdBy,
        a.storage_key AS storageKey
      FROM material_jobs j JOIN project_materials m ON m.project_id = j.project_id AND m.id = j.material_id
      JOIN material_artifacts a ON a.project_id = j.project_id AND a.material_id = j.material_id AND a.kind = 'original' AND a.status = 'available'
      WHERE j.project_id = ? AND j.id = ?
    `).get(lease.projectId, lease.id);
    if (!job) { finishFailure({ ...lease, materialId: "" }, Object.assign(new Error("Original unavailable"), { code: "original_unavailable" })); return { ...lease, status: "failed", errorCode: "original_unavailable" }; }
    database.prepare("UPDATE project_materials SET status = 'processing', updated_at = ? WHERE project_id = ? AND id = ?").run(iso(now()), job.projectId, job.materialId);
    try {
      const result = await extractor({ path: storage.pathForKey(job.storageKey), extension: job.extension, projectId: job.projectId, materialId: job.materialId });
      options.beforeCommit?.(result, job);
      const generation = withTransaction(database, () => {
        const version = database.prepare("SELECT coalesce(active_extraction_version, 0) + 1 AS value FROM project_materials WHERE project_id = ? AND id = ?").get(job.projectId, job.materialId).value;
        const insert = database.prepare(`
          INSERT INTO evidence_blocks (external_id, project_id, material_id, extraction_version, ordinal, kind, location_json, text, summary, content_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
        `);
        for (const block of result.blocks) insert.run(randomUUID(), job.projectId, job.materialId, version, block.ordinal, block.kind, JSON.stringify(block.location), block.text, createHash("sha256").update(block.text).digest("hex"), iso(now()));
        database.prepare("UPDATE project_materials SET status = 'ready', active_extraction_version = ?, updated_at = ? WHERE project_id = ? AND id = ?").run(version, iso(now()), job.projectId, job.materialId);
        database.prepare("DELETE FROM evidence_blocks WHERE project_id = ? AND material_id = ? AND extraction_version <> ?").run(job.projectId, job.materialId, version);
        database.prepare(`UPDATE material_jobs SET state = 'succeeded', lease_owner = NULL, lease_expires_at = NULL, error_code = NULL, stats_json = ?, updated_at = ? WHERE project_id = ? AND id = ? AND lease_owner = ?`)
          .run(JSON.stringify(result.stats), iso(now()), job.projectId, job.id, workerId);
        // Auto-infer update template from filename if none selected yet
        const existing = database.prepare("SELECT template_id AS id FROM material_update_selections WHERE project_id = ? AND material_id = ?").get(job.projectId, job.materialId);
        if (!existing?.id) {
          const inferred = inferTemplate(job.displayName, job.extension);
          if (inferred) upsert(database, "material_update_selections",
            ["project_id", "material_id", "template_id", "template_version", "selected_by", "selected_at"],
            [job.projectId, job.materialId, inferred, "1.0.0", job.createdBy ?? null, iso(now())],
            ["project_id", "material_id"],
            ["template_id", "template_version", "selected_by", "selected_at"]
          );
        }
        // Auto-enable generation for the material
        upsert(database, "material_generation_grants",
          ["project_id", "material_id", "enabled", "granted_by", "granted_at"],
          [job.projectId, job.materialId, 1, job.createdBy ?? null, iso(now())],
          ["project_id", "material_id"],
          ["enabled", "granted_by", "granted_at"]
        );
        return version;
      });
      return { ...lease, materialId: job.materialId, status: "ready", extractionVersion: generation, stats: result.stats };
    } catch (error) {
      finishFailure(job, error);
      return { ...lease, materialId: job.materialId, status: error instanceof MissingCapabilityError ? "dependency_missing" : "failed", errorCode: error?.code ?? "extraction_failed" };
    }
  }

  return Object.freeze({ workerId, reconcileAbandonedJobs, processNext });
}
