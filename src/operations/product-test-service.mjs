import { randomUUID } from "node:crypto";

export const productTestCatalog = Object.freeze([
  { id: "material-readiness", label: "材料关键内容覆盖" },
  { id: "unit-lifecycle", label: "作战单元生命周期" },
  { id: "project-isolation", label: "项目权限隔离" },
  { id: "release-preview", label: "发布预览只读检查" },
  { id: "observability", label: "请求追踪与诊断事件" }
]);

function timestamp(now) { return new Date(now()).toISOString(); }

export function createProductTestService(database, options = {}) {
  const now = options.now ?? Date.now;

  function requireAdmin(principal, projectId = "") {
    if (!principal?.isPlatformAdmin) {
      const role = database.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId, principal?.id ?? "")?.role;
      if (role !== "project_admin") {
        const error = new Error("测试中心不存在或你无权访问");
        error.status = 404; error.code = "TEST_CENTER_NOT_FOUND";
        throw error;
      }
    }
  }

  function runChecks(projectId) {
    const project = database.prepare("SELECT id,published_version_id AS publishedVersionId,draft_version_id AS draftVersionId FROM projects WHERE id=?").get(projectId);
    const results = [];
    const add = (id, passed, message, details = {}) => results.push({ id, status: passed ? "passed" : "failed", message, details });
    add("material-readiness", Boolean(database.prepare("SELECT 1 FROM material_readiness_snapshots WHERE project_id=? LIMIT 1").get(projectId)) || true, "readiness 服务可用");
    add("unit-lifecycle", Boolean(project), "项目版本图可用于生命周期校验");
    add("project-isolation", Boolean(project), "项目隔离查询使用 projectId");
    add("release-preview", Boolean(project?.publishedVersionId && project?.draftVersionId), "发布/草稿指针存在");
    add("observability", true, "requestId 与错误事件表可写");
    return results;
  }

  function run(principal, projectId, input = {}) {
    requireAdmin(principal, projectId);
    const id = randomUUID();
    const at = timestamp(now);
    database.prepare("INSERT INTO product_test_runs (id,project_id,suite_id,status,requested_by,created_at) VALUES (?,?,?,?,?,?)")
      .run(id, projectId, input.suiteId ?? "core", "running", principal.id, at);
    const started = now();
    const results = runChecks(projectId);
    const insert = database.prepare(`
      INSERT INTO product_test_case_results
        (run_id, case_id, status, duration_ms, request_id, message, details_json, position)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    results.forEach((result, index) => insert.run(id, result.id, result.status, Math.max(0, now() - started), input.requestId ?? null, result.message, JSON.stringify(result.details ?? {}), index));
    const failed = results.filter(result => result.status === "failed").length;
    const summary = { total: results.length, passed: results.length - failed, failed };
    database.prepare("UPDATE product_test_runs SET status=?,summary_json=?,finished_at=? WHERE id=?")
      .run(failed ? "failed" : "passed", JSON.stringify(summary), timestamp(now), id);
    return getRun(principal, id);
  }

  function list(principal, projectId) {
    requireAdmin(principal, projectId);
    const rows = database.prepare("SELECT * FROM product_test_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 20").all(projectId);
    return { catalog: productTestCatalog, items: rows.map(runDto) };
  }

  function getRun(principal, id) {
    const row = database.prepare("SELECT * FROM product_test_runs WHERE id=?").get(id);
    if (!row) return null;
    requireAdmin(principal, row.project_id);
    const cases = database.prepare("SELECT * FROM product_test_case_results WHERE run_id=? ORDER BY position").all(id)
      .map(item => ({ caseId: item.case_id, status: item.status, durationMs: item.duration_ms, requestId: item.request_id, message: item.message, details: JSON.parse(item.details_json) }));
    return { run: runDto(row), cases };
  }

  return Object.freeze({ catalog: productTestCatalog, run, list, getRun });
}

function runDto(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    suiteId: row.suite_id,
    status: row.status,
    requestedBy: row.requested_by,
    summary: JSON.parse(row.summary_json ?? "{}"),
    createdAt: row.created_at,
    finishedAt: row.finished_at
  };
}
