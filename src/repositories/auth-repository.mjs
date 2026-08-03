export function createAuthRepository(database) {
  // 官方驱动返回大写列名；适配层会恢复查询中的业务别名。
  const findUserByLoginStatement = database.prepare(`
  SELECT id, display_name AS displayName, status, login_name AS loginName,
         password_salt AS passwordSalt, password_hash AS passwordHash,
         password_params_json AS passwordParamsJson,
         is_platform_admin AS isPlatformAdmin,
         must_reset_password AS mustResetPassword
   FROM users WHERE login_name = ?
 `);
 const findSessionStatement = database.prepare(`
   SELECT s.id, s.token_hash AS tokenHash, s.user_id AS userId, s.csrf_token AS csrfToken,
          s.created_at AS createdAt, s.last_seen_at AS lastSeenAt,
          s.idle_expires_at AS idleExpiresAt, s.absolute_expires_at AS absoluteExpiresAt,
          u.display_name AS displayName, u.login_name AS loginName, u.status,
          u.is_platform_admin AS isPlatformAdmin,
          u.must_reset_password AS mustResetPassword
   FROM sessions s JOIN users u ON u.id = s.user_id
   WHERE s.token_hash = ?
 `);

  function mapUser(row) {
    if (!row) return row;
    return {
      id: row.id,
      displayName: row.displayName ?? row.displayname,
      status: row.status,
      loginName: row.loginName ?? row.loginname,
      passwordSalt: row.passwordSalt ?? row.passwordsalt,
      passwordHash: row.passwordHash ?? row.passwordhash,
      passwordParamsJson: row.passwordParamsJson ?? row.passwordparamsjson,
      isPlatformAdmin: row.isPlatformAdmin ?? row.isplatformadmin,
      mustResetPassword: row.mustResetPassword ?? row.mustresetpassword
    };
  }

  function mapSession(row) {
    if (!row) return row;
    return {
      id: row.id,
      tokenHash: row.tokenHash ?? row.tokenhash,
      userId: row.userId ?? row.userid,
      csrfToken: row.csrfToken ?? row.csrftoken,
      createdAt: row.createdAt ?? row.createdat,
      lastSeenAt: row.lastSeenAt ?? row.lastseenat,
      idleExpiresAt: row.idleExpiresAt ?? row.idleexpiresat,
      absoluteExpiresAt: row.absoluteExpiresAt ?? row.absoluteexpiresat,
      displayName: row.displayName ?? row.displayname,
      loginName: row.loginName ?? row.loginname,
      status: row.status,
      isPlatformAdmin: row.isPlatformAdmin ?? row.isplatformadmin,
      mustResetPassword: row.mustResetPassword ?? row.mustresetpassword
    };
  }

  function countPlatformAdmins() {
    const row = database.prepare("SELECT count(*) AS count FROM users WHERE is_platform_admin = 1").get();
    return Number(row?.count ?? row?.COUNT ?? 0);
  }

 function insertUser(user) {
  database.prepare(`
    INSERT INTO users (
      id, display_name, status, created_at, updated_at, login_name,
      password_salt, password_hash, password_params_json, is_platform_admin, must_reset_password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id, user.displayName, user.status ?? "active", user.createdAt, user.updatedAt,
    user.loginName, user.passwordSalt, user.passwordHash, user.passwordParamsJson,
    user.isPlatformAdmin ? 1 : 0,
    user.mustResetPassword ? 1 : 0
  );
 }

  function findUserByLogin(loginName) {
    return mapUser(findUserByLoginStatement.get(loginName));
  }

 function setUserStatus(userId, status, updatedAt) {
   database.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, userId);
 }
  function updatePassword(userId, passwordRecord, updatedAt) {
    database.prepare(`
      UPDATE users SET password_salt = ?, password_hash = ?, password_params_json = ?, must_reset_password = 0, updated_at = ? WHERE id = ?
    `).run(passwordRecord.passwordSalt, passwordRecord.passwordHash, passwordRecord.passwordParamsJson, updatedAt, userId);
  }

  function insertSession(session) {
    database.prepare(`
      INSERT INTO sessions (
        id, token_hash, user_id, csrf_token, created_at, last_seen_at, idle_expires_at, absolute_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id, session.tokenHash, session.userId, session.csrfToken,
      session.createdAt, session.lastSeenAt, session.idleExpiresAt, session.absoluteExpiresAt
    );
  }

  function findSessionByTokenHash(tokenHash) {
    return mapSession(findSessionStatement.get(tokenHash));
  }

  function touchSession(sessionId, lastSeenAt, idleExpiresAt) {
    database.prepare("UPDATE sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?")
      .run(lastSeenAt, idleExpiresAt, sessionId);
  }

  function deleteSessionByTokenHash(tokenHash) {
    const exists = database.prepare("SELECT 1 FROM sessions WHERE token_hash = ?").get(tokenHash);
    if (!exists) return 0;
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return 1;
  }

  function insertAudit(event) {
    database.prepare(`
      INSERT INTO audit_events (
        user_id, project_id, action, target_type, target_id, remote_address, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.userId ?? null, event.projectId ?? null, event.action, event.targetType,
      event.targetId ?? null, event.remoteAddress ?? "", JSON.stringify(event.metadata ?? {}), event.createdAt
    );
  }

  function listAudit() {
    return database.prepare(`
      SELECT user_id AS userId, project_id AS projectId, action, target_type AS targetType,
             target_id AS targetId, remote_address AS remoteAddress, metadata_json AS metadataJson,
             created_at AS createdAt
      FROM audit_events ORDER BY id
    `).all().map(row => ({
      userId: row.userId ?? row.userid,
      projectId: row.projectId ?? row.projectid,
      action: row.action,
      targetType: row.targetType ?? row.targettype,
      targetId: row.targetId ?? row.targetid,
      remoteAddress: row.remoteAddress ?? row.remoteaddress,
      metadataJson: row.metadataJson ?? row.metadatajson,
      createdAt: row.createdAt ?? row.createdat
    }));
  }

 return {
   countPlatformAdmins,
    insertUser,
    findUserByLogin,
    setUserStatus,
    updatePassword,
    insertSession,
   findSessionByTokenHash,
   touchSession,
   deleteSessionByTokenHash,
   insertAudit,
   listAudit
 };
}
