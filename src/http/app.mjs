import { fileURLToPath } from "node:url";
import { createAuthService, GENERIC_LOGIN_ERROR } from "../services/auth-service.mjs";
import { createProjectService, ProjectServiceError } from "../services/project-service.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { clearSessionCookie, sessionCookie, sessionTokenFromRequest } from "../security/sessions.mjs";
import { createStaticHandler, securityHeaders } from "./static.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const defaultPublicDirectory = fileURLToPath(new URL("../../public", import.meta.url));

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function respond(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(body));
}

function pathSegments(pathname) {
  try {
    return pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new HttpError(400, "INVALID_PATH", "请求路径无效");
  }
}

async function readJson(request, maxBytes = 64 * 1024) {
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > maxBytes) throw new HttpError(413, "BODY_TOO_LARGE", "请求内容过大");
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "BODY_TOO_LARGE", "请求内容过大");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "INVALID_JSON", "JSON 请求格式无效");
  }
}

function remoteAddress(request) {
  return String(request.socket.remoteAddress ?? "unknown");
}

function sessionPayload(principal) {
  return {
    user: {
      id: principal.id,
      displayName: principal.displayName,
      loginName: principal.loginName,
      isPlatformAdmin: principal.isPlatformAdmin
    },
    csrfToken: principal.csrfToken
  };
}

export function createApp(options) {
  const { database } = options;
  const auth = options.authService ?? createAuthService(database, options.authOptions);
  const projects = createProjectRepository(database);
  const projectService = options.projectService ?? createProjectService(database, options.projectOptions);
  const handleStatic = createStaticHandler(options.publicDirectory ?? defaultPublicDirectory);
  const secureCookies = options.secureCookies ?? false;
  const now = options.now ?? (() => Date.now());
  const compatibilityProjectId = options.compatibilityProjectId ?? "xugu-agentic-group";
  const loginLimit = options.loginLimit ?? 5;
  const loginWindowMs = options.loginWindowMs ?? 15 * 60 * 1_000;
  const loginAttempts = new Map();

  function enforceLoginRate(request) {
    const key = remoteAddress(request);
    const instant = now();
    const attempts = (loginAttempts.get(key) ?? []).filter(value => instant - value < loginWindowMs);
    if (attempts.length >= loginLimit) throw new HttpError(429, "LOGIN_RATE_LIMITED", "登录尝试过于频繁，请稍后再试");
    attempts.push(instant);
    loginAttempts.set(key, attempts);
  }

  function resolvePrincipal(request) {
    return auth.resolveSession(sessionTokenFromRequest(request));
  }

  function requirePrincipal(request) {
    const principal = resolvePrincipal(request);
    if (!principal) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "请先登录");
    return principal;
  }

  function requireCsrf(request, principal) {
    if (!auth.verifyCsrf(principal, request.headers["x-csrf-token"])) {
      throw new HttpError(403, "CSRF_INVALID", "请求安全校验失败");
    }
  }

  function projectRead(request, response, projectId, layer) {
    if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    const principal = requirePrincipal(request);
    const project = projects.getAuthorizedProject(principal, projectId, layer);
    if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    const snapshot = projects.getSnapshot(projectId, layer === "draft" ? "draft" : "published");
    if (!snapshot) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
    projects.recordRecentAccess(principal.id, projectId, new Date(now()).toISOString());
    return respond(response, 200, { project, snapshot });
  }

  return async function handleRequest(request, response) {
    try {
      const url = new URL(request.url, "http://platform.local");
      const segments = pathSegments(url.pathname);

      if (request.method === "GET" && url.pathname === "/health") {
        return respond(response, 200, { status: "ok" });
      }

      if (request.method === "POST" && url.pathname === "/api/login") {
        enforceLoginRate(request);
        const body = await readJson(request);
        const result = auth.authenticate({
          loginName: body.loginName,
          password: body.password,
          remoteAddress: remoteAddress(request)
        });
        if (!result.ok) throw new HttpError(401, "LOGIN_FAILED", GENERIC_LOGIN_ERROR);
        return respond(response, 200, sessionPayload(result.principal), {
          "set-cookie": sessionCookie(result.sessionToken, { secure: secureCookies })
        });
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        return respond(response, 200, sessionPayload(requirePrincipal(request)));
      }

      if (request.method === "POST" && url.pathname === "/api/logout") {
        const principal = requirePrincipal(request);
        requireCsrf(request, principal);
        auth.logout(sessionTokenFromRequest(request), { remoteAddress: remoteAddress(request) });
        return respond(response, 200, { ok: true }, {
          "set-cookie": clearSessionCookie({ secure: secureCookies })
        });
      }

      if (request.method === "GET" && url.pathname === "/api/projects") {
        const principal = requirePrincipal(request);
        return respond(response, 200, projects.listAuthorizedProjects(principal, {
          q: url.searchParams.get("q") ?? "",
          status: url.searchParams.get("status") ?? "active",
          sort: url.searchParams.get("sort") ?? "recent"
        }));
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        const principal = requirePrincipal(request);
        requireCsrf(request, principal);
        const project = projectService.createProject(principal, await readJson(request));
        return respond(response, 201, { project });
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 4 && request.method === "GET") {
        const [, , projectId, layer] = segments;
        if (layer !== "public" && layer !== "draft") throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
        return projectRead(request, response, projectId, layer);
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 3 && request.method === "PATCH") {
        const principal = requirePrincipal(request);
        requireCsrf(request, principal);
        const project = projectService.editProject(principal, segments[2], await readJson(request));
        return respond(response, 200, { project });
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 4 && request.method === "POST" && ["archive", "restore"].includes(segments[3])) {
        const principal = requirePrincipal(request);
        requireCsrf(request, principal);
        const project = segments[3] === "archive"
          ? projectService.archiveProject(principal, segments[2])
          : projectService.restoreProject(principal, segments[2]);
        return respond(response, 200, { project });
      }

      if (request.method === "GET" && url.pathname === "/api/public") {
        const principal = requirePrincipal(request);
        const project = projects.getAuthorizedProject(principal, compatibilityProjectId, "public");
        if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const snapshot = projects.getSnapshot(compatibilityProjectId, "published");
        projects.recordRecentAccess(principal.id, compatibilityProjectId, new Date(now()).toISOString());
        return respond(response, 200, snapshot);
      }

      if (url.pathname.startsWith("/api/")) throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      if (await handleStatic(request, response, url)) return;
      throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
    } catch (error) {
      const known = error instanceof HttpError || error instanceof ProjectServiceError;
      if (!known) console.error("Request failed", error);
      return respond(response, known ? error.status : 500, {
        error: known ? error.message : "服务器处理请求时发生错误",
        code: known ? error.code : "INTERNAL_ERROR"
      });
    }
  };
}
