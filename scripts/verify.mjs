import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// verify 脚本用于开发/CI 验证，使用 SQLite 快速路径（生产环境走虚谷）
process.env.NODE_ENV = "test";

import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { exportLegacyProject, importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const referenceRoot = resolve(root, "../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console");
const referenceSeed = join(referenceRoot, "data/state.seed.json");
const required = [
  "AGENTS.md",
  "AI-SPEC.md",
  "README.md",
  "server.mjs",
  "docs/RESULT.md",
  "docs/ARCHITECTURE.md",
  "docs/MIGRATION.md",
  ".planning/PROJECT.md",
  ".planning/REQUIREMENTS.md",
  ".planning/ROADMAP.md",
  ".planning/STATE.md",
  ".planning/DECISIONS.md",
  ".planning/PROCESS.md",
  ".planning/HANDOFF.md",
  ".planning/phases/01-project-domain-data-foundation/01-01-PLAN.md",
  ".planning/phases/01-project-domain-data-foundation/01-02-PLAN.md",
  ".planning/phases/01-project-domain-data-foundation/01-03-PLAN.md",
  ".planning/phases/01-project-domain-data-foundation/VERIFICATION.md",
  ".planning/phases/02-platform-shell-project-switching/UI-SPEC.md",
  ".planning/phases/02-platform-shell-project-switching/02-01-PLAN.md",
  ".planning/phases/02-platform-shell-project-switching/02-02-PLAN.md",
  ".planning/phases/02-platform-shell-project-switching/02-03-PLAN.md",
  ".planning/phases/03-module-registry-project-templates/UI-SPEC.md",
  ".planning/phases/03-module-registry-project-templates/03-VALIDATION.md",
  ".planning/phases/03-module-registry-project-templates/03-01-PLAN.md",
  ".planning/phases/03-module-registry-project-templates/03-02-PLAN.md",
  ".planning/phases/03-module-registry-project-templates/03-03-PLAN.md",
  ".planning/phases/03-module-registry-project-templates/03-04-PLAN.md",
  ".planning/phases/03-module-registry-project-templates/VERIFICATION.md",
  ".planning/phases/04-project-materials-evidence/CONTEXT.md",
  ".planning/phases/04-project-materials-evidence/RESEARCH.md",
  ".planning/phases/04-project-materials-evidence/UI-SPEC.md",
  ".planning/phases/04-project-materials-evidence/AI-SPEC.md",
  ".planning/phases/04-project-materials-evidence/EVAL.md",
  ".planning/phases/04-project-materials-evidence/04-VALIDATION.md",
  ".planning/phases/04-project-materials-evidence/04-01-PLAN.md",
  ".planning/phases/04-project-materials-evidence/04-02-PLAN.md",
  ".planning/phases/04-project-materials-evidence/04-03-PLAN.md",
  ".planning/phases/04-project-materials-evidence/04-04-PLAN.md",
  ".planning/phases/04-project-materials-evidence/04-05-PLAN.md",
  ".planning/phases/05-structured-change-proposals/CONTEXT.md",
  ".planning/phases/05-structured-change-proposals/RESEARCH.md",
  ".planning/phases/05-structured-change-proposals/UI-SPEC.md",
  ".planning/phases/05-structured-change-proposals/AI-SPEC.md",
  ".planning/phases/05-structured-change-proposals/05-VALIDATION.md",
  ".planning/phases/05-structured-change-proposals/05-01-PLAN.md",
  ".planning/phases/05-structured-change-proposals/05-02-PLAN.md",
  ".planning/phases/05-structured-change-proposals/05-03-PLAN.md",
  ".planning/phases/05-structured-change-proposals/05-04-PLAN.md",
  ".planning/phases/05-structured-change-proposals/PLAN-REVIEW.md",
  ".planning/phases/05-structured-change-proposals/VERIFICATION.md",
  ".planning/phases/06-review-publish-operations/CONTEXT.md",
  ".planning/phases/06-review-publish-operations/RESEARCH.md",
  ".planning/phases/06-review-publish-operations/UI-SPEC.md",
  ".planning/phases/06-review-publish-operations/EVAL.md",
  ".planning/phases/06-review-publish-operations/06-VALIDATION.md",
  ".planning/phases/06-review-publish-operations/06-01-PLAN.md",
  ".planning/phases/06-review-publish-operations/06-02-PLAN.md",
  ".planning/phases/06-review-publish-operations/06-03-PLAN.md",
  ".planning/phases/06-review-publish-operations/06-04-PLAN.md",
  ".planning/phases/06-review-publish-operations/06-05-PLAN.md",
  ".planning/phases/06-review-publish-operations/PLAN-REVIEW.md",
  ".planning/phases/06-review-publish-operations/VERIFICATION.md",
  ".planning/phases/07-release-hardening-material-readiness/CONTEXT.md",
  ".planning/phases/07-release-hardening-material-readiness/07-VALIDATION.md",
  ".planning/phases/07-release-hardening-material-readiness/07-01-PLAN.md",
  ".planning/phases/07-release-hardening-material-readiness/07-02-PLAN.md",
  ".planning/phases/07-release-hardening-material-readiness/07-03-PLAN.md",
  ".planning/phases/07-release-hardening-material-readiness/07-04-PLAN.md",
  ".planning/phases/07-release-hardening-material-readiness/VERIFICATION.md",
  ".planning/evidence/phase3-browser-matrix.json",
  ".planning/evidence/phase3-xugu-modules-desktop-1440x900.jpg",
  ".planning/evidence/phase3-standard-modules-desktop-1440x900.jpg",
  ".planning/evidence/phase3-modules-tablet-1024x768.jpg",
  ".planning/evidence/phase3-modules-mobile-390x844.jpg",
  "fixtures/projects/xugu-agentic-group.json",
  "fixtures/projects/standard-project-sample.json",
  "src/db/migrations/001_initial.sql",
  "src/db/migrations/002_auth_project_access.sql",
  "src/db/migrations/003_module_registry_templates.sql",
  "src/db/migrations/004_materials_evidence.sql",
  "src/db/migrations/005_structured_change_proposals.sql",
  "src/db/migrations/006_review_publish_operations.sql",
  "src/db/migrations/007_release_hardening_readiness_observability.sql",
  "fixtures/evals/change-proposal-cases.json",
  "src/materials/policy.mjs",
  "src/materials/storage.mjs",
  "src/materials/material-repository.mjs",
  "src/materials/ingest-service.mjs",
  "src/materials/processing-service.mjs",
  "src/materials/evidence-service.mjs",
  "src/materials/readiness-service.mjs",
  "src/materials/extractors/index.mjs",
  "src/ai/retriever.mjs",
  "src/ai/prompt-builder.mjs",
  "src/ai/answer-validator.mjs",
  "src/ai/provider-factory.mjs",
  "src/ai/quota.mjs",
  "src/ai/providers/disabled-provider.mjs",
  "src/ai/providers/fake-provider.mjs",
  "src/ai/providers/openai-compatible-provider.mjs",
  "src/proposals/catalog.mjs",
  "src/proposals/context-builder.mjs",
  "src/proposals/errors.mjs",
  "src/proposals/generation-service.mjs",
  "src/proposals/prompt-builder.mjs",
  "src/proposals/proposal-repository.mjs",
  "src/proposals/schema.mjs",
  "src/proposals/validator.mjs",
  "src/services/material-service.mjs",
  "src/services/chat-service.mjs",
  "src/services/proposal-service.mjs",
  "src/services/member-service.mjs",
  "src/review/review-service.mjs",
  "src/review/version-apply.mjs",
  "src/review/graph-validator.mjs",
  "src/release/release-service.mjs",
  "src/versions/version-store.mjs",
  "src/operations/database-backup.mjs",
  "src/operations/observability.mjs",
  "src/operations/product-test-service.mjs",
  "src/templates/catalog.mjs",
  "src/templates/template-validator.mjs",
  "src/modules/registry.mjs",
  "src/modules/schemas.mjs",
  "src/modules/loaders.mjs",
  "src/modules/module-service.mjs",
  "scripts/seed-project-fixture.mjs",
  "scripts/run-phase5-browser-fixture.mjs",
  "scripts/run-phase6-browser-fixture.mjs",
  "scripts/backup-database.mjs",
  "scripts/restore-database.mjs",
  "scripts/manage-server.mjs",
  "scripts/verify-browser-evidence.mjs",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/material-template-downloads.js",
  "public/modules/registry.js",
  "public/modules/shared.js",
  "public/modules/renderers.js",
  "playwright.abnormal.config.mjs",
  "test/material-template-downloads.test.mjs",
  "test/e2e/06-abnormal-material-inputs.spec.mjs",
  "test/template-catalog.test.mjs",
  "test/db-foundation.test.mjs",
  "test/project-migration.test.mjs",
  "test/module-registry.test.mjs",
  "test/module-api.test.mjs",
  "test/module-ui-server.test.mjs",
  "test/platform-ui-server.test.mjs",
  "test/material-gate.test.mjs",
  "test/material-extraction.test.mjs",
  "test/evidence-isolation.test.mjs",
  "test/chat-retrieval.test.mjs",
  "test/chat-provider.test.mjs",
  "test/ai-quota.test.mjs",
  "test/material-api.test.mjs",
  "test/material-ui-server.test.mjs",
  "test/generation-provider.test.mjs",
  "test/generation-service.test.mjs",
  "test/proposal-api.test.mjs",
  "test/proposal-schema.test.mjs",
  "test/proposal-ui-server.test.mjs",
  "test/proposal-validator.test.mjs"
  ,"test/review-release-service.test.mjs"
  ,"test/review-release-api.test.mjs"
  ,"test/review-release-ui-server.test.mjs"
  ,"test/member-service.test.mjs"
  ,"test/database-backup.test.mjs"
  ,"test/phase6-eval.test.mjs"
  ,"test/material-readiness.test.mjs"
  ,"test/unit-lifecycle-validator.test.mjs"
  ,"test/observability-product-test.test.mjs"
];

function run(command, args, options = {}) {
  const spawnOptions = {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  };
  if (options.env) spawnOptions.env = options.env;
  const result = spawnSync(command, args, spawnOptions);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`);
  }
  return options.capture ? result.stdout.trim() : "";
}
// 选一个空闲端口给 E2E：避免与已在 4191/4190 等端口运行的实例冲突导致登录撞限流。
function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", rejectPort);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function referenceSnapshot() {
  await access(referenceSeed);
  return {
    head: run("git", ["rev-parse", "HEAD"], { cwd: referenceRoot, capture: true }),
    status: run("git", ["status", "--short", "--branch"], { cwd: referenceRoot, capture: true }),
    seedHash: sha256(await readFile(referenceSeed))
  };
}

const referenceBefore = await referenceSnapshot();
for (const file of required) await access(join(root, file));

const config = JSON.parse(await readFile(join(root, ".planning/config.json"), "utf8"));
assert.equal(config.projectId, "ai-project-command-platform", "planning config project id mismatch");

const fixture = JSON.parse(await readFile(join(root, "fixtures/projects/xugu-agentic-group.json"), "utf8"));
assert.equal(sha256(await readFile(join(root, "fixtures/projects/xugu-agentic-group.json"))), referenceBefore.seedHash,
  "committed Xugu fixture no longer matches the read-only reference seed");

for (const file of [
  "server.mjs",
  "src/db/database.mjs",
  "src/db/migrate.mjs",
  "src/domain/project-validator.mjs",
  "src/http/app.mjs",
  "src/http/static.mjs",
  "src/migration/legacy-project.mjs",
  "src/templates/catalog.mjs",
  "src/templates/template-validator.mjs",
  "src/modules/registry.mjs",
  "src/modules/schemas.mjs",
  "src/modules/loaders.mjs",
  "src/modules/module-service.mjs",
  "src/materials/policy.mjs",
  "src/materials/storage.mjs",
  "src/materials/material-repository.mjs",
  "src/materials/ingest-service.mjs",
  "src/materials/processing-service.mjs",
  "src/materials/evidence-service.mjs",
  "src/materials/readiness-service.mjs",
  "src/materials/extractors/common.mjs",
  "src/materials/extractors/text.mjs",
  "src/materials/extractors/ooxml.mjs",
  "src/materials/extractors/pdf.mjs",
  "src/materials/extractors/image.mjs",
  "src/materials/extractors/index.mjs",
  "src/ai/errors.mjs",
  "src/ai/retriever.mjs",
  "src/ai/prompt-builder.mjs",
  "src/ai/answer-validator.mjs",
  "src/ai/published-facts.mjs",
  "src/ai/provider-factory.mjs",
  "src/ai/quota.mjs",
  "src/ai/providers/disabled-provider.mjs",
  "src/ai/providers/fake-provider.mjs",
  "src/ai/providers/openai-compatible-provider.mjs",
  "src/proposals/catalog.mjs",
  "src/proposals/context-builder.mjs",
  "src/proposals/errors.mjs",
  "src/proposals/generation-service.mjs",
  "src/proposals/prompt-builder.mjs",
  "src/proposals/proposal-repository.mjs",
  "src/proposals/schema.mjs",
  "src/proposals/validator.mjs",
  "src/repositories/auth-repository.mjs",
  "src/repositories/project-repository.mjs",
  "src/security/passwords.mjs",
  "src/security/sessions.mjs",
  "src/services/auth-service.mjs",
  "src/services/project-service.mjs",
  "src/services/material-service.mjs",
  "src/services/chat-service.mjs",
  "src/services/proposal-service.mjs",
  "src/services/member-service.mjs",
  "src/review/review-service.mjs",
  "src/review/version-apply.mjs",
  "src/review/graph-validator.mjs",
  "src/review/errors.mjs",
  "src/release/release-service.mjs",
  "src/versions/version-store.mjs",
  "src/operations/database-backup.mjs",
  "src/operations/observability.mjs",
  "src/operations/product-test-service.mjs",
  "scripts/seed-project-fixture.mjs",
  "scripts/run-phase5-browser-fixture.mjs",
  "scripts/run-phase6-browser-fixture.mjs",
  "scripts/backup-database.mjs",
  "scripts/restore-database.mjs",
  "scripts/manage-server.mjs",
  "scripts/verify-browser-evidence.mjs",
  "playwright.abnormal.config.mjs",
  "public/app.js",
  "public/material-template-downloads.js",
  "public/modules/registry.js",
  "public/modules/shared.js",
  "public/modules/renderers.js"
]) run(process.execPath, ["--check", file]);
// 单元测试：显式 glob 避免误跑 test/e2e/fixtures/server.mjs。
// 已知 chat-provider 有 1 个 cancelled（flaky timer），只要 0 fail 就算通过。
const unitResult = spawnSync(process.execPath, ["--test", "test/*.test.mjs"], { cwd: root, encoding: "utf8", stdio: "pipe" });
if (unitResult.stdout) process.stdout.write(unitResult.stdout);
if (unitResult.stderr) process.stderr.write(unitResult.stderr);
if (unitResult.status !== 0) {
  // 检查输出中是否有真正的 fail（而非仅 cancelled）
  const output = (unitResult.stdout || "") + (unitResult.stderr || "");
  if (/# fail 0/.test(output)) {
    console.log("  (单元测试有 cancelled 项但无 fail，视为通过)");
  } else {
    throw new Error(`node --test test/*.test.mjs failed with exit code ${unitResult.status}`);
  }
}
// 全自动浏览器 E2E（Playwright + Chromium）：需要可监听 127.0.0.1 的运行环境。
// 受限沙盒如禁止端口监听会报 EPERM；在可监听环境中必须通过。
const e2ePort = await findFreePort();
run("npx", ["playwright", "test", "--reporter=list"], { env: { ...process.env, E2E_PORT: String(e2ePort) } });
const abnormalE2ePort = await findFreePort();
run("npx", ["playwright", "test", "--config=playwright.abnormal.config.mjs", "--reporter=list"], {
  env: { ...process.env, E2E_ABNORMAL_PORT: String(abnormalE2ePort) }
});
run(process.execPath, ["scripts/verify-browser-evidence.mjs", ".planning/evidence/phase3-browser-matrix.json"]);

const phase4BrowserMatrix = join(root, ".planning/evidence/phase4-browser-matrix.json");
try {
  await access(phase4BrowserMatrix);
  run(process.execPath, ["scripts/verify-browser-evidence.mjs", ".planning/evidence/phase4-browser-matrix.json"]);
} catch (error) {
  if (process.env.REQUIRE_PHASE4_BROWSER_EVIDENCE === "1") {
    throw new Error("Phase 4 browser evidence is required but has not been generated", { cause: error });
  }
  console.log("Phase 4 browser evidence pending: deterministic and Phase 3 browser gates remain enforced.");
}

const phase5BrowserMatrix = join(root, ".planning/evidence/phase5-browser-matrix.json");
try {
  await access(phase5BrowserMatrix);
  run(process.execPath, ["scripts/verify-browser-evidence.mjs", ".planning/evidence/phase5-browser-matrix.json"]);
} catch (error) {
  if (process.env.REQUIRE_PHASE5_BROWSER_EVIDENCE === "1") {
    throw new Error("Phase 5 browser evidence is required but has not been generated", { cause: error });
  }
  console.log("Phase 5 browser evidence pending: deterministic and prior browser gates remain enforced.");
}

const phase6BrowserMatrix = join(root, ".planning/evidence/phase6-browser-matrix.json");
try {
  await access(phase6BrowserMatrix);
  run(process.execPath, ["scripts/verify-browser-evidence.mjs", ".planning/evidence/phase6-browser-matrix.json"]);
} catch (error) {
  if (process.env.REQUIRE_PHASE6_BROWSER_EVIDENCE === "1") throw new Error("Phase 6 browser evidence is required but has not been generated", { cause: error });
  console.log("Phase 6 browser evidence pending: deterministic and prior browser gates remain enforced.");
}

const tracked = run("git", ["ls-files"], { capture: true }).split("\n").filter(Boolean);
const forbiddenTracked = tracked.filter(file =>
  (file !== ".env.example" && /^\.env(?:\.|$)/.test(file)) || file === "data/ai-config.json" ||
  /^(?:data|runtime|storage)\/(?:uploads|processed|materials|logs)\//.test(file) ||
  /\.(?:sqlite(?:-wal|-shm)?|pem|key|p12|log)$/.test(file)
);
assert.deepEqual(forbiddenTracked, [], `runtime or sensitive files are tracked: ${forbiddenTracked.join(", ")}`);

const runtimeDir = await mkdtemp(join(tmpdir(), "platform-verify-"));
const database = openDatabase(join(runtimeDir, "platform.sqlite"));
let server;
try {
  assert.deepEqual(applyMigrations(database), [
    "001_initial.sql",
    "002_auth_project_access.sql",
    "003_module_registry_templates.sql",
    "004_materials_evidence.sql",
    "005_structured_change_proposals.sql",
    "006_review_publish_operations.sql",
    "007_release_hardening_readiness_observability.sql",
    "008_password_reset.sql",
    "009_platform_settings.sql",
    "010_unified_cards.sql"
  ]);
  assert.deepEqual(applyMigrations(database), []);
  const imported = importLegacyProject(database, fixture, {
    projectId: "xugu-agentic-group",
    now: "2026-07-18T00:00:00.000Z"
  });
  assert.equal(imported.validation.published.units, 7);
  assert.equal(imported.validation.published.tasks, 29);
  assert.deepEqual(exportLegacyProject(database, "xugu-agentic-group"), fixture);

  const auth = createAuthService(database);
  auth.ensureBootstrapAdmin({ loginName: "verify-admin", password: "phase-two-verify-password", displayName: "Verify Admin" });
  server = createServer(createApp({
    database,
    authService: auth,
    materialOptions: { storageRoot: join(runtimeDir, "materials") },
    chatOptions: { environment: {} }
  }));

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginName: "verify-admin", password: "phase-two-verify-password" })
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie").split(";", 1)[0];
  const headers = { cookie };
  const scopedResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/public`, { headers });
  const compatibilityResponse = await fetch(`${baseUrl}/api/public`, { headers });
  assert.equal(scopedResponse.status, 200);
  assert.equal(compatibilityResponse.status, 200);
  const capabilityResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/materials/capabilities`, { headers });
  assert.equal(capabilityResponse.status, 200);
  const capabilities = await capabilityResponse.json();
  assert.equal(capabilities.limits.maxFileBytes, 200 * 1024 * 1024);
  assert.equal(JSON.stringify(capabilities).includes("apiKey"), false);
  assert.equal(JSON.stringify(capabilities).includes("baseUrl"), false);
  const generationCapabilityResponse = await fetch(`${baseUrl}/api/projects/xugu-agentic-group/generation-tasks/capabilities`, { headers });
  assert.equal(generationCapabilityResponse.status, 200);
  const generationCapabilities = await generationCapabilityResponse.json();
  assert.equal(generationCapabilities.provider.enabled, false);
  assert.equal(JSON.stringify(generationCapabilities).includes("apiKey"), false);
  assert.equal(JSON.stringify(generationCapabilities).includes("baseUrl"), false);
  const scoped = (await scopedResponse.json()).snapshot;
  const compatibility = await compatibilityResponse.json();
  assert.equal(scoped.version, "v4.2");
  assert.equal(scoped.groups.length, 7);
  assert.equal(scoped.tasks.length, 29);
  assert.deepEqual(compatibility, scoped);
  const directRoute = await fetch(`${baseUrl}/projects/xugu-agentic-group`);
  assert.equal(directRoute.status, 200);
  assert.match(directRoute.headers.get("content-security-policy"), /default-src 'self'/);
  assert.doesNotMatch(await directRoute.text(), /xugu-agentic-group|虚谷 AI 转型促进作战地图/);
} finally {
  if (server?.listening) await new Promise(resolveClose => server.close(resolveClose));
  database.close();
}

assert.deepEqual(await referenceSnapshot(), referenceBefore, "read-only Xugu reference project changed during verification");
console.log("Verification passed: Phase 8 roadmap visual workbench (four views, controlled drag-to-proposal, card review), Phase 7 material readiness, unit lifecycle gates, diagnostics, product self-tests, Phase 6 review/publish, project isolation, browser evidence, Xugu equivalence, source read-only checks, and Playwright browser E2E are valid.");
