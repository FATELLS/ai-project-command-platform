import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { createProposalRepository } from "../proposals/proposal-repository.mjs";
import { validateProposal } from "../proposals/validator.mjs";
import { applyReviewedChanges } from "./version-apply.mjs";
import { validateReviewGraph } from "./graph-validator.mjs";
import { cloneVersion, fingerprintGraph, nextVersionLabel, setVersionChecksum } from "../versions/version-store.mjs";
import { getModuleDefinition } from "../modules/registry.mjs";
import { ReviewServiceError, reviewError } from "./errors.mjs";

export { ReviewServiceError };

function parse(value,fallback){try{return JSON.parse(value);}catch{return fallback;}}
function timestamp(now){return new Date(now()).toISOString();}
function plainObject(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}

export function createReviewService(database,options={}) {
  const now=options.now??Date.now,projects=createProjectRepository(database),proposals=createProposalRepository(database,{now}),clock=()=>timestamp(now);
  function permission(principal,projectId){if(!principal?.id)throw reviewError("PROJECT_NOT_FOUND","项目不存在或你无权访问",404);if(principal.isPlatformAdmin)return{role:"platform_admin",read:true,review:true,release:true};const row=database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId,principal.id);if(!row)throw reviewError("PROJECT_NOT_FOUND","项目不存在或你无权访问",404);return{role:row.role,read:true,review:row.role==="project_admin",release:row.role==="project_admin"};}
  function audit(principal,action,projectId,targetType,targetId,metadata={}){database.prepare("INSERT INTO audit_events (user_id,project_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)").run(principal.id,projectId,action,targetType,targetId,JSON.stringify(metadata),clock());}
  function getProposal(projectId,proposalId){const proposal=proposals.getProposal(projectId,proposalId);if(!proposal)throw reviewError("CHANGE_PROPOSAL_NOT_FOUND","更新建议不存在或你无权访问",404);return proposal;}
  function currentBase(projectId,proposal){const project=projects.getProject(projectId);if(!project||Number(project.publishedVersionId)!==Number(proposal.baseVersionId))throw reviewError("PROPOSAL_BASE_STALE","发布版本已变化，无法继续审核此建议",409);return projects.getModuleVersionGraph(projectId,"published");}
  function lockedContext(projectId,proposal){
    const graph=currentBase(projectId,proposal),job=proposal.jobId?proposals.getJob(projectId,proposal.jobId):null;
    if(proposal.template.id!=="interaction"&&!job)throw reviewError("GENERATION_JOB_NOT_FOUND","生成任务不存在",409);
    const materials=job?.materials??(proposal.materialIds??[]).map(id=>({id}));
    const evidence=job?.evidence??[...new Set(proposal.changes.flatMap(change=>change.evidenceIds??[]))].map(evidenceId=>({evidenceId}));
    return{projectId,baseVersionId:proposal.baseVersionId,templateId:proposal.template.id,templateVersion:proposal.template.version,materials,evidence,published:{units:graph.units,stages:graph.stages,tasks:graph.tasks,risks:graph.risks,metrics:graph.metrics,outcomes:graph.closures}};
  }
  function envelope(proposal,changes){return{schemaVersion:proposal.schemaVersion,projectId:proposal.projectId,baseVersionId:proposal.baseVersionId,template:proposal.template,materialIds:proposal.materialIds,summary:proposal.summary,changes:changes.map(change=>({changeId:change.changeId,module:change.module,operation:change.operation,targetId:change.targetId,semanticType:change.semanticType,patch:change.patch,evidenceIds:change.evidenceIds,confidence:change.confidence,warnings:change.warnings??[]})),warnings:proposal.warnings??[]};}
  function rows(projectId,proposalId){return database.prepare(`SELECT r.change_id AS changeId,r.decision,r.edited_patch_json AS editedPatchJson,r.note,r.reviewed_by AS reviewedBy,r.reviewed_at AS reviewedAt,u.display_name AS reviewedByName FROM proposal_review_items r LEFT JOIN users u ON u.id=r.reviewed_by WHERE r.project_id=? AND r.proposal_id=? ORDER BY r.change_id`).all(projectId,proposalId).map(row=>({...row,editedPatch:row.editedPatchJson?parse(row.editedPatchJson,null):null}));}
  function originalValue(graph,change){if(change.operation==="create")return null;if(change.module==="overview")return graph.metadata;if(change.module==="units")return graph.units.find(item=>item.id===change.targetId)??null;if(change.module==="roadmap")return graph.stages.find(item=>item.id===change.targetId)??null;if(["task-network","gantt"].includes(change.module))return graph.tasks.find(item=>item.id===change.targetId)??null;if(change.module==="outcomes")return graph.closures.find(item=>item.id===change.targetId)??null;if(change.module==="risks")return graph.risks.find(item=>item.id===change.targetId)??null;if(change.module==="metrics")return graph.metrics.find(item=>item.id===change.targetId)??null;return null;}
  function capabilities(access,proposal,decisions){const complete=decisions.length>0&&decisions.every(item=>item.decision!=="pending"),accepted=decisions.filter(item=>item.decision==="accepted").length;return{read:access.read,review:access.review&&proposal.status==="pending",merge:access.review&&proposal.status==="pending"&&complete&&accepted>0,complete,accepted,rejected:decisions.filter(item=>item.decision==="rejected").length,pending:decisions.filter(item=>item.decision==="pending").length};}
  function getReview(principal,projectId,proposalId){const access=permission(principal,projectId),proposal=getProposal(projectId,proposalId),graph=projects.getModuleVersionGraph(projectId,"published"),decisions=rows(projectId,proposalId),byId=new Map(decisions.map(item=>[item.changeId,item]));const merged=database.prepare("SELECT id,result_draft_version_id AS resultDraftVersionId,merged_at AS mergedAt FROM proposal_merges WHERE project_id=? AND proposal_id=?").get(projectId,proposalId);return{proposal:{...proposal,changes:proposal.changes.map(change=>({...change,original:originalValue(graph,change),review:byId.get(change.changeId)??{decision:"pending"}}))},capabilities:capabilities(access,proposal,decisions),merged:merged??null};}
  function revalidate(projectId,proposal,changes){try{return validateProposal(envelope(proposal,changes),lockedContext(projectId,proposal));}catch(error){if(error?.status)throw new ReviewServiceError(error.status,error.code,error.message,error.details);throw error;}}
  function setDecision(principal,projectId,proposalId,changeId,input){
    const access=permission(principal,projectId);
    if(!access.review)throw reviewError("CHANGE_PROPOSAL_NOT_FOUND","更新建议不存在或你无权访问",404);
    const proposal=getProposal(projectId,proposalId);
    if(proposal.status!=="pending")throw reviewError("PROPOSAL_REVIEW_CLOSED","建议审核已结束",409);
    const change=proposal.changes.find(item=>item.changeId===changeId);
    if(!change)throw reviewError("PROPOSAL_CHANGE_NOT_FOUND","变更项不存在或你无权访问",404);
    const decision=input.decision;
    if(!["accepted","rejected"].includes(decision))throw reviewError("INVALID_REVIEW_DECISION","审核决定无效",400);
    const saved=rows(projectId,proposalId).find(item=>item.changeId===changeId);
    let patch=decision==="accepted"?(saved?.editedPatch??null):null;
    if(decision==="accepted"&&input.patch!==undefined){
      if(!plainObject(input.patch))throw reviewError("INVALID_REVIEW_PATCH","编辑字段必须是有效的变更项",400);
      patch=input.patch;
    }
    const note=String(input.note??saved?.note??"").trim();
    if(note.length>500)throw reviewError("INVALID_REVIEW_NOTE","审核说明不能超过 500 字",400);
    const changes=proposal.changes.map(item=>item.changeId===changeId?{...item,patch:patch??item.patch}:item);
    revalidate(projectId,proposal,changes);
    return withTransaction(database,()=>{
      const at=clock();
      database.prepare(`UPDATE proposal_review_items SET decision=?,edited_patch_json=?,note=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE project_id=? AND proposal_id=? AND change_id=?`).run(decision,patch?JSON.stringify(patch):null,note,principal.id,at,at,projectId,proposalId,changeId);
      const states=rows(projectId,proposalId);
      if(states.every(item=>item.decision==="rejected"))database.prepare("UPDATE change_proposals SET status='rejected',updated_at=? WHERE project_id=? AND id=?").run(at,projectId,proposalId);
      audit(principal,`proposal.${decision}`,projectId,"change_proposal_item",`${proposalId}:${changeId}`,{edited:Boolean(patch),note:Boolean(note)});
      return getReview(principal,projectId,proposalId);
    });
  }
  function updatePreviewItem(principal,projectId,proposalId,changeId,input){
    const access=permission(principal,projectId);
    if(!access.review)throw reviewError("CHANGE_PROPOSAL_NOT_FOUND","更新建议不存在或你无权访问",404);
    const proposal=getProposal(projectId,proposalId);
    if(proposal.status!=="pending")throw reviewError("PROPOSAL_REVIEW_CLOSED","建议审核已结束",409);
    const change=proposal.changes.find(item=>item.changeId===changeId);
    if(!change)throw reviewError("PROPOSAL_CHANGE_NOT_FOUND","变更项不存在或你无权访问",404);
    if(!plainObject(input.patch))throw reviewError("INVALID_REVIEW_PATCH","编辑字段必须是有效的变更项",400);
    const note=String(input.note??"").trim();
    if(note.length>500)throw reviewError("INVALID_REVIEW_NOTE","编辑说明不能超过 500 字",400);
    const decisions=rows(projectId,proposalId),byId=new Map(decisions.map(item=>[item.changeId,item]));
    if(byId.get(changeId)?.decision==="rejected")throw reviewError("PROPOSAL_CHANGE_REJECTED","已移除的预览卡片不能编辑",409);
    const changes=proposal.changes.map(item=>{
      const saved=byId.get(item.changeId)?.editedPatch;
      return{...item,patch:item.changeId===changeId?input.patch:(saved??item.patch)};
    });
    revalidate(projectId,proposal,changes);
    return withTransaction(database,()=>{
      const at=clock();
      database.prepare(`UPDATE proposal_review_items SET edited_patch_json=?,note=?,updated_at=? WHERE project_id=? AND proposal_id=? AND change_id=?`).run(JSON.stringify(input.patch),note,at,projectId,proposalId,changeId);
      audit(principal,"proposal.preview_edited",projectId,"change_proposal_item",`${proposalId}:${changeId}`,{fields:Object.keys(input.patch),note:Boolean(note)});
      return getReview(principal,projectId,proposalId);
    });
  }
  function acceptModule(principal,projectId,proposalId,moduleType){const access=permission(principal,projectId);if(!access.review)throw reviewError("CHANGE_PROPOSAL_NOT_FOUND","更新建议不存在或你无权访问",404);const proposal=getProposal(projectId,proposalId);if(proposal.status!=="pending")throw reviewError("PROPOSAL_REVIEW_CLOSED","建议审核已结束",409);const changes=proposal.changes.filter(item=>item.module===moduleType);if(!changes.length)throw reviewError("PROPOSAL_MODULE_NOT_FOUND","变更项模块不存在",404);revalidate(projectId,proposal,proposal.changes);return withTransaction(database,()=>{const at=clock();database.prepare(`UPDATE proposal_review_items SET decision='accepted',reviewed_by=?,reviewed_at=?,updated_at=? WHERE project_id=? AND proposal_id=? AND change_id IN (SELECT change_id FROM change_proposal_items WHERE project_id=? AND proposal_id=? AND module_type=?)`).run(principal.id,at,at,projectId,proposalId,projectId,proposalId,moduleType);audit(principal,"proposal.module_accepted",projectId,"change_proposal",proposalId,{module:moduleType,count:changes.length});return getReview(principal,projectId,proposalId);});}
  function merge(principal,projectId,proposalId){const access=permission(principal,projectId);if(!access.review)throw reviewError("CHANGE_PROPOSAL_NOT_FOUND","更新建议不存在或你无权访问",404);const proposal=getProposal(projectId,proposalId);if(proposal.status!=="pending")throw reviewError("PROPOSAL_REVIEW_CLOSED","建议审核已结束",409);if(database.prepare("SELECT 1 FROM proposal_merges WHERE project_id=? AND proposal_id=?").get(projectId,proposalId))throw reviewError("PROPOSAL_ALREADY_MERGED","建议已应用",409);const decisions=rows(projectId,proposalId);if(decisions.some(item=>item.decision==="pending"))throw reviewError("PROPOSAL_REVIEW_INCOMPLETE","仍有未审核的变更项",409);const byId=new Map(decisions.map(item=>[item.changeId,item])),accepted=proposal.changes.filter(item=>byId.get(item.changeId)?.decision==="accepted").map(item=>({...item,patch:byId.get(item.changeId).editedPatch??item.patch}));if(!accepted.length)throw reviewError("NO_ACCEPTED_CHANGES","没有可应用的已接受项",409);revalidate(projectId,proposal,accepted);return withTransaction(database,()=>{const project=projects.getProject(projectId);if(Number(project.publishedVersionId)!==Number(proposal.baseVersionId))throw reviewError("PROPOSAL_BASE_STALE","发布版本已变化，无法合并此建议",409);const source=project.draftVersionId,at=clock(),label=nextVersionLabel(database,projectId,"draft","draft-review"),target=cloneVersion(database,{projectId,sourceVersionId:source,layer:"draft",versionLabel:label,createdAt:at,metadata:{updatedAt:at}});try{applyReviewedChanges(database,target,accepted);}catch(error){throw reviewError("DRAFT_MERGE_INVALID",error?.code==="ERR_CONSTRAINT_FOREIGNKEY"?"应用到草稿违反项目关系约束":error.message,422);}database.prepare("UPDATE projects SET draft_version_id=?,updated_at=? WHERE id=?").run(target,at,projectId);const graph=projects.getModuleVersionGraph(projectId,"draft");try{validateReviewGraph(graph);}catch(error){throw reviewError(error.code??"DRAFT_MERGE_INVALID",error.message,422,error.details);}setVersionChecksum(database,target,fingerprintGraph(graph));database.prepare(`INSERT INTO proposal_merges (id,project_id,proposal_id,source_draft_version_id,result_draft_version_id,accepted_count,rejected_count,merged_by,merged_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(randomUUID(),projectId,proposalId,source,target,accepted.length,decisions.length-accepted.length,principal.id,at);database.prepare("UPDATE change_proposals SET status='accepted',updated_at=? WHERE project_id=? AND id=?").run(at,projectId,proposalId);audit(principal,"proposal.merged_to_draft",projectId,"change_proposal",proposalId,{sourceDraftVersionId:source,resultDraftVersionId:target,accepted:accepted.length,rejected:decisions.length-accepted.length});return{review:getReview(principal,projectId,proposalId),draft:{versionId:target,versionLabel:label}};});}
  // 在内存中将 proposal changes 投影到 published graph 上，生成预览图（不写DB）
  // 用于审核界面展示"如果应用这些建议，路线图/任务网络等会变成什么样"
  function projectGraph(graph, changes) {
    const cloned = {
      ...graph,
      units: graph.units.map(u => ({ ...u })),
      stages: graph.stages.map(s => ({ ...s })),
      closures: graph.closures.map(c => ({ ...c })),
      tasks: graph.tasks.map(t => ({ ...t, dependsOn: [...(t.dependsOn ?? [])] })),
      workstreams: graph.workstreams.map(w => ({ ...w, taskIds: [...(w.taskIds ?? [])] })),
      risks: graph.risks.map(r => ({ ...r })),
      metrics: graph.metrics.map(m => ({ ...m }))
    };
    const moduleToCollection = {
      "roadmap": "stages",
      "units": "units",
      "task-network": "tasks",
      "gantt": "tasks",
      "outcomes": "closures",
      "risks": "risks",
      "metrics": "metrics"
    };
    const changedIds = { added: new Set(), modified: new Set(), removed: new Set() };
    for (const change of changes) {
      const collectionKey = moduleToCollection[change.module];
      if (!collectionKey) continue;
      const collection = cloned[collectionKey];
      const idx = collection.findIndex(item => item.id === change.targetId);
      if (change.operation === "create") {
        if (idx === -1) {
          const newItem = { id: change.targetId, ...change.patch };
          collection.push(newItem);
          changedIds.added.add(change.targetId);
        }
      } else if (change.operation === "update") {
        if (idx >= 0) {
          collection[idx] = { ...collection[idx], ...change.patch, id: change.targetId };
          changedIds.modified.add(change.targetId);
        }
      } else if (change.operation === "delete") {
        if (idx >= 0) {
          collection.splice(idx, 1);
          changedIds.removed.add(change.targetId);
        }
      }
    }
    return { graph: cloned, changedIds };
  }

  // 预览模块：将 proposal 的 changes 投影到 published graph 上，返回指定模块的预览数据
  function previewModule(principal, projectId, proposalId, moduleType) {
    const access = permission(principal, projectId);
    if (!access.read) throw reviewError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    const proposal = getProposal(projectId, proposalId);
    const graph = projects.getModuleVersionGraph(projectId, "published");
    if (!graph) throw reviewError("PROJECT_NOT_FOUND", "项目不存在或你无权访问", 404);
    // 预览反映当前审核选择：pending 与 accepted 保留，rejected 退出；accepted 使用编辑后的值。
    const decisions = rows(projectId, proposalId);
    const byId = new Map(decisions.map(item => [item.changeId, item]));
    const applicableChanges = proposal.changes
      .filter(item => byId.get(item.changeId)?.decision !== "rejected")
      .map(item => {
        const decision = byId.get(item.changeId);
        return decision?.editedPatch
          ? { ...item, patch: decision.editedPatch }
          : item;
      });
    const decisionCounts = decisions.reduce((counts, item) => {
      if (item.decision in counts) counts[item.decision] += 1;
      return counts;
    }, { pending: 0, accepted: 0, rejected: 0 });
    const projected = projectGraph(graph, applicableChanges);
    const definition = getModuleDefinition(moduleType);
    if (!definition) throw reviewError("MODULE_NOT_FOUND", "模块不存在", 404);
    const data = definition.loader(projected.graph);
    return {
      projectId,
      layer: "preview",
      version: `${graph.versionLabel} (预览)`,
      template: { id: graph.template.id, version: graph.template.version },
      module: { type: moduleType, enabled: true },
      data,
      changeMarkers: {
        added: [...projected.changedIds.added],
        modified: [...projected.changedIds.modified],
        removed: [...projected.changedIds.removed]
      },
      capabilities: {
        edit: access.review && proposal.status === "pending"
      },
      editableChanges: applicableChanges.map(change => ({
        changeId: change.changeId,
        module: change.module,
        operation: change.operation,
        targetId: change.targetId,
        patch: change.patch,
        original: originalValue(graph, change),
        decision: byId.get(change.changeId)?.decision ?? "pending"
      })),
      pendingCount: decisionCounts.pending,
      acceptedCount: decisionCounts.accepted,
      rejectedCount: decisionCounts.rejected
    };
  }

  return Object.freeze({getReview,setDecision,updatePreviewItem,acceptModule,merge,previewModule,permission});
}
