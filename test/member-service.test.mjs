import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";
import { createMemberService, MemberServiceError } from "../src/services/member-service.mjs";

const fixture=JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json",import.meta.url),"utf8"));
const at="2026-07-18T00:00:00.000Z";

function setup(){
  const database=openDatabase(":memory:");applyMigrations(database);importLegacyProject(database,fixture,{projectId:"xugu-agentic-group",now:at});
  const auth=createAuthService(database,{now:()=>Date.parse(at)});auth.ensureBootstrapAdmin({loginName:"admin",password:"member-service-password",displayName:"Admin"});
  const adminRow=database.prepare("SELECT id FROM users WHERE login_name='admin'").get(),admin={id:adminRow.id,isPlatformAdmin:true};
  return{database,admin,service:createMemberService(database,{now:()=>Date.parse(at)})};
}

test("platform user and project membership lifecycle is validated and audited",()=>{
  const c=setup();try{
    const created=c.service.createUser(c.admin,{loginName:"editor.one",displayName:"Editor One",password:"editor-one-secure-password"}).user;
    assert.equal(c.service.listUsers(c.admin).items.some(item=>item.id===created.id),true);
    assert.deepEqual(c.service.setMember(c.admin,"xugu-agentic-group",created.id,{role:"project_editor"}),{userId:created.id,role:"project_editor"});
    assert.equal(c.service.listMembers(c.admin,"xugu-agentic-group").items.find(item=>item.userId===created.id).role,"project_editor");
    assert.equal(c.service.removeMember(c.admin,"xugu-agentic-group",created.id).removed,true);
    c.service.setUserStatus(c.admin,created.id,{status:"disabled"});
    assert.equal(c.service.listUsers(c.admin).items.find(item=>item.id===created.id).status,"disabled");
    const actions=c.database.prepare("SELECT action FROM audit_events ORDER BY id").all().map(item=>item.action);
    for(const action of ["user.created","project.member_added","project.member_removed","user.status_changed"])assert.ok(actions.includes(action));
  }finally{c.database.close();}
});

test("project admins are isolated and cannot grant admin or remove the last admin",()=>{
  const c=setup();try{
    const first=c.service.createUser(c.admin,{loginName:"project.admin",displayName:"Project Admin",password:"project-admin-password"}).user;
    const second=c.service.createUser(c.admin,{loginName:"project.viewer",displayName:"Project Viewer",password:"project-viewer-password"}).user;
    c.service.setMember(c.admin,"xugu-agentic-group",first.id,{role:"project_admin"});
    const projectAdmin={id:first.id,isPlatformAdmin:false};
    c.service.setMember(projectAdmin,"xugu-agentic-group",second.id,{role:"viewer"});
    assert.throws(()=>c.service.setMember(projectAdmin,"xugu-agentic-group",second.id,{role:"project_admin"}),error=>error instanceof MemberServiceError&&error.code==="PLATFORM_ADMIN_REQUIRED");
    assert.throws(()=>c.service.listMembers(projectAdmin,"missing-project"),error=>error.code==="PROJECT_NOT_FOUND");
    c.service.setMember(c.admin,"xugu-agentic-group",second.id,{role:"project_admin"});
    c.service.removeMember(c.admin,"xugu-agentic-group",first.id);
    assert.throws(()=>c.service.removeMember(c.admin,"xugu-agentic-group",second.id),error=>error.code==="LAST_PROJECT_ADMIN");
  }finally{c.database.close();}
});

test("non-admins cannot enumerate the platform user directory",()=>{
  const c=setup();try{assert.throws(()=>c.service.listUsers({id:"outsider",isPlatformAdmin:false}),error=>error.code==="PLATFORM_ADMIN_REQUIRED");}finally{c.database.close();}
});
