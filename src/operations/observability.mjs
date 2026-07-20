import { createHash, randomUUID } from "node:crypto";

const secretPattern = /(cookie|csrf|authorization|api[_-]?key|token|password|secret)(["'\s:=]+)([^"',\s]+)/gi;
const promptPattern = /(messages|prompt|untrusted_evidence|text|body)(["'\s:=]+)(.{16,})/gi;

function timestamp(now) { return new Date(now()).toISOString(); }
function safeJson(value) { try { return JSON.stringify(value ?? {}); } catch { return "{}"; } }
function parse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }

export function createRequestId(value) {
  const id = String(value ?? "").trim();
  return /^[a-zA-Z0-9._:-]{16,80}$/.test(id) ? id : randomUUID();
}

export function redact(value) {
  return String(value ?? "")
    .replace(secretPattern, "$1$2[REDACTED]")
    .replace(promptPattern, "$1$2[REDACTED]")
    .slice(0, 12000);
}

function fingerprint(value) {
  return createHash("sha256").update(redact(value)).digest("hex");
}

function inferProject(pathname) {
  const match = String(pathname ?? "").match(/^\/api\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createObservabilityService(database, options = {}) {
  const now = options.now ?? Date.now;
  function projectIdOrNull(value) {
    const projectId = String(value ?? "").trim();
    return projectId && database.prepare("SELECT 1 FROM projects WHERE id=?").get(projectId) ? projectId : null;
  }

  function recordError(input) {
    const id = input.id ?? randomUUID();
    const stack = redact(input.stack ?? input.error?.stack ?? input.message);
    database.prepare(`
      INSERT INTO error_events
        (id, request_id, trace_id, project_id, user_id, method, route, status, code,
         message, stack_fingerprint, stack_redacted, context_json, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      input.requestId,
      input.traceId ?? null,
      projectIdOrNull(input.projectId ?? inferProject(input.route)),
      input.userId ?? null,
      String(input.method ?? "").slice(0, 12),
      String(input.route ?? "").slice(0, 300),
      input.status,
      String(input.code ?? "INTERNAL_ERROR").slice(0, 120),
      String(input.message ?? "服务器处理请求时发生错误").slice(0, 500),
      fingerprint(stack),
      stack,
      safeJson(input.context),
      timestamp(now)
    );
    return getError(id);
  }

  function startTrace(input) {
    const id = input.id ?? randomUUID();
    database.prepare(`
      INSERT INTO operation_traces
        (id, parent_id, request_id, project_id, user_id, operation, target_type,
         target_id, status, metadata_json, started_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      input.parentId ?? null,
      input.requestId,
      projectIdOrNull(input.projectId),
      input.userId ?? null,
      String(input.operation ?? "operation").slice(0, 120),
      input.targetType ?? "",
      input.targetId ?? null,
      "started",
      safeJson(input.metadata),
      timestamp(now)
    );
    return id;
  }

  function finishTrace(id, status = "succeeded", metadata = {}) {
    database.prepare(`
      UPDATE operation_traces
      SET status=?, metadata_json=?, finished_at=?
      WHERE id=?
    `).run(status, safeJson(metadata), timestamp(now), id);
  }

  function listErrors(input = {}) {
    const limit = Math.min(100, Math.max(1, Number(input.limit ?? 50)));
    const projectId = input.projectId ?? "";
    const rows = projectId
      ? database.prepare("SELECT * FROM error_events WHERE project_id=? ORDER BY created_at DESC LIMIT ?").all(projectId, limit)
      : database.prepare("SELECT * FROM error_events ORDER BY created_at DESC LIMIT ?").all(limit);
    return rows.map(errorDto);
  }

  function getError(id) {
    const row = database.prepare("SELECT * FROM error_events WHERE id=? OR request_id=?").get(id, id);
    return row ? errorDto(row) : null;
  }

  function bundle(id) {
    const error = getError(id);
    if (!error) return null;
    const traces = database.prepare("SELECT * FROM operation_traces WHERE request_id=? ORDER BY started_at").all(error.requestId)
      .map(row => ({ ...row, metadata: parse(row.metadata_json, {}) }));
    return { error, traces, generatedAt: timestamp(now) };
  }

  return Object.freeze({ recordError, startTrace, finishTrace, listErrors, getError, bundle });
}

function errorDto(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    traceId: row.trace_id,
    projectId: row.project_id,
    userId: row.user_id,
    method: row.method,
    route: row.route,
    status: row.status,
    code: row.code,
    message: row.message,
    stackFingerprint: row.stack_fingerprint,
    stack: row.stack_redacted,
    context: parse(row.context_json, {}),
    createdAt: row.created_at
  };
}
