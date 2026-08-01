import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

// 开发测试脚本，使用 SQLite 快速路径
process.env.NODE_ENV = "test";

import { createFakeProvider } from "../src/ai/providers/fake-provider.mjs";
import { createDisabledProvider } from "../src/ai/providers/disabled-provider.mjs";
import { defaultDataDir, openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";

if (process.env.BROWSER_FIXTURE_MODE !== "1") {
  throw new Error("This test-only server requires BROWSER_FIXTURE_MODE=1");
}

const host = "127.0.0.1";
const port = Number(process.env.PORT || 4175);
const password = process.env.PLATFORM_BOOTSTRAP_PASSWORD || "phase-five-browser-password";
const database = openDatabase(join(defaultDataDir(), "phase5-browser.sqlite"));
applyMigrations(database);

for (const [projectId, fixtureName] of [
  ["xugu-agentic-group", "xugu-agentic-group.json"],
  ["standard-project-sample", "standard-project-sample.json"]
]) {
  if (!database.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId)) {
    const fixture = JSON.parse(readFileSync(new URL(`../fixtures/projects/${fixtureName}`, import.meta.url), "utf8"));
    importLegacyProject(database, fixture, {
      projectId,
      templateId: projectId === "standard-project-sample" ? "standard-project-v1" : "campaign-map-v1",
      now: "2026-07-18T00:00:00.000Z"
    });
  }
}

const authService = createAuthService(database);
authService.ensureBootstrapAdmin({
  loginName: "admin",
  displayName: "平台管理员",
  password
});

const fakeProvider = createFakeProvider(request => {
  const input = JSON.parse(request.messages[1].content);
  const envelope = input.server_envelope;
  return {
    content: JSON.stringify({
      schemaVersion: envelope.schemaVersion,
      projectId: envelope.projectId,
      baseVersionId: envelope.baseVersionId,
      template: envelope.template,
      materialIds: envelope.materialIds,
      summary: "根据战情纪要，建议新增数据治理跟进任务。",
      changes: [{
        changeId: "change-001",
        module: "task-network",
        operation: "create",
        targetId: "proposal-task-001",
        semanticType: "plan",
        patch: { title: "跟进数据治理", unitId: "rd" },
        evidenceIds: [input.untrusted_evidence[0].evidenceId],
        confidence: 0.82,
        warnings: []
      }],
      warnings: []
    }),
    usage: { input: 100, output: 50 }
  };
});
const provider = process.env.BROWSER_FIXTURE_PROVIDER === "disabled"
  ? createDisabledProvider()
  : fakeProvider;

const server = createServer(createApp({
  database,
  authService,
  materialOptions: { storageRoot: join(defaultDataDir(), "phase5-browser-materials") },
  proposalOptions: { provider }
}));

async function api(path, options = {}) {
  const response = await fetch(`http://${host}:${port}${path}`, options);
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function seedProposal() {
  if (database.prepare("SELECT 1 FROM change_proposals WHERE project_id = ? LIMIT 1").get("xugu-agentic-group")) return;
  const login = await api("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginName: "admin", password })
  });
  const cookie = login.response.headers.get("set-cookie").split(";", 1)[0];
  const headers = {
    cookie,
    "content-type": "application/json",
    "x-csrf-token": login.payload.csrfToken
  };
  const created = await api("/api/projects/xugu-agentic-group/materials/manual", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "数据治理战情纪要",
      body: "数据治理行动任务需要由第一作战单元跟进，并在下次例会报告进度。",
      updateTemplateId: "meeting-notes"
    })
  });
  const materialId = created.payload.material.id;
  await api(`/api/projects/xugu-agentic-group/materials/${materialId}/generation`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ enabled: true })
  });
  await api("/api/projects/xugu-agentic-group/generation-tasks", {
    method: "POST",
    headers,
    body: JSON.stringify({ materialIds: [materialId], idempotencyKey: "phase5-browser-seed" })
  });
}

server.listen(port, host, async () => {
  await seedProposal();
  console.log(`Phase 5 browser fixture listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => database.close());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
