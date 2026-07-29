import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { upsert } from "../db/sql-dialect.mjs";
import { hashPassword, normalizeLoginName, validatePassword } from "../security/passwords.mjs";

const roles = new Set(["project_admin", "project_editor", "viewer"]);

export class MemberServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) { throw new MemberServiceError(status, code, message); }

export function createMemberService(database, options = {}) {
  const now = options.now ?? Date.now;
  const clock = () => new Date(now()).toISOString();

  function access(principal, projectId) {
    if (!principal?.id) fail(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    if (principal.isPlatformAdmin) return { role: "platform_admin", manage: true, platform: true };
    const member = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, principal.id);
    if (!member || member.role !== "project_admin") fail(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    return { role: member.role, manage: true, platform: false };
  }

  function audit(principal, projectId, action, targetId, metadata = {}) {
    database.prepare("INSERT INTO audit_events (user_id,project_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(principal.id, projectId ?? null, action, "user", targetId, JSON.stringify(metadata), clock());
  }

  function listUsers(principal) {
    if (!principal?.isPlatformAdmin) fail(403, "PLATFORM_ADMIN_REQUIRED", "仅平台管理员可查看用户目录");
    return { items: database.prepare(`
      SELECT id,display_name AS displayName,login_name AS loginName,status,
             is_platform_admin AS isPlatformAdmin,created_at AS createdAt,updated_at AS updatedAt
      FROM users ORDER BY display_name COLLATE NOCASE,id
    `).all().map(item => ({ ...item, isPlatformAdmin: Boolean(item.isPlatformAdmin) })) };
  }

  function createUser(principal, input) {
    if (!principal?.isPlatformAdmin) fail(403, "PLATFORM_ADMIN_REQUIRED", "仅平台管理员可创建用户");
    const loginName = normalizeLoginName(input.loginName);
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(loginName)) fail(400, "INVALID_LOGIN_NAME", "账号格式无效");
    const displayName = String(input.displayName ?? "").trim();
    if (!displayName || displayName.length > 80) fail(400, "INVALID_DISPLAY_NAME", "显示名称无效");
    const password = validatePassword(input.password);
    if (database.prepare("SELECT 1 FROM users WHERE login_name=?").get(loginName)) fail(409, "LOGIN_NAME_EXISTS", "账号已存在");
    return withTransaction(database, () => {
      const id = `usr_${randomUUID()}`, at = clock();
      const record = hashPassword(password);
      database.prepare(`INSERT INTO users (id,display_name,status,created_at,updated_at,login_name,password_salt,password_hash,password_params_json,is_platform_admin) VALUES (?,?,?,?,?,?,?,?,?,0)`)
        .run(id, displayName, "active", at, at, loginName, record.passwordSalt, record.passwordHash, record.passwordParamsJson);
      audit(principal, null, "user.created", id, { loginName });
      return { user: { id, displayName, loginName, status: "active", isPlatformAdmin: false, createdAt: at } };
    });
  }

  function setUserStatus(principal, userId, input) {
    if (!principal?.isPlatformAdmin) fail(403, "PLATFORM_ADMIN_REQUIRED", "仅平台管理员可停用用户");
    const status = input.status;
    if (!["active", "disabled"].includes(status)) fail(400, "INVALID_USER_STATUS", "用户状态无效");
    const user = database.prepare("SELECT id,is_platform_admin AS isPlatformAdmin,status FROM users WHERE id=?").get(userId);
    if (!user) fail(404, "USER_NOT_FOUND", "用户不存在");
    if (user.id === principal.id && status === "disabled") fail(409, "SELF_DISABLE_FORBIDDEN", "不能停用当前账号");
    if (user.isPlatformAdmin && status === "disabled") {
      const count = database.prepare("SELECT count(*) AS count FROM users WHERE is_platform_admin=1 AND status='active'").get().count;
      if (count <= 1) fail(409, "LAST_PLATFORM_ADMIN", "不能停用最后一个平台管理员");
    }
    database.prepare("UPDATE users SET status=?,updated_at=? WHERE id=?").run(status, clock(), userId);
    audit(principal, null, "user.status_changed", userId, { from: user.status, to: status });
    return { userId, status };
  }

  function listMembers(principal, projectId) {
    const capability = access(principal, projectId);
    const project = database.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
    if (!project) fail(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    return { items: database.prepare(`
      SELECT u.id AS userId,u.display_name AS displayName,u.login_name AS loginName,u.status,
             m.role,m.created_at AS createdAt
      FROM project_members m JOIN users u ON u.id=m.user_id
      WHERE m.project_id=? ORDER BY CASE m.role WHEN 'project_admin' THEN 1 WHEN 'project_editor' THEN 2 ELSE 3 END,u.display_name
    `).all(projectId), capabilities: { manage: capability.manage, assignProjectAdmin: capability.platform } };
  }

  function setMember(principal, projectId, userId, input) {
    const capability = access(principal, projectId), role = input.role;
    if (!roles.has(role)) fail(400, "INVALID_PROJECT_ROLE", "项目角色无效");
    if (role === "project_admin" && !capability.platform) fail(403, "PLATFORM_ADMIN_REQUIRED", "仅平台管理员可授予项目管理员角色");
    const user = database.prepare("SELECT id,status FROM users WHERE id=?").get(userId);
    if (!user || user.status !== "active") fail(404, "USER_NOT_FOUND", "可用用户不存在");
    return withTransaction(database, () => {
      const prior = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, userId);
      upsert(database, "project_members",
        ["project_id", "user_id", "role", "created_at"],
        [projectId, userId, role, clock()],
        ["project_id", "user_id"],
        ["role"]
      );
      audit(principal, projectId, prior ? "project.member_role_changed" : "project.member_added", userId, { from: prior?.role ?? null, to: role });
      return { userId, role };
    });
  }

  function removeMember(principal, projectId, userId) {
    access(principal, projectId);
    const member = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, userId);
    if (!member) fail(404, "PROJECT_MEMBER_NOT_FOUND", "项目成员不存在");
    if (member.role === "project_admin") {
      const count = database.prepare("SELECT count(*) AS count FROM project_members WHERE project_id=? AND role='project_admin'").get(projectId).count;
      if (count <= 1) fail(409, "LAST_PROJECT_ADMIN", "不能移除最后一个项目管理员");
    }
    database.prepare("DELETE FROM project_members WHERE project_id=? AND user_id=?").run(projectId, userId);
    audit(principal, projectId, "project.member_removed", userId, { role: member.role });
    return { removed: true, userId };
  }

  return Object.freeze({ listUsers, createUser, setUserStatus, listMembers, setMember, removeMember });
}
