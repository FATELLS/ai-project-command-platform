import { fileURLToPath } from "node:url";
import { createAuthService, GENERIC_LOGIN_ERROR } from "../services/auth-service.mjs";
import { createProjectService, ProjectServiceError } from "../services/project-service.mjs";
import { createModuleService, ModuleServiceError } from "../modules/module-service.mjs";
import { AiServiceError } from "../ai/errors.mjs";
import { MaterialGateError } from "../materials/policy.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { clearSessionCookie, sessionCookie, sessionTokenFromRequest } from "../security/sessions.mjs";
import { createChatService } from "../services/chat-service.mjs";
import { createMaterialService, MaterialServiceError } from "../services/material-service.mjs";
import { createProposalService, ProposalServiceError } from "../services/proposal-service.mjs";
import { createReviewService, ReviewServiceError } from "../review/review-service.mjs";
import { createReleaseService } from "../release/release-service.mjs";
import { createMemberService, MemberServiceError } from "../services/member-service.mjs";
import { createObservabilityService, createRequestId } from "../operations/observability.mjs";
import { createProductTestService } from "../operations/product-test-service.mjs";
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
  const requestId = response.__requestId;
  response.__finishTrace?.(status);
  response.writeHead(status, {
    ...securityHeaders,
    ...(requestId ? { "x-request-id": requestId } : {}),
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
  const moduleService = options.moduleService ?? createModuleService(database);
  const materialService = options.materialService ?? createMaterialService(database, options.materialOptions);
  const chatService = options.chatService ?? createChatService(database, options.chatOptions);
  const proposalService = options.proposalService ?? createProposalService(database, options.proposalOptions);
  const reviewService = options.reviewService ?? createReviewService(database, options.reviewOptions);
  const releaseService = options.releaseService ?? createReleaseService(database, options.releaseOptions);
  const memberService = options.memberService ?? createMemberService(database, options.memberOptions);
  const observability = options.observabilityService ?? createObservabilityService(database, options.observabilityOptions);
  const productTests = options.productTestService ?? createProductTestService(database, options.productTestOptions);
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

  function requireDiagnosticsAccess(principal, projectId = "") {
    if (principal.isPlatformAdmin) return { role: "platform_admin" };
    if (projectId) {
      const row = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, principal.id);
      if (row?.role === "project_admin") return { role: row.role };
    }
    throw new HttpError(404, "DIAGNOSTICS_NOT_FOUND", "诊断信息不存在或你无权访问");
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
    const requestId = createRequestId(request.headers["x-request-id"]);
    response.__requestId = requestId;
    response.__finishTrace = status => {
      if (response.__traceFinished || !traceId) return;
      response.__traceFinished = true;
      observability.finishTrace(traceId, status >= 500 ? "failed" : "succeeded", { status, durationMs: Math.max(0, now() - traceStartedAt) });
    };
    let principalForError = null;
    let traceId = null;
    const traceStartedAt = now();
    try {
      const url = new URL(request.url, "http://platform.local");
      const segments = pathSegments(url.pathname);
      const tracedProjectId = segments[0] === "api" && segments[1] === "projects" ? segments[2] : null;
      traceId = observability.startTrace({
        requestId,
        projectId: projectIdPattern.test(tracedProjectId ?? "") ? tracedProjectId : null,
        operation: `${request.method} ${url.pathname}`,
        metadata: { query: url.search ? "present" : "empty" }
      });

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

      if (segments[0] === "api" && segments[1] === "users") {
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 2 && request.method === "GET") return respond(response, 200, memberService.listUsers(principal));
        if (segments.length === 2 && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 201, memberService.createUser(principal, await readJson(request, 8 * 1024)));
        }
        if (segments.length === 4 && segments[3] === "status" && request.method === "PATCH") {
          requireCsrf(request, principal);
          return respond(response, 200, memberService.setUserStatus(principal, segments[2], await readJson(request, 4 * 1024)));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "members") {
        const projectId = segments[2], principal = requirePrincipal(request); principalForError = principal;
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        if (segments.length === 4 && request.method === "GET") return respond(response, 200, memberService.listMembers(principal, projectId));
        if (segments.length === 5 && request.method === "PUT") {
          requireCsrf(request, principal);
          return respond(response, 200, memberService.setMember(principal, projectId, segments[4], await readJson(request, 4 * 1024)));
        }
        if (segments.length === 5 && request.method === "DELETE") {
          requireCsrf(request, principal);
          return respond(response, 200, memberService.removeMember(principal, projectId, segments[4]));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        const principal = requirePrincipal(request); principalForError = principal;
        requireCsrf(request, principal);
        const project = projectService.createProject(principal, await readJson(request));
        return respond(response, 201, { project });
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "materials") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 4 && request.method === "GET") return respond(response, 200, materialService.list(principal, projectId));
        if (segments.length === 5 && segments[4] === "capabilities" && request.method === "GET") return respond(response, 200, materialService.capabilities(principal, projectId));
        if (segments.length === 5 && segments[4] === "manual" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 201, await materialService.createManual(principal, projectId, await readJson(request, 32 * 1024)));
        }
        if (segments.length === 5 && segments[4] === "upload" && request.method === "POST") {
          requireCsrf(request, principal);
          let filename;
          try { filename = decodeURIComponent(String(request.headers["x-file-name"] ?? "")); }
          catch { throw new HttpError(400, "INVALID_FILENAME", "文件名无效"); }
          if (!filename) throw new HttpError(400, "INVALID_FILENAME", "文件名无效");
          const receipt = await materialService.upload(principal, projectId, {
            filename,
            mime: request.headers["content-type"],
            contentLength: Number(request.headers["content-length"] ?? NaN),
            source: request
          });
          return respond(response, 202, { material: receipt });
        }
        if (segments.length === 6 && segments[4] === "evidence" && segments[5] === "search" && request.method === "GET") {
          return respond(response, 200, materialService.searchEvidence(principal, projectId, url.searchParams.get("q") ?? ""));
        }
        const materialId = segments[4];
        if (segments.length === 5 && request.method === "GET") return respond(response, 200, materialService.detail(principal, projectId, materialId));
        if (segments.length === 6 && segments[5] === "update-template" && request.method === "PATCH") {
          requireCsrf(request, principal);
          return respond(response, 200, materialService.setUpdateTemplate(principal, projectId, materialId, await readJson(request, 8 * 1024)));
        }
        if (segments.length === 6 && segments[5] === "qa" && request.method === "PATCH") {
          requireCsrf(request, principal);
          return respond(response, 200, materialService.setQa(principal, projectId, materialId, await readJson(request, 8 * 1024)));
        }
        if (segments.length === 6 && segments[5] === "generation" && request.method === "PATCH") {
          requireCsrf(request, principal);
          return respond(response, 200, materialService.setGeneration(principal, projectId, materialId, await readJson(request, 8 * 1024)));
        }
        if (segments.length === 6 && segments[5] === "retry" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 202, materialService.retry(principal, projectId, materialId));
        }
        if (segments.length === 6 && segments[5] === "evidence" && request.method === "GET") return respond(response, 200, materialService.listEvidence(principal, projectId, materialId));
        if (segments.length === 7 && segments[5] === "evidence" && request.method === "GET") return respond(response, 200, materialService.getEvidence(principal, projectId, materialId, segments[6]));
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "generation-tasks") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 5 && segments[4] === "capabilities" && request.method === "GET") return respond(response, 200, proposalService.capabilities(principal, projectId));
        if (segments.length === 4 && request.method === "GET") return respond(response, 200, proposalService.listJobs(principal, projectId));
        if (segments.length === 4 && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 202, await proposalService.createJob(principal, projectId, await readJson(request, 16 * 1024)));
        }
        const jobId = segments[4];
        if (segments.length === 5 && request.method === "GET") return respond(response, 200, proposalService.getJob(principal, projectId, jobId));
        if (segments.length === 6 && segments[5] === "retry" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 202, await proposalService.retryJob(principal, projectId, jobId, await readJson(request, 8 * 1024)));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "change-proposals") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 4 && request.method === "GET") return respond(response, 200, proposalService.listProposals(principal, projectId));
        if (segments.length === 5 && request.method === "GET") return respond(response, 200, proposalService.getProposal(principal, projectId, segments[4]));
        if (segments.length === 6 && segments[5] === "review" && request.method === "GET") return respond(response, 200, reviewService.getReview(principal, projectId, segments[4]));
        if (segments.length === 7 && segments[5] === "review" && request.method === "PATCH") {
          requireCsrf(request, principal);
          return respond(response, 200, reviewService.setDecision(principal, projectId, segments[4], segments[6], await readJson(request, 16 * 1024)));
        }
        if (segments.length === 8 && segments[5] === "review" && segments[6] === "modules" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 200, reviewService.acceptModule(principal, projectId, segments[4], segments[7]));
        }
        if (segments.length === 6 && segments[5] === "merge" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 200, reviewService.merge(principal, projectId, segments[4]));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "release") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 5 && segments[4] === "preview" && request.method === "GET") return respond(response, 200, releaseService.preview(principal, projectId));
        if (segments.length === 5 && segments[4] === "history" && request.method === "GET") return respond(response, 200, releaseService.history(principal, projectId));
        if (segments.length === 5 && segments[4] === "audit" && request.method === "GET") return respond(response, 200, releaseService.auditLog(principal, projectId, url.searchParams.get("limit")));
        if (segments.length === 5 && segments[4] === "publish" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 200, releaseService.publish(principal, projectId, await readJson(request, 8 * 1024)));
        }
        if (segments.length === 5 && segments[4] === "rollback" && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 200, releaseService.rollback(principal, projectId, await readJson(request, 8 * 1024)));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "chat") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        if (segments.length === 5 && segments[4] === "quota" && request.method === "GET") {
          const envelope = materialService.capabilities(principal, projectId);
          return respond(response, 200, { limits: { perMinute: envelope.limits.maxChatPerMinute, perDay: envelope.limits.maxChatPerDay }, usage: { today: envelope.usage.chatToday, remainingToday: envelope.usage.chatRemainingToday } });
        }
        if (segments.length === 4 && request.method === "POST") {
          requireCsrf(request, principal);
          const body = await readJson(request, 8 * 1024);
          return respond(response, 200, await chatService.answer(principal, { projectId, question: body.question }));
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[4] === "modules" &&
          segments.length === 5 && request.method === "GET") {
        const [, , projectId, layer] = segments;
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        if (layer !== "public" && layer !== "draft") throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
        const principal = requirePrincipal(request); principalForError = principal;
        const payload = moduleService.listModules(principal, projectId, layer);
        projects.recordRecentAccess(principal.id, projectId, new Date(now()).toISOString());
        return respond(response, 200, payload);
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[4] === "modules" &&
          segments.length === 6 && request.method === "GET") {
        const [, , projectId, layer, , moduleType] = segments;
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        if (layer !== "public" && layer !== "draft") throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
        const principal = requirePrincipal(request); principalForError = principal;
        const payload = moduleService.getModule(principal, projectId, layer, moduleType);
        projects.recordRecentAccess(principal.id, projectId, new Date(now()).toISOString());
        return respond(response, 200, payload);
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "draft" &&
          segments[4] === "modules" && segments.length === 5 && request.method === "PATCH") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        requireCsrf(request, principal);
        return respond(response, 200, moduleService.updateDraftModules(principal, projectId, await readJson(request)));
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 4 && request.method === "GET" && segments[3] !== "test-runs") {
        const [, , projectId, layer] = segments;
        if (layer !== "public" && layer !== "draft") throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
        return projectRead(request, response, projectId, layer);
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 3 && request.method === "PATCH") {
        const principal = requirePrincipal(request); principalForError = principal;
        requireCsrf(request, principal);
        const project = projectService.editProject(principal, segments[2], await readJson(request));
        return respond(response, 200, { project });
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 4 && request.method === "POST" && ["archive", "restore"].includes(segments[3])) {
        const principal = requirePrincipal(request); principalForError = principal;
        requireCsrf(request, principal);
        const project = segments[3] === "archive"
          ? projectService.archiveProject(principal, segments[2])
          : projectService.restoreProject(principal, segments[2]);
        return respond(response, 200, { project });
      }

      if (request.method === "GET" && url.pathname === "/api/public") {
        const principal = requirePrincipal(request); principalForError = principal;
        const project = projects.getAuthorizedProject(principal, compatibilityProjectId, "public");
        if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const snapshot = projects.getSnapshot(compatibilityProjectId, "published");
        projects.recordRecentAccess(principal.id, compatibilityProjectId, new Date(now()).toISOString());
        return respond(response, 200, snapshot);
      }

      if (segments[0] === "api" && segments[1] === "diagnostics" && segments[2] === "errors") {
        const principal = requirePrincipal(request); principalForError = principal;
        const projectId = url.searchParams.get("projectId") ?? "";
        requireDiagnosticsAccess(principal, projectId);
        if (segments.length === 3 && request.method === "GET") return respond(response, 200, { items: observability.listErrors({ projectId, limit: url.searchParams.get("limit") }) });
        if (segments.length === 4 && request.method === "GET") {
          const event = observability.getError(segments[3]);
          if (!event) throw new HttpError(404, "ERROR_EVENT_NOT_FOUND", "错误事件不存在或你无权访问");
          if (event.projectId) requireDiagnosticsAccess(principal, event.projectId);
          return respond(response, 200, { event });
        }
        if (segments.length === 5 && segments[4] === "bundle" && request.method === "GET") {
          const bundle = observability.bundle(segments[3]);
          if (!bundle) throw new HttpError(404, "ERROR_EVENT_NOT_FOUND", "错误事件不存在或你无权访问");
          if (bundle.error.projectId) requireDiagnosticsAccess(principal, bundle.error.projectId);
          return respond(response, 200, { bundle });
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (segments[0] === "api" && segments[1] === "projects" && segments[3] === "test-runs") {
        const projectId = segments[2];
        if (!projectIdPattern.test(projectId)) throw new HttpError(404, "PROJECT_NOT_FOUND", "项目不存在或你无权访问");
        const principal = requirePrincipal(request); principalForError = principal;
        requireDiagnosticsAccess(principal, projectId);
        if (segments.length === 4 && request.method === "GET") return respond(response, 200, productTests.list(principal, projectId));
        if (segments.length === 4 && request.method === "POST") {
          requireCsrf(request, principal);
          return respond(response, 201, productTests.run(principal, projectId, { ...(await readJson(request, 4 * 1024)), requestId }));
        }
        if (segments.length === 5 && request.method === "GET") {
          const run = productTests.getRun(principal, segments[4]);
          if (!run || run.run.projectId !== projectId) throw new HttpError(404, "TEST_RUN_NOT_FOUND", "测试运行不存在或你无权访问");
          return respond(response, 200, run);
        }
        throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      }

      if (options.enableSyntheticErrors && request.method === "GET" && url.pathname === "/api/_test/boom") {
        throw new Error("Synthetic failure with cookie=secret-token and prompt should be redacted");
      }

      if (url.pathname.startsWith("/api/")) throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
      if (await handleStatic(request, response, url)) { observability.finishTrace(traceId, "succeeded", { durationMs: Math.max(0, now() - traceStartedAt) }); return; }
      throw new HttpError(404, "NOT_FOUND", "请求路径不存在");
    } catch (error) {
      if (error instanceof MaterialGateError && !error.status) {
        error.status = error.code === "file_too_large" ? 413
          : ["upload_rate_limited", "upload_concurrency_limited"].includes(error.code) ? 429
            : ["duplicate_material", "project_capacity_limit", "project_material_limit"].includes(error.code) ? 409 : 400;
      }
      const known = error instanceof HttpError || error instanceof ProjectServiceError || error instanceof ModuleServiceError || error instanceof MaterialServiceError || error instanceof ProposalServiceError || error instanceof ReviewServiceError || error instanceof MemberServiceError || error instanceof AiServiceError || error instanceof MaterialGateError || (Number.isInteger(error?.status) && typeof error?.code === "string");
      const status = known ? error.status : 500;
      const code = known ? error.code : "INTERNAL_ERROR";
      if (traceId && !response.__traceFinished) {
        response.__traceFinished = true;
        observability.finishTrace(traceId, status >= 500 ? "failed" : "succeeded", { status, code, durationMs: Math.max(0, now() - traceStartedAt) });
      }
      let errorEvent;
      if (status >= 500) {
        try {
          errorEvent = observability.recordError({
            requestId,
            traceId,
            projectId: (() => { try { const url = new URL(request.url, "http://platform.local"); return inferProjectFromPath(url.pathname); } catch { return null; } })(),
            userId: principalForError?.id ?? null,
            method: request.method,
            route: request.url,
            status,
            code,
            message: known ? error.message : "服务器处理请求时发生错误",
            error,
            context: { known }
          });
        } catch (recordError) {
          console.error("Could not record error event", recordError);
        }
      }
      if (!known) console.error("Request failed", error);
      return respond(response, status, {
        error: known ? error.message : "服务器处理请求时发生错误",
        code,
        requestId,
        errorEventId: errorEvent?.id
      });
    }
  };
}

function inferProjectFromPath(pathname) {
  const match = String(pathname ?? "").match(/^\/api\/projects\/([^/]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
