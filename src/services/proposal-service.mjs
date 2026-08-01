import { createGenerationService } from "../proposals/generation-service.mjs";
import { proposalTemplates, getProposalTemplate } from "../proposals/catalog.mjs";
import { ProposalServiceError, proposalError } from "../proposals/errors.mjs";
import { validateProposal } from "../proposals/validator.mjs";
import { boundedPublished, MAX_EVIDENCE, MAX_EVIDENCE_BYTES } from "../proposals/context-builder.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { createMaterialReadinessService } from "../materials/readiness-service.mjs";
import { createHash, randomUUID } from "node:crypto";

function timestamp(now) { return new Date(now()).toISOString(); }

export { ProposalServiceError };

export function createProposalService(database, options = {}) {
  const now = options.now ?? Date.now;
  const generation = options.generationService ?? createGenerationService(database, { ...options, provider: options.provider, environment: options.environment, pricing: options.pricing, quotaOptions: options.quotaOptions });
  const readiness = createMaterialReadinessService(database, { now });

  function permission(principal, projectId) {
    if (!principal?.id) throw proposalError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    if (principal.isPlatformAdmin) return { role: "platform_admin", read: true, create: true, admin: true };
    const row = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, principal.id);
    if (!row) throw proposalError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    return { role: row.role, read: true, create: ["project_editor", "project_admin"].includes(row.role), admin: row.role === "project_admin" };
  }

  function audit(principal, action, projectId, targetType, targetId, metadata = {}) {
    database.prepare("INSERT INTO audit_events (user_id,project_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(principal.id, projectId, action, targetType, targetId, JSON.stringify(metadata), timestamp(now));
  }

  function capabilityEnvelope(principal, projectId) {
    const access = permission(principal, projectId);
    const project = database.prepare(`SELECT p.published_version_id AS baseVersionId,v.version_label AS baseVersion FROM projects p JOIN project_versions v ON v.id=p.published_version_id WHERE p.id=?`).get(projectId);
    if (!project) throw proposalError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    const dayStart = new Date(now()); dayStart.setUTCHours(0,0,0,0);
    const used = database.prepare("SELECT count(*) AS count FROM ai_usage_events WHERE project_id=? AND capability='generation' AND status IN ('reserved','succeeded','failed') AND created_at>=?").get(projectId, dayStart.toISOString()).count;
    const eligibleMaterials = database.prepare(`SELECT m.id,m.display_name AS name,m.status,m.active_extraction_version AS extractionVersion,s.template_id AS updateTemplateId,s.template_version AS updateTemplateVersion,g.enabled AS generationEnabled,(SELECT count(*) FROM evidence_blocks e WHERE e.project_id=m.project_id AND e.material_id=m.id AND e.extraction_version=m.active_extraction_version) AS evidenceCount FROM project_materials m LEFT JOIN material_update_selections s ON s.project_id=m.project_id AND s.material_id=m.id LEFT JOIN material_generation_grants g ON g.project_id=m.project_id AND g.material_id=m.id WHERE m.project_id=? AND m.status<>'deleting' ORDER BY m.created_at DESC`).all(projectId).map(row=>({
      id: row.id,
      name: row.name,
      status: row.status,
      extractionVersion: row.extractionVersion,
      evidenceCount: row.evidenceCount,
      generation: { enabled: Boolean(row.generationEnabled) },
      updateTemplate: row.updateTemplateId ? { id: row.updateTemplateId, version: row.updateTemplateVersion, label: proposalTemplates.find(item=>item.id===row.updateTemplateId)?.label ?? "更新模板不可用" } : null,
      readiness: row.updateTemplateId ? readiness.compute({ projectId, materialId: row.id, extractionVersion: row.extractionVersion, templateId: row.updateTemplateId, templateVersion: row.updateTemplateVersion }) : null
    }));
    return { role: access.role, capabilities: { read: access.read, create: access.create, createTask: access.create, retry: access.create, manageGeneration: access.admin }, provider: { enabled: Boolean(generation.provider.configured) }, baseVersionId: project.baseVersionId, baseVersion: project.baseVersion, schemaVersion: "change-proposal-v1@1.0.0", limits: { maxMaterialsPerTask: 8, maxEvidenceBlocks: 48, maxPublishedBytes: 32*1024, maxEvidenceBytes: 64*1024, maxOutputBytes: 128*1024, maxChanges: 100, perMinute: 20, perDay: 100000 }, usage: { today: used, remainingToday: Math.max(0,100000-used) }, templates: proposalTemplates, eligibleMaterials };
  }

  async function createJob(principal, projectId, input) {
    const access = permission(principal, projectId); if (!access.create) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    const job = generation.createJob(principal, { projectId, materialIds: input.materialIds, baseVersionId: input.baseVersionId, idempotencyKey: input.idempotencyKey });
    audit(principal,"generation.created",projectId,"generation_job",job.id,{template:job.template,baseVersionId:job.baseVersionId,materials:job.materials.length});
    if (options.syncProcess) {
      // 测试模式：同步处理
      const result = await generation.processJob(projectId, job.id);
      if (result.state !== job.state) audit(principal,"generation.completed",projectId,"generation_job",job.id,{state:result.state,errorCode:result.errorCode,proposalId:result.proposalId});
      return { task: result };
    }
    // 异步模式：立即返回 queued 状态，后台执行 processJob
    setImmediate(() => {
      generation.processJob(projectId, job.id)
        .then(result => { if (result.state !== job.state) audit(principal,"generation.completed",projectId,"generation_job",job.id,{state:result.state,errorCode:result.errorCode,proposalId:result.proposalId}); })
        .catch(error => { console.error(`[generation] processJob failed for ${job.id}:`, error?.message ?? error); });
    });
    return { task: job };
  }

  // 一键全部生成：自动发现所有符合条件的材料，按模板分组，每组创建一个生成任务。
  // 过滤条件：status=ready + 有 updateTemplate + generationEnabled + readiness 非 blocked。
  async function createBatchJobs(principal, projectId) {
    const access = permission(principal, projectId);
    if (!access.create) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    const envelope = capabilityEnvelope(principal, projectId);
    const eligible = (envelope.eligibleMaterials ?? []).filter(item =>
      item.status === "ready" && item.updateTemplate?.id && item.generation?.enabled && item.readiness?.status !== "blocked" && Number(item.evidenceCount) > 0
    );
    if (!eligible.length) throw proposalError("INVALID_MATERIAL_SELECTION", "当前没有可用于批量生成的材料", 422);
    // 按模板分组（templateId@templateVersion）
    const groups = new Map();
    for (const item of eligible) {
      const key = `${item.updateTemplate.id}@${item.updateTemplate.version}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item.id);
    }
    const results = [];
    for (const [key, materialIds] of groups) {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 32);
      // 每组最多 8 份材料（服务端上限）
      for (let i = 0; i < materialIds.length; i += 8) {
        const batch = materialIds.slice(i, i + 8);
        const idempotencyKey = `batch-${safeKey}-${i}-${randomUUID()}`;
        const job = generation.createJob(principal, { projectId, materialIds: batch, idempotencyKey });
        audit(principal, "generation.batch_created", projectId, "generation_job", job.id, { template: key, materials: batch.length, batch: true });
        if (options.syncProcess) {
          const result = await generation.processJob(projectId, job.id);
          if (result.state !== job.state) audit(principal,"generation.batch_completed",projectId,"generation_job",job.id,{state:result.state,errorCode:result.errorCode,proposalId:result.proposalId,batch:true});
          results.push(result);
        } else {
          setImmediate(() => {
            generation.processJob(projectId, job.id)
              .then(result => { if (result.state !== job.state) audit(principal,"generation.batch_completed",projectId,"generation_job",job.id,{state:result.state,errorCode:result.errorCode,proposalId:result.proposalId,batch:true}); })
              .catch(error => { console.error(`[generation] batch processJob failed for ${job.id}:`, error?.message ?? error); });
          });
          results.push(job);
        }
      }
    }
    if (options.syncProcess) {
      const succeeded = results.filter(r => r.state === "succeeded").length;
      const failed = results.filter(r => ["failed_terminal", "failed_retryable", "stale"].includes(r.state)).length;
      return { tasks: results, summary: { total: results.length, succeeded, failed, groups: groups.size } };
    }
    const pending = results.length;
    return { tasks: results, summary: { total: results.length, pending, groups: groups.size } };
  }

  function listJobs(principal,projectId){permission(principal,projectId);return {items:generation.repository.listJobs(projectId),capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  function getJob(principal,projectId,id){permission(principal,projectId);const task=generation.repository.getJob(projectId,id);if(!task)throw proposalError("GENERATION_JOB_NOT_FOUND","生成任务不存在或你无权访问",404);return {task,capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  async function retryJob(principal,projectId,id,input){const access=permission(principal,projectId);if(!access.create)throw proposalError("GENERATION_JOB_NOT_FOUND","生成任务不存在或你无权访问",404);const task=generation.retryJob(principal,projectId,id,input.idempotencyKey);audit(principal,"generation.retried",projectId,"generation_job",task.id,{retryOf:id});if(options.syncProcess){const result=await generation.processJob(projectId,task.id);return {task:result};}setImmediate(()=>{generation.processJob(projectId,task.id).catch(error=>{console.error(`[generation] retry processJob failed for ${task.id}:`,error?.message??error);});});return {task};}
  function enrichProposal(projectId, proposal) { if (!proposal) return proposal; return { ...proposal, changes: proposal.changes.map(change => ({ ...change, evidence: change.evidenceIds.map(id => { const row=database.prepare(`SELECT e.external_id AS evidenceId,e.material_id AS materialId,e.ordinal,e.kind,e.location_json AS locationJson,m.display_name AS materialName FROM evidence_blocks e JOIN project_materials m ON m.project_id=e.project_id AND m.id=e.material_id WHERE e.project_id=? AND e.external_id=?`).get(projectId,id); return row ? {...row,location:JSON.parse(row.locationJson)} : {evidenceId:id}; }) })) }; }
  function listProposals(principal,projectId){permission(principal,projectId);return {items:generation.repository.listProposals(projectId).map(item=>enrichProposal(projectId,item)),capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  function getProposal(principal,projectId,id){permission(principal,projectId);const proposal=enrichProposal(projectId,generation.repository.getProposal(projectId,id));if(!proposal)throw proposalError("CHANGE_PROPOSAL_NOT_FOUND","更新提案不存在或你无权访问",404);return {proposal,capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  // Phase 8：交互发起的 manual proposal（拖拽卡片等）。锁定当前 published，复用 validator，保存为 pending，无 generation job。
  // 与生成提案共享同一证据/高影响边界：必须引用项目内已就绪材料的证据；纯 plan 类允许无证据。
  function createInteractionProposal(principal, projectId, input) {
    const access = permission(principal, projectId);
    if (!access.create) throw proposalError("CHANGE_PROPOSAL_NOT_FOUND", "更新提案不存在或你无权访问", 404);
    const repository = createProjectRepository(database);
    const graph = repository.getModuleVersionGraph(projectId, "published");
    if (!graph) throw proposalError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    const { materialIds, evidence } = loadInteractionEvidence(projectId, input);
    const context = { projectId, baseVersionId: graph.versionId, baseVersionLabel: graph.versionLabel, templateId: "interaction", templateVersion: "1.0.0", materials: materialIds.map(id => ({ id })), evidence, published: boundedPublished(graph), digest: createHash("sha256").update(JSON.stringify({ projectId, baseVersionId: graph.versionId, interaction: true, materials: materialIds, evidence: evidence.map(item => [item.evidenceId, item.contentHash]) })).digest("hex"), limits: { maxMaterials: materialIds.length, maxEvidence: MAX_EVIDENCE, maxEvidenceBytes: MAX_EVIDENCE_BYTES } };
    const summary = String(input.summary ?? "交互提案").slice(0, 500);
    const envelope = { schemaVersion: "change-proposal-v1@1.0.0", projectId, baseVersionId: graph.versionId, template: { id: "interaction", version: "1.0.0" }, materialIds, summary, changes: Array.isArray(input.changes) ? input.changes : [], warnings: [] };
    const validated = validateProposal(envelope, context);
    const proposal = { ...validated, proposalId: undefined, schemaVersion: envelope.schemaVersion, projectId, baseVersionId: graph.versionId, template: { id: "interaction", version: "1.0.0" }, materialIds, summary: envelope.summary, changes: validated.changes, warnings: validated.warnings };
    const saved = generation.repository.saveInteractionProposal(projectId, proposal);
    audit(principal, "proposal.interaction_created", projectId, "change_proposal", saved.proposalId, { changes: saved.changes.length, materials: materialIds.length, evidence: evidence.length });
    return { proposal: enrichProposal(projectId, saved) };
  }
  // Phase 8：交互提案引用项目内已就绪材料证据。低影响人工编辑可不附材料；
  // 高影响字段和删除仍由 validator 强制要求证据。
  function loadInteractionEvidence(projectId, input) {
    const rawMaterialIds = Array.isArray(input.materialIds) ? input.materialIds : [];
    if (rawMaterialIds.length > 8) throw proposalError("INVALID_MATERIAL_SELECTION", "交互提案最多引用 8 份项目材料", 422);
    const materialIds = rawMaterialIds.map(id => String(id ?? "").trim());
    if (materialIds.some(id => !/^[a-zA-Z0-9._-]{16,128}$/.test(id)) || new Set(materialIds).size !== materialIds.length) throw proposalError("INVALID_MATERIAL_SELECTION", "交互提案材料选择无效", 422);
    const requestedEvidence = Array.isArray(input.evidenceIds) ? input.evidenceIds.map(id => String(id ?? "").trim()) : [];
    if (!materialIds.length) {
      if (requestedEvidence.length) throw proposalError("EVIDENCE_NOT_ALLOWED", "未选择材料时不能引用证据", 422);
      return Object.freeze({ materialIds: [], evidence: [] });
    }
    const placeholders = materialIds.map(() => "?").join(",");
    const rows = database.prepare(`SELECT id, display_name AS name, active_extraction_version AS extractionVersion, status FROM project_materials WHERE project_id=? AND id IN (${placeholders})`).all(projectId, ...materialIds);
    if (rows.length !== materialIds.length) throw proposalError("MATERIAL_NOT_FOUND", "材料不存在或你无权访问", 404);
    if (rows.some(row => row.status !== "ready" || !row.extractionVersion)) throw proposalError("MATERIAL_NOT_READY", "所选材料尚未处理完成", 409);
    const byMaterial = new Map(rows.map(row => [row.id, row]));
    const selectEvidence = database.prepare(`SELECT external_id AS evidenceId, material_id AS materialId, kind, location_json AS locationJson, text, summary, content_hash AS contentHash, extraction_version AS extractionVersion FROM evidence_blocks WHERE project_id=? AND external_id=?`);
    const evidence = [];
    let evidenceBytes = 0;
    for (const evidenceId of requestedEvidence) {
      const row = selectEvidence.get(projectId, evidenceId);
      if (!row) throw proposalError("EVIDENCE_NOT_ALLOWED", "交互提案引用了不可用证据", { evidenceId });
      const material = byMaterial.get(row.materialId);
      if (!material || row.extractionVersion !== material.extractionVersion) throw proposalError("EVIDENCE_NOT_ALLOWED", "证据不属于所选材料", { evidenceId });
      if (evidence.length >= MAX_EVIDENCE) throw proposalError("EVIDENCE_REQUIRED", "交互提案引用证据超过上限", 422);
      evidenceBytes += Buffer.byteLength(row.text);
      if (evidenceBytes > MAX_EVIDENCE_BYTES) throw proposalError("EVIDENCE_REQUIRED", "交互提案引用证据过大", 422);
      evidence.push({ ...row, location: JSON.parse(row.locationJson), materialName: material.name });
    }
    return Object.freeze({ materialIds, evidence });
  }
  return Object.freeze({capabilities:capabilityEnvelope,createJob,createBatchJobs,listJobs,getJob,retryJob,listProposals,getProposal,createInteractionProposal,generation});
}
