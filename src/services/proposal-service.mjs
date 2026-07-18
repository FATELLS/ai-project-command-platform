import { createGenerationService } from "../proposals/generation-service.mjs";
import { proposalTemplates } from "../proposals/catalog.mjs";
import { ProposalServiceError, proposalError } from "../proposals/errors.mjs";

function timestamp(now) { return new Date(now()).toISOString(); }

export { ProposalServiceError };

export function createProposalService(database, options = {}) {
  const now = options.now ?? Date.now;
  const generation = options.generationService ?? createGenerationService(database, { ...options, provider: options.provider, environment: options.environment, pricing: options.pricing, quotaOptions: options.quotaOptions });

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
    const eligibleMaterials = database.prepare(`SELECT m.id,m.display_name AS name,m.status,m.active_extraction_version AS extractionVersion,s.template_id AS updateTemplateId,s.template_version AS updateTemplateVersion,g.enabled AS generationEnabled,(SELECT count(*) FROM evidence_blocks e WHERE e.project_id=m.project_id AND e.material_id=m.id AND e.extraction_version=m.active_extraction_version) AS evidenceCount FROM project_materials m LEFT JOIN material_update_selections s ON s.project_id=m.project_id AND s.material_id=m.id LEFT JOIN material_generation_grants g ON g.project_id=m.project_id AND g.material_id=m.id WHERE m.project_id=? AND m.status<>'deleting' ORDER BY m.created_at DESC`).all(projectId).map(row=>({id:row.id,name:row.name,status:row.status,extractionVersion:row.extractionVersion,evidenceCount:row.evidenceCount,generation:{enabled:Boolean(row.generationEnabled)},updateTemplate:row.updateTemplateId?{id:row.updateTemplateId,version:row.updateTemplateVersion,label:proposalTemplates.find(item=>item.id===row.updateTemplateId)?.label??"更新模板不可用"}:null}));
    return { role: access.role, capabilities: { read: access.read, create: access.create, createTask: access.create, retry: access.create, manageGeneration: access.admin }, provider: { enabled: Boolean(generation.provider.configured) }, baseVersionId: project.baseVersionId, baseVersion: project.baseVersion, schemaVersion: "change-proposal-v1@1.0.0", limits: { maxMaterialsPerTask: 8, maxEvidenceBlocks: 48, maxPublishedBytes: 32*1024, maxEvidenceBytes: 64*1024, maxOutputBytes: 128*1024, maxChanges: 100, perMinute: 4, perDay: 100 }, usage: { today: used, remainingToday: Math.max(0,100-used) }, templates: proposalTemplates, eligibleMaterials };
  }

  async function createJob(principal, projectId, input) {
    const access = permission(principal, projectId); if (!access.create) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    const job = generation.createJob(principal, { projectId, materialIds: input.materialIds, baseVersionId: input.baseVersionId, idempotencyKey: input.idempotencyKey });
    audit(principal,"generation.created",projectId,"generation_job",job.id,{template:job.template,baseVersionId:job.baseVersionId,materials:job.materials.length});
    const result = options.autoProcess === false ? job : await generation.processJob(projectId, job.id);
    if (result.state !== job.state) audit(principal,"generation.completed",projectId,"generation_job",job.id,{state:result.state,errorCode:result.errorCode,proposalId:result.proposalId});
    return { task: result };
  }

  function listJobs(principal,projectId){permission(principal,projectId);return {items:generation.repository.listJobs(projectId),capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  function getJob(principal,projectId,id){permission(principal,projectId);const task=generation.repository.getJob(projectId,id);if(!task)throw proposalError("GENERATION_JOB_NOT_FOUND","生成任务不存在或你无权访问",404);return {task,capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  async function retryJob(principal,projectId,id,input){const access=permission(principal,projectId);if(!access.create)throw proposalError("GENERATION_JOB_NOT_FOUND","生成任务不存在或你无权访问",404);const task=generation.retryJob(principal,projectId,id,input.idempotencyKey);audit(principal,"generation.retried",projectId,"generation_job",task.id,{retryOf:id});const result=options.autoProcess===false?task:await generation.processJob(projectId,task.id);return {task:result};}
  function enrichProposal(projectId, proposal) { if (!proposal) return proposal; return { ...proposal, changes: proposal.changes.map(change => ({ ...change, evidence: change.evidenceIds.map(id => { const row=database.prepare(`SELECT e.external_id AS evidenceId,e.material_id AS materialId,e.ordinal,e.kind,e.location_json AS locationJson,m.display_name AS materialName FROM evidence_blocks e JOIN project_materials m ON m.project_id=e.project_id AND m.id=e.material_id WHERE e.project_id=? AND e.external_id=?`).get(projectId,id); return row ? {...row,location:JSON.parse(row.locationJson)} : {evidenceId:id}; }) })) }; }
  function listProposals(principal,projectId){permission(principal,projectId);return {items:generation.repository.listProposals(projectId).map(item=>enrichProposal(projectId,item)),capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  function getProposal(principal,projectId,id){permission(principal,projectId);const proposal=enrichProposal(projectId,generation.repository.getProposal(projectId,id));if(!proposal)throw proposalError("CHANGE_PROPOSAL_NOT_FOUND","更新提案不存在或你无权访问",404);return {proposal,capabilities:capabilityEnvelope(principal,projectId).capabilities};}
  return Object.freeze({capabilities:capabilityEnvelope,createJob,listJobs,getJob,retryJob,listProposals,getProposal,generation});
}
