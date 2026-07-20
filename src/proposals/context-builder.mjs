import { createHash } from "node:crypto";
import { createMaterialReadinessService } from "../materials/readiness-service.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { proposalError } from "./errors.mjs";

const MAX_MATERIALS = 8;
const MAX_EVIDENCE = 48;
const MAX_EVIDENCE_BYTES = 64 * 1024;
const MAX_PUBLISHED_BYTES = 32 * 1024;

function stableUniqueIds(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MATERIALS) throw proposalError("INVALID_MATERIAL_SELECTION", "请选择 1 至 8 份材料");
  const ids = value.map(item => String(item ?? "").trim());
  if (ids.some(id => !/^[a-zA-Z0-9._-]{16,128}$/.test(id)) || new Set(ids).size !== ids.length) throw proposalError("INVALID_MATERIAL_SELECTION", "材料选择无效");
  return ids;
}

function boundedPublished(graph) {
  const value = {
    projectId: graph.projectId,
    versionId: graph.versionId,
    versionLabel: graph.versionLabel,
    modules: graph.modules.map(item => ({ type: item.type, enabled: item.enabled })),
    units: graph.units.map(item => ({ id: item.id, name: item.name })),
    stages: graph.stages.map(item => ({ id: item.id, title: item.title, date: item.dateLabel ?? "" })),
    tasks: graph.tasks.map(item => ({ id: item.id, unitId: item.unitId, parentId: item.parentId, title: item.title, startDate: item.startDate, endDate: item.endDate, progress: item.progress, dependsOn: item.dependsOn, owner: item.owner, state: item.state })),
    risks: graph.risks.map(item => ({ id: item.id, title: item.title, severity: item.severity, status: item.status, owner: item.owner, dueDate: item.dueDate })),
    metrics: graph.metrics.map(item => ({ id: item.id, name: item.name, value: item.value, unit: item.unit, status: item.status, asOf: item.asOf, target: item.target })),
    outcomes: graph.closures.map(item => ({ id: item.id, title: item.title, state: item.state, date: item.dateLabel }))
  };
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded) > MAX_PUBLISHED_BYTES) throw proposalError("PUBLISHED_CONTEXT_TOO_LARGE", "当前发布版本超出生成上下文限制", 409);
  return value;
}

export function buildGenerationContext(database, input) {
  const projectId = String(input.projectId ?? "");
  const materialIds = stableUniqueIds(input.materialIds);
  const repository = createProjectRepository(database);
  const graph = repository.getModuleVersionGraph(projectId, "published");
  if (!graph) throw proposalError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
  if (input.baseVersionId !== undefined && Number(input.baseVersionId) !== Number(graph.versionId)) throw proposalError("BASE_VERSION_STALE", "发布版本已变化", 409);

  const placeholders = materialIds.map(() => "?").join(",");
  const rows = database.prepare(`
    SELECT m.id, m.display_name AS name, m.active_extraction_version AS extractionVersion,
           m.status, s.template_id AS templateId, s.template_version AS templateVersion,
           coalesce(g.enabled, 0) AS generationEnabled
    FROM project_materials m
    LEFT JOIN material_update_selections s ON s.project_id=m.project_id AND s.material_id=m.id
    LEFT JOIN material_generation_grants g ON g.project_id=m.project_id AND g.material_id=m.id
    WHERE m.project_id=? AND m.id IN (${placeholders})
  `).all(projectId, ...materialIds);
  if (rows.length !== materialIds.length) throw proposalError("MATERIAL_NOT_FOUND", "材料不存在或你无权访问", 404);
  const byId = new Map(rows.map(row => [row.id, row]));
  const materials = materialIds.map(id => byId.get(id));
  if (materials.some(row => row.status !== "ready" || !row.extractionVersion)) throw proposalError("MATERIAL_NOT_READY", "所选材料证据尚未就绪", 409);
  if (materials.some(row => !row.generationEnabled)) throw proposalError("GENERATION_NOT_GRANTED", "所选材料尚未授权用于更新生成", 409);
  if (materials.some(row => !row.templateId || !row.templateVersion)) throw proposalError("UPDATE_TEMPLATE_REQUIRED", "所选材料尚未选择更新模板", 409);
  const templateKey = `${materials[0].templateId}@${materials[0].templateVersion}`;
  if (materials.some(row => `${row.templateId}@${row.templateVersion}` !== templateKey)) throw proposalError("MIXED_UPDATE_TEMPLATES", "所选材料的更新模板不一致", 409);
  const readiness = createMaterialReadinessService(database);
  const materialReadiness = materials.map(row => readiness.compute({ projectId, materialId: row.id, extractionVersion: row.extractionVersion, templateId: row.templateId, templateVersion: row.templateVersion }));
  const blocked = materialReadiness.find(item => item?.status === "blocked");
  if (blocked) throw proposalError("MATERIAL_READINESS_BLOCKED", blocked.suggestion, 409, { missing: blocked.missing, template: blocked.template });

  const evidence = [];
  let evidenceBytes = 0;
  const selectEvidence = database.prepare(`
    SELECT external_id AS evidenceId, material_id AS materialId, kind, location_json AS locationJson,
           text, summary, content_hash AS contentHash, extraction_version AS extractionVersion
    FROM evidence_blocks
    WHERE project_id=? AND material_id=? AND extraction_version=?
    ORDER BY ordinal LIMIT ?
  `);
  for (const material of materials) {
    for (const row of selectEvidence.all(projectId, material.id, material.extractionVersion, MAX_EVIDENCE)) {
      if (evidence.length >= MAX_EVIDENCE) break;
      const bytes = Buffer.byteLength(row.text);
      if (evidenceBytes + bytes > MAX_EVIDENCE_BYTES) break;
      evidenceBytes += bytes;
      evidence.push({ ...row, location: JSON.parse(row.locationJson), materialName: material.name });
    }
  }
  if (!evidence.length) throw proposalError("EVIDENCE_REQUIRED", "所选材料没有可用于生成的证据", 409);
  const [templateId, templateVersion] = templateKey.split("@");
  const published = boundedPublished(graph);
  const digest = createHash("sha256").update(JSON.stringify({ projectId, baseVersionId: graph.versionId, templateKey, materials: materials.map(item => [item.id, item.extractionVersion]), evidence: evidence.map(item => [item.evidenceId, item.contentHash]) })).digest("hex");
  const enrichedMaterials = materials.map((row, index) => ({ ...row, readiness: materialReadiness[index] }));
  return Object.freeze({ projectId, baseVersionId: graph.versionId, baseVersionLabel: graph.versionLabel, templateId, templateVersion, materials: enrichedMaterials, evidence, published, digest, limits: { maxMaterials: MAX_MATERIALS, maxEvidence: MAX_EVIDENCE, maxEvidenceBytes: MAX_EVIDENCE_BYTES } });
}
