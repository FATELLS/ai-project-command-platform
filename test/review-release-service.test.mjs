import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createFakeProvider } from "../src/ai/providers/fake-provider.mjs";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createMaterialService } from "../src/services/material-service.mjs";
import { createProposalService } from "../src/services/proposal-service.mjs";
import { createReviewService } from "../src/review/review-service.mjs";
import { createReleaseService } from "../src/release/release-service.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";
import { applyReviewedChanges } from "../src/review/version-apply.mjs";

const fixture=JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json",import.meta.url),"utf8"));
const at="2026-07-18T00:00:00.000Z",password="review-release-password";

async function setup(){const database=openDatabase(":memory:");applyMigrations(database);importLegacyProject(database,fixture,{projectId:"xugu-agentic-group",now:at});const auth=createAuthService(database);auth.ensureBootstrapAdmin({loginName:"admin",password,displayName:"Admin"});const user=database.prepare("SELECT id FROM users WHERE login_name='admin'").get();const principal={id:user.id,isPlatformAdmin:true,displayName:"Admin"};const provider=createFakeProvider(request=>{const input=JSON.parse(request.messages[1].content),e=input.server_envelope;return{content:JSON.stringify({schemaVersion:e.schemaVersion,projectId:e.projectId,baseVersionId:e.baseVersionId,template:e.template,materialIds:e.materialIds,summary:"新增经审核的数据治理跟进任务。",changes:[{changeId:"change-001",module:"task-network",operation:"create",targetId:"review-task-001",semanticType:"plan",patch:{title:"跟进数据治理",unitId:"rd"},evidenceIds:[input.untrusted_evidence[0].evidenceId],confidence:.82,warnings:[]}],warnings:[]}),usage:{input:20,output:10}};});const materials=createMaterialService(database);const created=await materials.createManual(principal,"xugu-agentic-group",{title:"审核纪要",body:"第一作战单元需要跟进数据治理。",updateTemplateId:"meeting-notes"});materials.setGeneration(principal,"xugu-agentic-group",created.material.id,{enabled:true});const proposalService=createProposalService(database,{provider,now:()=>Date.parse(at),syncProcess:true});const job=(await proposalService.createJob(principal,"xugu-agentic-group",{materialIds:[created.material.id],idempotencyKey:"review-seed-001"})).task;return{database,principal,proposalId:job.proposalId,proposals:proposalService,review:createReviewService(database,{now:()=>Date.parse(at)}),release:createReleaseService(database,{now:()=>Date.parse(at)}),projects:createProjectRepository(database)};}

test("review edit and atomic merge create a new draft without changing published",async()=>{const c=await setup();try{const before=c.projects.getProject("xugu-agentic-group"),detail=c.review.getReview(c.principal,"xugu-agentic-group",c.proposalId);assert.equal(detail.proposal.changes[0].original,null);assert.equal(detail.capabilities.pending,1);const decided=c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted",patch:{title:"跟进数据治理（已审核）",unitId:"rd"},note:"证据充分"});assert.equal(decided.capabilities.merge,true);const merged=c.review.merge(c.principal,"xugu-agentic-group",c.proposalId);const after=c.projects.getProject("xugu-agentic-group");assert.notEqual(after.draftVersionId,before.draftVersionId);assert.equal(after.publishedVersionId,before.publishedVersionId);assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","draft").tasks.some(item=>item.id==="review-task-001"&&item.title.includes("已审核")),true);assert.equal(merged.review.proposal.status,"accepted");assert.equal(c.database.prepare("SELECT count(*) AS count FROM audit_events WHERE action LIKE 'proposal.%'").get().count>=2,true);}finally{c.database.close();}});

test("invalid reviewed fields fail before acceptance and never change draft",async()=>{const c=await setup();try{const before=c.projects.getProject("xugu-agentic-group").draftVersionId;assert.throws(()=>c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted",patch:{title:"非法团队任务",unitId:"missing-unit"}}),error=>error.code==="TASK_UNIT_NOT_FOUND");assert.equal(c.projects.getProject("xugu-agentic-group").draftVersionId,before);assert.equal(c.database.prepare("SELECT decision FROM proposal_review_items WHERE proposal_id=?").get(c.proposalId).decision,"pending");}finally{c.database.close();}});

test("node preview projects pending and edited accepted changes without writing versions",async()=>{const c=await setup();try{
  const before=c.projects.getProject("xugu-agentic-group");
  const pending=c.review.previewModule(c.principal,"xugu-agentic-group",c.proposalId,"roadmap");
  assert.equal(pending.layer,"preview");
  assert.equal(pending.pendingCount,1);
  assert.equal(pending.acceptedCount,0);
  assert.equal(pending.changeMarkers.added.includes("review-task-001"),true);
  assert.equal(pending.data.tasks.some(item=>item.id==="review-task-001"&&item.title==="跟进数据治理"),true);

  c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted",patch:{title:"跟进数据治理（预览修订）",unitId:"rd"}});
  const accepted=c.review.previewModule(c.principal,"xugu-agentic-group",c.proposalId,"roadmap");
  assert.equal(accepted.pendingCount,0);
  assert.equal(accepted.acceptedCount,1);
  assert.equal(accepted.rejectedCount,0);
  assert.equal(accepted.data.tasks.some(item=>item.id==="review-task-001"&&item.title.includes("预览修订")),true);
  assert.deepEqual(c.projects.getProject("xugu-agentic-group"),before);
  assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","published").tasks.some(item=>item.id==="review-task-001"),false);
}finally{c.database.close();}});

test("preview card edit stays pending, recomputes projection and survives acceptance",async()=>{const c=await setup();try{
  const before=c.projects.getProject("xugu-agentic-group");
  const edited=c.review.updatePreviewItem(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{patch:{title:"跟进数据治理（待审核编辑）",unitId:"rd"},note:"在路线图预览中修正标题"});
  assert.equal(edited.proposal.changes[0].review.decision,"pending");
  assert.equal(edited.proposal.changes[0].review.editedPatch.title,"跟进数据治理（待审核编辑）");
  const preview=c.review.previewModule(c.principal,"xugu-agentic-group",c.proposalId,"roadmap");
  assert.equal(preview.capabilities.edit,true);
  assert.equal(preview.editableChanges[0].changeId,"change-001");
  assert.equal(preview.data.tasks.some(item=>item.id==="review-task-001"&&item.title.includes("待审核编辑")),true);
  const accepted=c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted"});
  assert.equal(accepted.proposal.changes[0].review.editedPatch.title,"跟进数据治理（待审核编辑）");
  assert.equal(c.review.previewModule(c.principal,"xugu-agentic-group",c.proposalId,"roadmap").data.tasks.some(item=>item.id==="review-task-001"&&item.title.includes("待审核编辑")),true);
  assert.deepEqual(c.projects.getProject("xugu-agentic-group"),before);
  assert.equal(c.database.prepare("SELECT count(*) AS count FROM audit_events WHERE action='proposal.preview_edited'").get().count,1);
}finally{c.database.close();}});

test("source-free roadmap edit still requires review before changing draft",async()=>{const c=await setup();try{
  const target=c.projects.getModuleVersionGraph("xugu-agentic-group","published").tasks[0];
  const created=c.proposals.createInteractionProposal(c.principal,"xugu-agentic-group",{
    summary:`编辑节点：${target.title}`,
    materialIds:[],
    evidenceIds:[],
    changes:[{changeId:"edit-review-001",module:"task-network",operation:"update",targetId:target.id,semanticType:"plan",patch:{title:`${target.title}（人工修正）`},confidence:1,warnings:[],evidenceIds:[]}]
  });
  assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","draft").tasks.some(item=>item.title.endsWith("（人工修正）")),false);
  c.review.setDecision(c.principal,"xugu-agentic-group",created.proposal.proposalId,"edit-review-001",{decision:"accepted"});
  c.review.merge(c.principal,"xugu-agentic-group",created.proposal.proposalId);
  assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","draft").tasks.some(item=>item.title.endsWith("（人工修正）")),true);
  assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","published").tasks.some(item=>item.title.endsWith("（人工修正）")),false);
}finally{c.database.close();}});

test("rejected node leaves the roadmap preview projection",async()=>{const c=await setup();try{
  c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"rejected",note:"不进入路线图"});
  const preview=c.review.previewModule(c.principal,"xugu-agentic-group",c.proposalId,"roadmap");
  assert.equal(preview.rejectedCount,1);
  assert.equal(preview.pendingCount,0);
  assert.equal(preview.changeMarkers.added.includes("review-task-001"),false);
  assert.equal(preview.data.tasks.some(item=>item.id==="review-task-001"),false);
}finally{c.database.close();}});

test("merge storage failure rolls back cloned version, facts and pointer",async()=>{const c=await setup();try{const before=c.projects.getProject("xugu-agentic-group").draftVersionId,versions=c.database.prepare("SELECT count(*) AS count FROM project_versions").get().count;c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted"});c.database.exec("CREATE TRIGGER phase6_fail_new_task BEFORE INSERT ON project_tasks WHEN NEW.external_id='review-task-001' BEGIN SELECT RAISE(ABORT,'injected merge failure'); END");c.database.exec("CREATE TRIGGER phase6_fail_new_card BEFORE INSERT ON project_cards WHEN NEW.external_id='review-task-001' BEGIN SELECT RAISE(ABORT,'injected merge failure'); END");assert.throws(()=>c.review.merge(c.principal,"xugu-agentic-group",c.proposalId),/injected merge failure/);assert.equal(c.projects.getProject("xugu-agentic-group").draftVersionId,before);assert.equal(c.database.prepare("SELECT count(*) AS count FROM project_versions").get().count,versions);assert.equal(c.database.prepare("SELECT count(*) AS count FROM proposal_merges").get().count,0);}finally{c.database.close();}});

test("publish uses current draft, creates a fresh baseline and rolls back only to direct predecessor",async()=>{const c=await setup();try{const original=c.projects.getProject("xugu-agentic-group").publishedVersionId;c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"accepted"});c.review.merge(c.principal,"xugu-agentic-group",c.proposalId);const preview=c.release.preview(c.principal,"xugu-agentic-group");assert.equal(preview.checklist.hasChanges,true);assert.equal(preview.capabilities.publish,true);const published=c.release.publish(c.principal,"xugu-agentic-group",{previewToken:preview.previewToken,versionLabel:"v4.3",acknowledged:true});const project=c.projects.getProject("xugu-agentic-group");assert.equal(project.publishedVersionId,published.publishedVersionId);assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","published").tasks.some(item=>item.id==="review-task-001"),true);assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","draft").tasks.some(item=>item.id==="review-task-001"),true);assert.throws(()=>c.release.rollback(c.principal,"xugu-agentic-group",{confirmed:true,targetVersionId:999999}),/直接上一|只能回滚/);const rolled=c.release.rollback(c.principal,"xugu-agentic-group",{confirmed:true,targetVersionId:original});assert.equal(rolled.publishedVersionId,original);assert.equal(c.projects.getModuleVersionGraph("xugu-agentic-group","published").tasks.length,29);assert.equal(c.database.prepare("SELECT count(*) AS count FROM publication_events").get().count,2);assert.equal(c.database.prepare("SELECT count(*) AS count FROM audit_events WHERE action IN ('project.published','project.rolled_back')").get().count,2);}finally{c.database.close();}});

test("all rejected closes review and no accepted change can merge",async()=>{const c=await setup();try{const review=c.review.setDecision(c.principal,"xugu-agentic-group",c.proposalId,"change-001",{decision:"rejected",note:"不采用"});assert.equal(review.proposal.status,"rejected");assert.equal(review.capabilities.review,false);assert.throws(()=>c.review.merge(c.principal,"xugu-agentic-group",c.proposalId),/审核已结束/);}finally{c.database.close();}});

test("unified roadmap cards preserve proposal date as the rendered date label",()=>{
  const database=openDatabase(":memory:");
  try{
    applyMigrations(database);
    importLegacyProject(database,fixture,{projectId:"xugu-agentic-group",now:at});
    const projects=createProjectRepository(database);
    const versionId=projects.getProject("xugu-agentic-group").draftVersionId;
    applyReviewedChanges(database,versionId,[{
      module:"roadmap",
      operation:"create",
      targetId:"roadmap-date-regression",
      patch:{title:"带日期路线节点",date:"2026-07-25",state:"planned",description:"验证统一卡片日期映射。"}
    }]);
    const stage=projects.getModuleVersionGraph("xugu-agentic-group","draft").stages.find(item=>item.id==="roadmap-date-regression");
    assert.equal(stage.dateLabel,"2026-07-25");
  }finally{
    database.close();
  }
});
