import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { createEvidenceService } from "../materials/evidence-service.mjs";
import { createMaterialIngestService } from "../materials/ingest-service.mjs";
import { materialLimits } from "../materials/policy.mjs";
import { extractMaterial } from "../materials/extractors/index.mjs";
import { createMaterialReadinessService } from "../materials/readiness-service.mjs";

const updateTemplates = Object.freeze([
  { id: "meeting-notes", version: "1.0.0", label: "会议纪要" }, { id: "project-plan", version: "1.0.0", label: "项目计划" },
  { id: "progress-report", version: "1.0.0", label: "进度汇报" }, { id: "metrics-data", version: "1.0.0", label: "指标数据" },
  { id: "outcome-archive", version: "1.0.0", label: "成果归档" }, { id: "new-project-material", version: "1.0.0", label: "新项目材料" }
]);

export class MaterialServiceError extends Error {
  constructor(status, code, message) { super(message); this.name = "MaterialServiceError"; this.status = status; this.code = code; }
}

function timestamp(value) { return new Date(value).toISOString(); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }

export function createMaterialService(database, options = {}) {
  const now = options.now ?? Date.now;
  const evidence = options.evidenceService ?? createEvidenceService(database);
  const ingest = options.ingestService ?? createMaterialIngestService(database, { storageRoot: options.storageRoot, now });
  const readiness = options.readinessService ?? createMaterialReadinessService(database, { now });
  function audit(principal, action, projectId, targetId, metadata = {}) {
    database.prepare("INSERT INTO audit_events (user_id,project_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,'material',?,?,?)")
      .run(principal.id, projectId, action, targetId, JSON.stringify(metadata), timestamp(now()));
  }

  withTransaction(database, () => {
    const insert = database.prepare("INSERT OR IGNORE INTO templates (id, version, name, config_json, created_at) VALUES (?, ?, ?, ?, ?)");
    for (const template of updateTemplates) insert.run(template.id, template.version, template.label, JSON.stringify({ kind: "material-update-template", label: template.label }), "2026-07-18T00:00:00.000Z");
  });

  function access(principal, projectId) {
    if (!principal?.id) throw new MaterialServiceError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    if (principal.isPlatformAdmin) return { role: "platform_admin", editor: true, admin: true };
    const member = database.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, principal.id);
    if (!member) throw new MaterialServiceError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    return { role: member.role, editor: ["project_editor", "project_admin"].includes(member.role), admin: member.role === "project_admin" };
  }
  function material(projectId, materialId) {
    const row = database.prepare(`SELECT m.*, u.display_name AS uploader, s.template_id AS updateTemplateId, s.template_version AS updateTemplateVersion,
      g.enabled AS qaEnabled, g.audience AS qaAudience, gg.enabled AS generationEnabled,
      (SELECT count(*) FROM evidence_blocks b WHERE b.project_id=m.project_id AND b.material_id=m.id AND b.extraction_version=m.active_extraction_version) AS evidenceCount
      FROM project_materials m JOIN users u ON u.id=m.created_by
      LEFT JOIN material_update_selections s ON s.project_id=m.project_id AND s.material_id=m.id
      LEFT JOIN material_qa_grants g ON g.project_id=m.project_id AND g.material_id=m.id
      LEFT JOIN material_generation_grants gg ON gg.project_id=m.project_id AND gg.material_id=m.id
      WHERE m.project_id=? AND m.id=?`).get(projectId, materialId);
    if (!row) throw new MaterialServiceError(404, "MATERIAL_NOT_FOUND", "材料不存在或你无权访问");
    return row;
  }
  function readinessFor(row) {
    return readiness.compute({
      projectId: row.project_id,
      materialId: row.id,
      extractionVersion: row.active_extraction_version,
      templateId: row.updateTemplateId,
      templateVersion: row.updateTemplateVersion
    });
  }
  function dto(row, includeDigest = false) {
    const result = { id: row.id, name: row.display_name, sourceKind: row.source_kind, extension: row.canonical_extension, mime: row.canonical_mime,
      size: row.byte_size, status: row.status, evidenceCount: row.evidenceCount, qa: { enabled: Boolean(row.qaEnabled), audience: row.qaAudience ?? "disabled" }, generation: { enabled: Boolean(row.generationEnabled) },
      updateTemplate: row.updateTemplateId ? { id: row.updateTemplateId, version: row.updateTemplateVersion, label: updateTemplates.find(item => item.id === row.updateTemplateId)?.label ?? "更新模板不可用" } : null,
      readiness: readinessFor(row), uploadedBy: row.uploader, createdAt: row.created_at, updatedAt: row.updated_at, originalAvailable: !row.original_removed_at };
    if (includeDigest) result.sha256 = row.sha256;
    return result;
  }
  function capabilities(principal, projectId) {
    const permission = access(principal, projectId);
    const usage = database.prepare("SELECT count(*) AS count, coalesce(sum(byte_size),0) AS bytes FROM project_materials WHERE project_id=? AND status <> 'deleting'").get(projectId);
    const artifactBytes = database.prepare("SELECT coalesce(sum(byte_size),0) AS bytes FROM material_artifacts WHERE project_id=? AND status='available'").get(projectId).bytes;
    const dayStart = new Date(now()); dayStart.setUTCHours(0,0,0,0);
    const chatUsed = database.prepare("SELECT count(*) AS count FROM ai_usage_events WHERE project_id=? AND capability='chat' AND status IN ('reserved','succeeded','failed') AND created_at>=?").get(projectId, dayStart.toISOString()).count;
    return { role: permission.role, capabilities: { list: true, viewEvidence: true, ask: true, upload: permission.editor, manual: permission.editor, retry: permission.editor, selectUpdateTemplate: permission.editor, manageQa: permission.admin, createGenerationTask: permission.editor, manageGeneration: permission.admin },
      limits: { maxFileBytes: materialLimits.maxFileBytes, maxMaterials: materialLimits.maxMaterialsPerProject, maxProjectBytes: materialLimits.maxProjectArtifactBytes, maxUploadsPerMinute: materialLimits.maxUploadsPerMinute, maxConcurrentUploads: 1, maxZipEntries: materialLimits.maxZipEntries, maxZipExpandedBytes: materialLimits.maxZipExpandedBytes, maxQuestionCharacters: 1000, maxChatPerMinute: 12, maxChatPerDay: 300 },
      usage: { materials: usage.count, materialBytes: artifactBytes, chatToday: chatUsed, chatRemainingToday: Math.max(0, 300-chatUsed) }, updateTemplates };
  }
  function list(principal, projectId) {
    const permission = access(principal, projectId);
    const rows = database.prepare(`SELECT m.*, u.display_name AS uploader, s.template_id AS updateTemplateId, s.template_version AS updateTemplateVersion,
      g.enabled AS qaEnabled, g.audience AS qaAudience, gg.enabled AS generationEnabled,
      (SELECT count(*) FROM evidence_blocks b WHERE b.project_id=m.project_id AND b.material_id=m.id AND b.extraction_version=m.active_extraction_version) AS evidenceCount
      FROM project_materials m JOIN users u ON u.id=m.created_by LEFT JOIN material_update_selections s ON s.project_id=m.project_id AND s.material_id=m.id
      LEFT JOIN material_qa_grants g ON g.project_id=m.project_id AND g.material_id=m.id
      LEFT JOIN material_generation_grants gg ON gg.project_id=m.project_id AND gg.material_id=m.id
      WHERE m.project_id=? AND m.status <> 'deleting' ORDER BY m.created_at DESC, m.id LIMIT 100`).all(projectId);
    return { ...capabilities(principal, projectId), summary: { count: rows.length, readyCount: rows.filter(row => row.status === "ready").length, qaEnabledCount: rows.filter(row => row.qaEnabled).length }, items: rows.map(row => dto(row, permission.editor)) };
  }
  function detail(principal, projectId, materialId) { const permission=access(principal, projectId); return { material: dto(material(projectId, materialId), permission.editor), capabilities: capabilities(principal, projectId).capabilities }; }
  async function upload(principal, projectId, input) { const permission=access(principal, projectId); if (!permission.editor) throw new MaterialServiceError(404,"PROJECT_NOT_FOUND","项目不存在或你无权访问"); const receipt=await ingest.ingest({ ...input, projectId, userId: principal.id }); audit(principal,"material.uploaded",projectId,receipt.id,{status:receipt.status}); return receipt; }
  async function createManual(principal, projectId, input) {
    const permission=access(principal, projectId); if (!permission.editor) throw new MaterialServiceError(404,"PROJECT_NOT_FOUND","项目不存在或你无权访问");
    const title=String(input.title??"").normalize("NFKC").trim().slice(0,240); const body=String(input.body??"").normalize("NFC").trim();
    if (!title || !body || body.length>20_000) throw new MaterialServiceError(400,"INVALID_MANUAL_MATERIAL","人工材料标题或正文无效");
    const extracted=await extractMaterial({ manual:{ body } }); const digest=hash(JSON.stringify({title,body})); const id=randomUUID(); const at=timestamp(now());
    try { withTransaction(database,()=>{
      const count=database.prepare("SELECT count(*) AS count FROM project_materials WHERE project_id=? AND status<>'deleting'").get(projectId).count; if(count>=materialLimits.maxMaterialsPerProject) throw new MaterialServiceError(409,"PROJECT_MATERIAL_LIMIT","项目材料数量已达上限");
      database.prepare(`INSERT INTO project_materials (id,project_id,source_kind,display_name,canonical_extension,canonical_mime,sha256,byte_size,status,active_extraction_version,created_by,created_at,updated_at) VALUES (?,?,'manual',?,'.txt','text/plain',?,?,'ready',1,?,?,?)`).run(id,projectId,title,digest,Buffer.byteLength(body),principal.id,at,at);
      const insert=database.prepare(`INSERT INTO evidence_blocks (external_id,project_id,material_id,extraction_version,ordinal,kind,location_json,text,content_hash,created_at) VALUES (?,?,?,1,?,?,?,?,?,?)`);
      for(const block of extracted.blocks) insert.run(randomUUID(),projectId,id,block.ordinal,block.kind,JSON.stringify(block.location),block.text,hash(block.text),at);
      database.prepare("INSERT INTO material_qa_grants (project_id,material_id,audience,enabled) VALUES (?,?,'disabled',0)").run(projectId,id);
      database.prepare("INSERT INTO material_generation_grants (project_id,material_id,enabled) VALUES (?,?,0)").run(projectId,id);
      audit(principal,"material.manual_created",projectId,id,{blocks:extracted.blocks.length});
    }); } catch(error) { if(String(error.message).includes("UNIQUE constraint failed: project_materials.project_id, project_materials.sha256")) throw new MaterialServiceError(409,"DUPLICATE_MATERIAL","相同内容已归档"); throw error; }
    if(input.updateTemplateId) setUpdateTemplate(principal,projectId,id,{id:input.updateTemplateId,version:input.updateTemplateVersion??"1.0.0"});
    return detail(principal,projectId,id);
  }
  function setUpdateTemplate(principal,projectId,materialId,input){const permission=access(principal,projectId);if(!permission.editor)throw new MaterialServiceError(404,"MATERIAL_NOT_FOUND","材料不存在或你无权访问");const row=material(projectId,materialId);const template=updateTemplates.find(item=>item.id===input.id&&item.version===(input.version??"1.0.0"));if(!template)throw new MaterialServiceError(400,"INVALID_UPDATE_TEMPLATE","更新模板无效");withTransaction(database,()=>{database.prepare(`INSERT INTO material_update_selections (project_id,material_id,template_id,template_version,selected_by,selected_at) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,material_id) DO UPDATE SET template_id=excluded.template_id,template_version=excluded.template_version,selected_by=excluded.selected_by,selected_at=excluded.selected_at`).run(projectId,materialId,template.id,template.version,principal.id,timestamp(now()));if(row.status==="ready"&&row.active_extraction_version)readiness.persist({projectId,materialId,extractionVersion:row.active_extraction_version,templateId:template.id,templateVersion:template.version,createdBy:principal.id});audit(principal,"material.update_template_selected",projectId,materialId,{templateId:template.id,templateVersion:template.version});});return detail(principal,projectId,materialId);}
  function setQa(principal,projectId,materialId,input){const permission=access(principal,projectId);if(!permission.admin)throw new MaterialServiceError(404,"MATERIAL_NOT_FOUND","材料不存在或你无权访问");material(projectId,materialId);const enabled=input.enabled===true;const audience=enabled&&["project_members","editors"].includes(input.audience)?input.audience:"disabled";withTransaction(database,()=>{database.prepare("UPDATE material_qa_grants SET enabled=?,audience=?,granted_by=?,granted_at=? WHERE project_id=? AND material_id=?").run(enabled?1:0,audience,enabled?principal.id:null,enabled?timestamp(now()):null,projectId,materialId);audit(principal,"material.qa_access_changed",projectId,materialId,{enabled,audience});});return detail(principal,projectId,materialId);}
  function setGeneration(principal,projectId,materialId,input){const permission=access(principal,projectId);if(!permission.admin)throw new MaterialServiceError(404,"MATERIAL_NOT_FOUND","材料不存在或你无权访问");material(projectId,materialId);const enabled=input.enabled===true;withTransaction(database,()=>{database.prepare(`INSERT INTO material_generation_grants (project_id,material_id,enabled,granted_by,granted_at) VALUES (?,?,?,?,?) ON CONFLICT(project_id,material_id) DO UPDATE SET enabled=excluded.enabled,granted_by=excluded.granted_by,granted_at=excluded.granted_at`).run(projectId,materialId,enabled?1:0,enabled?principal.id:null,enabled?timestamp(now()):null);audit(principal,"material.generation_access_changed",projectId,materialId,{enabled});});return detail(principal,projectId,materialId);}
  function retry(principal,projectId,materialId){const permission=access(principal,projectId);if(!permission.editor)throw new MaterialServiceError(404,"MATERIAL_NOT_FOUND","材料不存在或你无权访问");const row=material(projectId,materialId);if(!["failed","dependency_missing"].includes(row.status))throw new MaterialServiceError(409,"MATERIAL_NOT_RETRYABLE","材料当前不可重试");const at=timestamp(now());withTransaction(database,()=>{database.prepare("UPDATE project_materials SET status='queued',updated_at=? WHERE project_id=? AND id=?").run(at,projectId,materialId);database.prepare("INSERT INTO material_jobs (id,project_id,material_id,kind,state,created_at,updated_at) VALUES (?, ?, ?, 'extract','queued',?,?)").run(randomUUID(),projectId,materialId,at,at);audit(principal,"material.processing_retried",projectId,materialId);});return detail(principal,projectId,materialId);}
  function listEvidence(principal,projectId,materialId){const permission=access(principal,projectId);material(projectId,materialId);return {items:evidence.list({projectId,materialId,requireQa:!permission.editor,audience:permission.editor?"editor":"project_member"})};}
  function getEvidence(principal,projectId,materialId,evidenceId){const permission=access(principal,projectId);material(projectId,materialId);const item=evidence.get({projectId,evidenceId,requireQa:!permission.editor,audience:permission.editor?"editor":"project_member"});if(!item||item.materialId!==materialId)throw new MaterialServiceError(404,"EVIDENCE_NOT_FOUND","证据不存在或你无权访问");return {evidence:item};}
  function searchEvidence(principal,projectId,query){const permission=access(principal,projectId);return {items:evidence.search({projectId,query,audience:permission.editor?"editor":"project_member"})};}
  return Object.freeze({capabilities,list,detail,upload,createManual,setUpdateTemplate,setQa,setGeneration,retry,listEvidence,getEvidence,searchEvidence,updateTemplates,readiness});
}
