import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const container = "ai-platform-node-test-xugu";
const volume = "ai-platform-node-test-xugu-data";
const image = "ai-project-command-platform/xugudb:12.10.13-arm64";
const port = "55141";
const temporaryDirectory = mkdtempSync(join(tmpdir(), "ai-platform-xugu-test-"));

process.env.XUGU_HOST = "127.0.0.1";
process.env.XUGU_PORT = port;
process.env.XUGU_CONTAINER = container;
process.env.XUGU_VOLUME = volume;
process.env.XUGU_IMAGE = image;

const containerCli = process.env.CONTAINER_CLI || "docker";

function docker(args, timeout = 120_000) {
  return execFileSync(containerCli, args, { encoding: "utf8", stdio: "pipe", timeout }).trim();
}

function ignoreDocker(args) {
  try { docker(args); } catch {}
}

function startContainer() {
  const existing = docker(["ps", "-a", "--filter", `name=^${container}$`, "--format", "{{.Names}}"]);
  if (existing === container) {
    docker(["start", container]);
    return;
  }
  docker([
    "run", "-d", "--name", container,
    "-p", `127.0.0.1:${port}:5138`,
    "-v", `${volume}:/opt/database/Server`,
    image
  ]);
}

function stopContainer() {
  ignoreDocker(["stop", "-t", "60", container]);
}

async function connect(openDatabase) {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try { return openDatabase(); }
    catch { await new Promise(resolve => setTimeout(resolve, 1_000)); }
  }
  throw new Error("isolated Xugu database did not become ready");
}

test("Xugu is the complete persistence, migration, security and recovery backend", { timeout: 900_000 }, async t => {
  ignoreDocker(["rm", "-f", container]);
  ignoreDocker(["volume", "rm", volume]);
  assert.doesNotThrow(() => docker(["image", "inspect", image]));
  startContainer();

  const { openDatabase } = await import("../src/db/database.mjs");
  const { applyMigrations } = await import("../src/db/migrate.mjs");
  const { importLegacyProject, exportLegacyProject, semanticallyEqual } = await import("../src/migration/legacy-project.mjs");
  const { createProjectRepository } = await import("../src/repositories/project-repository.mjs");
  const { createAuthService } = await import("../src/services/auth-service.mjs");
  const { createSettingsService } = await import("../src/services/settings-service.mjs");
  const { createMaterialService } = await import("../src/services/material-service.mjs");
  const { backupXuguVolume, restoreXuguVolume, verifyXuguBackup } = await import("../src/operations/database-backup.mjs");

  let database = await connect(openDatabase);
  t.after(async () => {
    if (database?.isOpen) database.close();
    ignoreDocker(["rm", "-f", container]);
    ignoreDocker(["volume", "rm", volume]);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  await t.test("applies the canonical schema and preserves UTF-8 project data", () => {
    const applied = applyMigrations(database);
    assert.equal(applied.length, 8);
    assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations").get().count, 8);

    const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
    const result = importLegacyProject(database, fixture, {
      projectId: "xugu-agentic-group",
      now: "2026-08-02T00:00:00.000Z"
    });
    assert.equal(result.imported, true);
    assert.equal(semanticallyEqual(exportLegacyProject(database, "xugu-agentic-group"), fixture), true);

    const graph = createProjectRepository(database).getModuleVersionGraph("xugu-agentic-group", "published");
    assert.equal(graph.metadata.title, "虚谷 AI 转型促进作战地图");
    assert.equal(graph.units.length, 7);
    assert.equal(graph.tasks.length, 29);
    assert.equal(graph.stages.length, 6);
    assert.ok(graph.tasks.every(item => Array.isArray(item.dependsOn)));
  });

  let principal;
  await t.test("persists sessions, audit records, masked settings and evidence", async () => {
    const auth = createAuthService(database);
    const password = "Xugu-Integration-Only-123";
    const bootstrap = auth.ensureBootstrapAdmin({ loginName: "admin", displayName: "平台管理员", password });
    assert.equal(bootstrap.created, true);

    const login = auth.authenticate({ loginName: "admin", password, remoteAddress: "127.0.0.1" });
    assert.equal(login.ok, true);
    principal = login.principal;
    assert.equal(auth.resolveSession(login.sessionToken).id, principal.id);
    assert.equal(auth.verifyCsrf(login.principal, login.principal.csrfToken), true);

    const settings = createSettingsService(database);
    const secret = "xgsk-test-secret-value-9876";
    settings.updateAiChatConfig(principal, {
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      model: "test-model",
      apiKey: secret
    });
    const publicSettings = settings.getAllSettings();
    assert.equal(publicSettings.aiChat.apiKeySet, true);
    assert.equal(publicSettings.aiChat.apiKeyMasked, "xgsk****9876");
    assert.equal(JSON.stringify(publicSettings).includes(secret), false);

    const materials = createMaterialService(database, { storageRoot: join(temporaryDirectory, "materials") });
    const created = await materials.createManual(principal, "xugu-agentic-group", {
      title: "虚谷集成验证纪要",
      body: "会议日期：2026-08-02。行动项：验证虚谷容器生命周期、来源追踪与数据隔离。",
      updateTemplateId: "meeting-notes"
    });
    assert.equal(created.material.status, "ready");
    const evidence = materials.listEvidence(principal, "xugu-agentic-group", created.material.id);
    assert.ok(evidence.items.length > 0);
    assert.match(evidence.items[0].text, /虚谷容器生命周期/);

    assert.equal(auth.logout(login.sessionToken, { remoteAddress: "127.0.0.1" }), true);
    assert.equal(auth.resolveSession(login.sessionToken), undefined);
    const actions = auth.repository.listAudit().map(event => event.action);
    assert.ok(actions.includes("auth.login_succeeded"));
    assert.ok(actions.includes("material.manual_created"));
    assert.ok(actions.includes("auth.logout"));
  });

  await t.test("creates a cold backup and restores the Docker volume", async () => {
    const backupPath = join(temporaryDirectory, "xugu-volume.tar.gz");
    database.close();
    stopContainer();
    const backup = await backupXuguVolume(backupPath, { image, container, volume });
    assert.ok(backup.bytes > 1024);
    assert.equal((await verifyXuguBackup(backupPath, { image, container, volume })).sha256, backup.sha256);

    startContainer();
    database = await connect(openDatabase);
    database.prepare("UPDATE projects SET name = ? WHERE id = ?").run("临时损坏数据", "xugu-agentic-group");
    assert.equal(database.prepare("SELECT name FROM projects WHERE id = ?").get("xugu-agentic-group").name, "临时损坏数据");
    database.close();
    stopContainer();

    const restored = await restoreXuguVolume(backupPath, { image, container, volume, suffix: "integration-test" });
    assert.ok(restored.preserved.endsWith(".pre-restore-integration-test.tar.gz"));
    startContainer();
    database = await connect(openDatabase);
    assert.equal(database.prepare("SELECT name FROM projects WHERE id = ?").get("xugu-agentic-group").name, "虚谷 AI 转型促进作战地图");
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_blocks").get().count > 0, true);
  });
});
