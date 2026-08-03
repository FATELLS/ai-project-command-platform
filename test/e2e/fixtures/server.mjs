import { mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";

import { createFakeProvider } from "../../../src/ai/providers/fake-provider.mjs";
import { openDatabase } from "../../../src/db/database.mjs";
import { applyMigrations } from "../../../src/db/migrate.mjs";
import { upsert } from "../../../src/db/sql-dialect.mjs";
import { createApp } from "../../../src/http/app.mjs";
import { importLegacyProject } from "../../../src/migration/legacy-project.mjs";
import { createAuthRepository } from "../../../src/repositories/auth-repository.mjs";
import { hashPassword } from "../../../src/security/passwords.mjs";
import { createAuthService } from "../../../src/services/auth-service.mjs";

// E2E fixture server：每次启动用独立临时目录，导入两个夹具并创建角色用户。
// 绑定 fake provider 让材料→生成→提案闭环可自动跑通，无需真实 LLM 密钥。
const host = "127.0.0.1";
const port = Number(process.env.E2E_PORT || 4191);
const xuguPort = Number(process.env.XUGU_PORT || 55140);
const xuguContainer = process.env.XUGU_CONTAINER || "ai-platform-playwright-xugu";
const xuguVolume = process.env.XUGU_VOLUME || "ai-platform-playwright-xugu-data";
const xuguImage = process.env.XUGU_IMAGE || "ai-project-command-platform/xugudb:12.9.10-arm64";
const dataDir = process.env.E2E_DATA_DIR && process.env.E2E_DATA_DIR.length > 0
  ? process.env.E2E_DATA_DIR
  : mkdtempSync(join(tmpdir(), "e2e-platform-"));
const storageRoot = join(dataDir, "materials");

function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe", timeout: 120_000 });
}
function ignoreDocker(args) { try { docker(args); } catch {} }
ignoreDocker(["rm", "-f", xuguContainer]);
ignoreDocker(["volume", "rm", xuguVolume]);
docker(["run", "-d", "--name", xuguContainer, "-p", `127.0.0.1:${xuguPort}:5138`, "-v", `${xuguVolume}:/opt/database/Server`, xuguImage]);

let database;
for (let attempt = 0; attempt < 360; attempt += 1) {
  try { database = openDatabase(); break; }
  catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000); }
}
if (!database) throw new Error("isolated Xugu database did not become ready");
applyMigrations(database);

const at = "2026-07-18T00:00:00.000Z";
for (const [projectId, fixtureName, templateId] of [
  ["xugu-agentic-group", "xugu-agentic-group.json", "campaign-map-v1"],
  ["standard-project-sample", "standard-project-sample.json", "standard-project-v1"]
]) {
  if (!database.prepare("SELECT 1 FROM projects WHERE id=?").get(projectId)) {
    const fixture = JSON.parse(readFileSync(new URL(`../../../fixtures/projects/${fixtureName}`, import.meta.url), "utf8"));
    importLegacyProject(database, fixture, { projectId, templateId, now: at });
  }
}

const authService = createAuthService(database);
const adminPassword = process.env.PLATFORM_BOOTSTRAP_PASSWORD || "e2e-platform-admin-pw";
authService.ensureBootstrapAdmin({ loginName: "admin", displayName: "平台管理员", password: adminPassword });

const users = createAuthRepository(database);
// 角色矩阵：xugu 上有 editor/viewer，标准项目仅 viewer（用于跨项目隔离断言）。
function ensureUser(id, login, displayName) {
  if (!database.prepare("SELECT 1 FROM users WHERE id=?").get(id)) {
    users.insertUser({ id, displayName, loginName: login, ...hashPassword(adminPassword), createdAt: at, updatedAt: at });
  }
}
function setMember(projectId, userId, role) {
  upsert(database, "project_members", ["project_id", "user_id", "role", "created_at"], [projectId, userId, role, at], ["project_id", "user_id"]);
}
ensureUser("e2e-editor", "e2e-editor", "项目编辑者");
ensureUser("e2e-viewer", "e2e-viewer", "只读访问者");
ensureUser("e2e-std-viewer", "e2e-std-viewer", "标准项目只读");
setMember("xugu-agentic-group", "e2e-editor", "project_editor");
setMember("xugu-agentic-group", "e2e-viewer", "viewer");
setMember("standard-project-sample", "e2e-std-viewer", "viewer");

// fake provider：返回一个带证据的 plan 任务，用于走通审核闭环。
const provider = createFakeProvider((request) => {
  const input = JSON.parse(request.messages[1].content);
  const e = input.server_envelope;
  return {
    content: JSON.stringify({
      schemaVersion: e.schemaVersion,
      projectId: e.projectId,
      baseVersionId: e.baseVersionId,
      template: e.template,
      materialIds: e.materialIds,
      summary: "根据 E2E 材料，建议新增一项带证据的行动任务。",
      changes: [{
        changeId: "change-e2e",
        module: "task-network",
        operation: "create",
        targetId: "e2e-followup-task",
        semanticType: "plan",
        patch: { title: "E2E 跟进任务", unitId: "rd" },
        evidenceIds: [input.untrusted_evidence[0].evidenceId],
        confidence: 0.82,
        warnings: []
      }],
      warnings: []
    }),
    usage: { input: 100, output: 50 }
  };
});

// E2E 需要反复登录（globalSetup + 真实登录流程验证），放宽内存级登录限流。
// 登录限流行为本身由后台测试覆盖；此处仅避免 E2E 反复登录撞限流。
const server = createServer(createApp({
  database,
  authService,
  loginLimit: 1000,
  loginWindowMs: 60 * 60 * 1_000,
  materialOptions: { storageRoot },
  // 放宽生成配额：E2E 多 spec 反复生成提案，避免 4 次/分钟限流误报。
  // 配额行为本身由后台测试覆盖。
  proposalOptions: { provider, syncProcess: true, quotaOptions: { perMinute: 1000, daily: 10000, maxConcurrency: 8 } }
}));

server.listen(port, host, () => {
  console.log(`E2E fixture listening on http://${host}:${port} (data=${dataDir})`);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    if (database.isOpen) database.close();
    ignoreDocker(["stop", "-t", "60", xuguContainer]);
    ignoreDocker(["rm", xuguContainer]);
    ignoreDocker(["volume", "rm", xuguVolume]);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
