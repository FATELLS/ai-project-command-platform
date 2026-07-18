import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { createAuthRepository } from "../repositories/auth-repository.mjs";
import {
  DUMMY_PASSWORD_RECORD,
  hashPassword,
  normalizeLoginName,
  validatePassword,
  verifyPassword
} from "../security/passwords.mjs";
import {
  createSessionSecrets,
  hashSessionToken,
  isSessionExpired,
  sessionTimes,
  tokensEqual
} from "../security/sessions.mjs";

export const GENERIC_LOGIN_ERROR = "账号或密码不正确";

function principalFromSession(session) {
  return {
    id: session.userId,
    displayName: session.displayName,
    loginName: session.loginName,
    isPlatformAdmin: Boolean(session.isPlatformAdmin),
    csrfToken: session.csrfToken
  };
}

export function createAuthService(database, options = {}) {
  const repository = createAuthRepository(database);
  const now = options.now ?? (() => Date.now());
  const idleTimeoutMs = options.idleTimeoutMs;
  const absoluteTimeoutMs = options.absoluteTimeoutMs;

  function timestamp() {
    return new Date(now()).toISOString();
  }

  function audit(event) {
    repository.insertAudit({ ...event, createdAt: event.createdAt ?? timestamp() });
  }

  function ensureBootstrapAdmin(input) {
    if (repository.countPlatformAdmins() > 0) return { created: false };
    const loginName = normalizeLoginName(input.loginName ?? "admin");
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(loginName)) throw new Error("初始管理员账号格式无效");
    const password = validatePassword(input.password);
    return withTransaction(database, () => {
      if (repository.countPlatformAdmins() > 0) return { created: false };
      const createdAt = timestamp();
      const passwordRecord = hashPassword(password);
      const userId = `usr_${randomUUID()}`;
      repository.insertUser({
        id: userId,
        displayName: String(input.displayName ?? "平台管理员").trim() || "平台管理员",
        loginName,
        ...passwordRecord,
        isPlatformAdmin: true,
        createdAt,
        updatedAt: createdAt
      });
      audit({ userId, action: "auth.bootstrap", targetType: "user", targetId: userId });
      return { created: true, userId, loginName };
    });
  }

  function authenticate(input) {
    const loginName = normalizeLoginName(input.loginName);
    const user = repository.findUserByLogin(loginName);
    const verified = verifyPassword(input.password, user ?? DUMMY_PASSWORD_RECORD);
    if (!user || user.status !== "active" || !verified) {
      audit({
        userId: user?.id,
        action: "auth.login_failed",
        targetType: "session",
        remoteAddress: input.remoteAddress,
        metadata: { loginName }
      });
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    const secrets = createSessionSecrets();
    const times = sessionTimes(now(), { idleTimeoutMs, absoluteTimeoutMs });
    const sessionId = `ses_${randomUUID()}`;
    withTransaction(database, () => {
      repository.insertSession({ id: sessionId, userId: user.id, ...secrets, ...times });
      audit({
        userId: user.id,
        action: "auth.login_succeeded",
        targetType: "session",
        targetId: sessionId,
        remoteAddress: input.remoteAddress
      });
    });
    return {
      ok: true,
      sessionToken: secrets.token,
      principal: {
        id: user.id,
        displayName: user.displayName,
        loginName: user.loginName,
        isPlatformAdmin: Boolean(user.isPlatformAdmin),
        csrfToken: secrets.csrfToken
      }
    };
  }

  function resolveSession(rawToken) {
    if (!rawToken) return undefined;
    const tokenHash = hashSessionToken(rawToken);
    const session = repository.findSessionByTokenHash(tokenHash);
    if (!session || session.status !== "active") return undefined;
    if (isSessionExpired(session, now())) {
      repository.deleteSessionByTokenHash(tokenHash);
      return undefined;
    }
    const times = sessionTimes(now(), { idleTimeoutMs, absoluteTimeoutMs });
    const idleExpiresAt = times.idleExpiresAt < session.absoluteExpiresAt
      ? times.idleExpiresAt
      : session.absoluteExpiresAt;
    repository.touchSession(session.id, times.lastSeenAt, idleExpiresAt);
    return { ...principalFromSession(session), sessionId: session.id, tokenHash };
  }

  function verifyCsrf(session, csrfToken) {
    return Boolean(session && tokensEqual(session.csrfToken, csrfToken));
  }

  function logout(rawToken, input = {}) {
    if (!rawToken) return false;
    const tokenHash = hashSessionToken(rawToken);
    const session = repository.findSessionByTokenHash(tokenHash);
    const deleted = withTransaction(database, () => {
      const removed = repository.deleteSessionByTokenHash(tokenHash) > 0;
      if (removed && session) {
        audit({
          userId: session.userId,
          action: "auth.logout",
          targetType: "session",
          targetId: session.id,
          remoteAddress: input.remoteAddress
        });
      }
      return removed;
    });
    return deleted;
  }

  return { ensureBootstrapAdmin, authenticate, resolveSession, verifyCsrf, logout, repository };
}
