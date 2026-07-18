import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthRepository } from "../src/repositories/auth-repository.mjs";
import { hashPassword } from "../src/security/passwords.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";
import { createFakeProvider } from "../src/ai/providers/fake-provider.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const password = "material-api-password";

function addUser(db, id, login, role, projectIds = []) {
  const at="2026-07-18T00:00:00.000Z"; createAuthRepository(db).insertUser({id,displayName:login,loginName:login,...hashPassword(password),createdAt:at,updatedAt:at});
  for(const projectId of projectIds) db.prepare("INSERT INTO project_members (project_id,user_id,role,created_at) VALUES (?,?,?,?)").run(projectId,id,role,at);
}

async function setup() {
  const directory=mkdtempSync(join(tmpdir(),"material-api-")); const database=openDatabase(join(directory,"db.sqlite")); applyMigrations(database);
  importLegacyProject(database,fixture,{projectId:"xugu-agentic-group",now:"2026-07-18T00:00:00.000Z"});
  importLegacyProject(database,fixture,{projectId:"other-project",name:"Other",now:"2026-07-18T00:00:00.000Z"});
  const authService=createAuthService(database); authService.ensureBootstrapAdmin({loginName:"admin",password,displayName:"Admin"});
  addUser(database,"viewer","viewer","viewer",["xugu-agentic-group"]); addUser(database,"editor","editor","project_editor",["xugu-agentic-group"]); addUser(database,"padmin","project-admin","project_admin",["xugu-agentic-group"]); addUser(database,"outsider","outsider","viewer",[]);
  const provider=createFakeProvider(request=>{const payload=JSON.parse(request.messages[1].content);const evidenceId=payload.untrusted_evidence[0].evidenceId;return {content:JSON.stringify({schemaVersion:"project-answer-v1",answer:"人工证据已归档。",citations:[{evidenceId,claim:"人工证据"}],caveat:"",followUps:[]})};});
  const server=createServer(createApp({database,authService,materialOptions:{storageRoot:join(directory,"storage")},chatOptions:{provider}})); await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return {database,provider,baseUrl:`http://127.0.0.1:${server.address().port}`,async close(){await new Promise(resolve=>server.close(resolve));database.close();}};
}

async function api(context,path,options={}) {
  const headers={...(options.headers??{})}; if(options.session)headers.cookie=options.session.cookie;if(options.csrf)headers["x-csrf-token"]=options.csrf;
  let body;if(options.body!==undefined){headers["content-type"]="application/json";body=JSON.stringify(options.body);}else body=options.raw;
  const response=await fetch(`${context.baseUrl}${path}`,{method:options.method??"GET",headers,body}); const text=await response.text();return {response,payload:text?JSON.parse(text):null};
}
async function login(context,name){const result=await api(context,"/api/login",{method:"POST",body:{loginName:name,password}});return {cookie:result.response.headers.get("set-cookie").split(";",1)[0],csrf:result.payload.csrfToken};}

test("capability envelope and ledger are server-authoritative for viewer/editor/admin", async()=>{const c=await setup();try{
  const viewer=await login(c,"viewer"),editor=await login(c,"editor"),admin=await login(c,"project-admin");
  const v=await api(c,"/api/projects/xugu-agentic-group/materials/capabilities",{session:viewer});assert.equal(v.response.status,200);assert.equal(v.payload.capabilities.upload,false);assert.equal(v.payload.limits.maxFileBytes,200*1024*1024);assert.equal(v.payload.updateTemplates.length,6);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/capabilities",{session:editor})).payload.capabilities.upload,true);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/capabilities",{session:admin})).payload.capabilities.manageQa,true);
  const ledger=await api(c,"/api/projects/xugu-agentic-group/materials",{session:viewer});assert.deepEqual(ledger.payload.summary,{count:0,readyCount:0,qaEnabledCount:0});
}finally{await c.close();}});

test("manual intake, update intent, QA grant, evidence and cited chat remain project-scoped and CSRF protected", async()=>{const c=await setup();try{
  const editor=await login(c,"editor"),admin=await login(c,"project-admin"),viewer=await login(c,"viewer");
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/manual",{method:"POST",session:editor,body:{title:"会议纪要",body:"人工证据：里程碑已确认。"}})).response.status,403);
  const created=await api(c,"/api/projects/xugu-agentic-group/materials/manual",{method:"POST",session:editor,csrf:editor.csrf,body:{title:"会议纪要",body:"人工证据：里程碑已确认。",updateTemplateId:"meeting-notes"}});assert.equal(created.response.status,201);const id=created.payload.material.id;assert.equal(created.payload.material.status,"ready");assert.equal(created.payload.material.updateTemplate.id,"meeting-notes");
  const selection=await api(c,`/api/projects/xugu-agentic-group/materials/${id}/update-template`,{method:"PATCH",session:editor,csrf:editor.csrf,body:{id:"progress-report",version:"1.0.0"}});assert.equal(selection.payload.material.updateTemplate.id,"progress-report");
  assert.equal((await api(c,`/api/projects/xugu-agentic-group/materials/${id}/qa`,{method:"PATCH",session:editor,csrf:editor.csrf,body:{enabled:true,audience:"project_members"}})).response.status,404);
  const grant=await api(c,`/api/projects/xugu-agentic-group/materials/${id}/qa`,{method:"PATCH",session:admin,csrf:admin.csrf,body:{enabled:true,audience:"project_members"}});assert.equal(grant.payload.material.qa.enabled,true);
  const list=await api(c,`/api/projects/xugu-agentic-group/materials/${id}/evidence`,{session:viewer});assert.equal(list.payload.items.length,1);const evidenceId=list.payload.items[0].id;
  assert.equal((await api(c,`/api/projects/xugu-agentic-group/materials/${id}/evidence/${evidenceId}`,{session:viewer})).payload.evidence.location.field,"body");
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/evidence/search?q=人工证据",{session:viewer})).payload.items.length,1);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/chat",{method:"POST",session:viewer,body:{question:"人工证据是什么？"}})).response.status,403);
  const chat=await api(c,"/api/projects/xugu-agentic-group/chat",{method:"POST",session:viewer,csrf:viewer.csrf,body:{question:"人工证据是什么？"}});assert.equal(chat.response.status,200);assert.equal(chat.payload.citations[0].evidenceId,evidenceId);assert.equal(c.provider.calls.length,1);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/chat/quota",{session:viewer})).payload.usage.today,1);
  assert.equal(c.database.prepare("SELECT count(*) AS count FROM change_proposals").get().count,0);
}finally{await c.close();}});

test("raw upload applies intake gates and unauthorized roles receive uniform project/object 404s",async()=>{const c=await setup();try{
  const editor=await login(c,"editor"),viewer=await login(c,"viewer"),outsider=await login(c,"outsider");const bytes=Buffer.from("uploaded evidence");
  const upload=await api(c,"/api/projects/xugu-agentic-group/materials/upload",{method:"POST",session:editor,csrf:editor.csrf,raw:bytes,headers:{"content-type":"text/plain","x-file-name":encodeURIComponent("upload.txt")}});assert.equal(upload.response.status,202);const id=upload.payload.material.id;
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/upload",{method:"POST",session:viewer,csrf:viewer.csrf,raw:bytes,headers:{"content-type":"text/plain","x-file-name":"x.txt"}})).response.status,404);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/capabilities",{session:outsider})).response.status,404);
  assert.equal((await api(c,`/api/projects/other-project/materials/${id}`,{session:editor})).response.status,404);
  assert.equal((await api(c,"/api/projects/xugu-agentic-group/materials/upload",{method:"POST",session:editor,csrf:editor.csrf,raw:Buffer.from("fake"),headers:{"content-type":"application/pdf","x-file-name":"fake.pdf"}})).payload.code,"magic_mismatch");
}finally{await c.close();}});

test("retry is state-gated, object-scoped and bounded JSON bodies fail before service mutation",async()=>{const c=await setup();try{
  const editor=await login(c,"editor");const created=await api(c,"/api/projects/xugu-agentic-group/materials/manual",{method:"POST",session:editor,csrf:editor.csrf,body:{title:"Retry",body:"retry evidence"}});const id=created.payload.material.id;
  assert.equal((await api(c,`/api/projects/xugu-agentic-group/materials/${id}/retry`,{method:"POST",session:editor,csrf:editor.csrf})).response.status,409);
  c.database.prepare("UPDATE project_materials SET status='failed' WHERE project_id='xugu-agentic-group' AND id=?").run(id);
  assert.equal((await api(c,`/api/projects/xugu-agentic-group/materials/${id}/retry`,{method:"POST",session:editor,csrf:editor.csrf})).response.status,202);
  const oversized=await api(c,"/api/projects/xugu-agentic-group/chat",{method:"POST",session:editor,csrf:editor.csrf,body:{question:"x".repeat(9000)}});assert.equal(oversized.response.status,413);
}finally{await c.close();}});
