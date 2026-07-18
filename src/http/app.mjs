import { createProjectRepository } from "../repositories/project-repository.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]*$/;

function respond(response, status, body, headers = {}) {
  response.writeHead(status, {
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
    return undefined;
  }
}

export function createApp({ database, compatibilityProjectId = "xugu-agentic-group" }) {
  const repository = createProjectRepository(database);

  return function handleRequest(request, response) {
    try {
      const url = new URL(request.url, "http://platform.local");
      const segments = pathSegments(url.pathname);
      if (!segments) return respond(response, 400, { error: "Malformed request path", code: "INVALID_PATH" });

      const knownGetPath = url.pathname === "/health" || url.pathname === "/api/projects" ||
        url.pathname === "/api/public" || (segments[0] === "api" && segments[1] === "projects" && segments.length === 4);
      if (request.method !== "GET" && knownGetPath) {
        return respond(response, 405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { allow: "GET" });
      }
      if (request.method !== "GET") return respond(response, 404, { error: "Not found", code: "NOT_FOUND" });

      if (url.pathname === "/health") {
        return respond(response, 200, { status: "ok" });
      }
      if (url.pathname === "/api/projects") {
        return respond(response, 200, { projects: repository.listProjects() });
      }
      if (url.pathname === "/api/public") {
        const snapshot = repository.getSnapshot(compatibilityProjectId, "published");
        if (!snapshot) return respond(response, 404, { error: "Compatibility project not found", code: "PROJECT_NOT_FOUND" });
        return respond(response, 200, snapshot);
      }
      if (segments[0] === "api" && segments[1] === "projects" && segments.length === 4) {
        const [, , projectId, layer] = segments;
        if (!projectIdPattern.test(projectId)) {
          return respond(response, 400, { error: "Invalid project ID", code: "INVALID_PROJECT_ID" });
        }
        if (layer !== "public" && layer !== "draft") {
          return respond(response, 404, { error: "Not found", code: "NOT_FOUND" });
        }
        const snapshot = repository.getSnapshot(projectId, layer === "public" ? "published" : "draft");
        if (!snapshot) return respond(response, 404, { error: "Project not found", code: "PROJECT_NOT_FOUND" });
        return respond(response, 200, snapshot);
      }
      return respond(response, 404, { error: "Not found", code: "NOT_FOUND" });
    } catch (error) {
      console.error("Request failed", error);
      return respond(response, 500, { error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  };
}
