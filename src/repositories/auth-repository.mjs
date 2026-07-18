export function createAuthRepository(database) {
  const findUserByLoginStatement = database.prepare(`
    SELECT id, display_name AS displayName, status, login_name AS loginName,
           password_salt AS passwordSalt, password_hash AS passwordHash,
           password_params_json AS passwordParamsJson,
           is_platform_admin AS isPlatformAdmin
    FROM users WHERE login_name = ?
  `);
  const findSessionStatement = database.prepare(`
    SELECT s.id, s.token_hash AS tokenHash, s.user_id AS userId, s.csrf_token AS csrfToken,
           s.created_at AS createdAt, s.last_seen_at AS lastSeenAt,
           s.idle_expires_at AS idleExpiresAt, s.absolute_expires_at AS absoluteExpiresAt,
           u.display_name AS displayName, u.login_name AS loginName, u.status,
           u.is_platform_admin AS isPlatformAdmin
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `);

  function countPlatformAdmins() {
    return database.prepare("SELECT count(*) AS count FROM users WHERE is_platform_admin = 1").get().count;
  }

  function insertUser(user) {
    database.prepare(`
      INSERT INTO users (
        id, display_name, status, created_at, updated_at, login_name,
        password_salt, password_hash, password_params_json, is_platform_admin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id, user.displayName, user.status ?? "active", user.createdAt, user.updatedAt,
      user.loginName, user.passwordSalt, user.passwordHash, user.passwordParamsJson,
      user.isPlatformAdmin ? 1 : 0
    );
  }

  function findUserByLogin(loginName) {
    return findUserByLoginStatement.get(loginName);
  }

  function setUserStatus(userId, status, updatedAt) {
    database.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, userId);
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
    return findSessionStatement.get(tokenHash);
  }

  function touchSession(sessionId, lastSeenAt, idleExpiresAt) {
    database.prepare("UPDATE sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?")
      .run(lastSeenAt, idleExpiresAt, sessionId);
  }

  function deleteSessionByTokenHash(tokenHash) {
    return database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash).changes;
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
    `).all();
  }

  return {
    countPlatformAdmins,
    insertUser,
    findUserByLogin,
    setUserStatus,
    insertSession,
    findSessionByTokenHash,
    touchSession,
    deleteSessionByTokenHash,
    insertAudit,
    listAudit
  };
}
