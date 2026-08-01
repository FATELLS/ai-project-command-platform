import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "platform_session";
// 空闲超时：用户要求会话不要因短暂离开而过期，调到 4 小时。
const DEFAULT_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1_000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1_000;

export function hashSessionToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function createSessionSecrets() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashSessionToken(token),
    csrfToken: randomBytes(32).toString("base64url")
  };
}

export function parseCookies(header = "") {
  const result = new Map();
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !result.has(name)) result.set(name, value);
  }
  return result;
}

export function sessionTokenFromRequest(request) {
  return parseCookies(request.headers.cookie).get(SESSION_COOKIE_NAME) ?? "";
}

export function sessionCookie(token, options = {}) {
  const secure = options.secure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function clearSessionCookie(options = {}) {
  const secure = options.secure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

export function sessionTimes(now = Date.now(), options = {}) {
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const absoluteTimeoutMs = options.absoluteTimeoutMs ?? DEFAULT_ABSOLUTE_TIMEOUT_MS;
  return {
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    idleExpiresAt: new Date(now + idleTimeoutMs).toISOString(),
    absoluteExpiresAt: new Date(now + absoluteTimeoutMs).toISOString()
  };
}

export function isSessionExpired(session, now = Date.now()) {
  const instant = new Date(now).toISOString();
  return session.idleExpiresAt <= instant || session.absoluteExpiresAt <= instant;
}

export function tokensEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && timingSafeEqual(leftBuffer, rightBuffer);
}
