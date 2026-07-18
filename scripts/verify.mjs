import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  "src/materials/policy.mjs",
  "src/materials/storage.mjs",
  "src/materials/material-repository.mjs",
  "src/materials/ingest-service.mjs",
  "src/materials/processing-service.mjs",
  "src/materials/evidence-service.mjs",
  "src/materials/extractors/index.mjs",
  "src/ai/retriever.mjs",
  "src/ai/prompt-builder.mjs",
  "src/ai/answer-validator.mjs",
  "src/ai/provider-factory.mjs",
  "src/ai/quota.mjs",
  "src/ai/providers/disabled-provider.mjs",
  "src/ai/providers/fake-provider.mjs",
  "src/ai/providers/openai-compatible-provider.mjs",
  "src/services/material-service.mjs",
  "src/services/chat-service.mjs",
  "src/templates/catalog.mjs",
  "src/templates/template-validator.mjs",
  "src/modules/registry.mjs",
  "src/modules/schemas.mjs",
  "src/modules/loaders.mjs",
  "src/modules/module-service.mjs",
  "scripts/seed-project-fixture.mjs",
  "scripts/verify-browser-evidence.mjs",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/modules/registry.js",
  "public/modules/shared.js",
  "public/modules/renderers.js",
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
  "test/material-ui-server.test.mjs"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`);
  }
  return options.capture ? result.stdout.trim() : "";
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
  "src/materials/extractors/common.mjs",
  "src/materials/extractors/text.mjs",
  "src/materials/extractors/ooxml.mjs",
  "src/materials/extractors/pdf.mjs",
  "src/materials/extractors/image.mjs",
  "src/materials/extractors/subprocess.mjs",
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
  "src/repositories/auth-repository.mjs",
  "src/repositories/project-repository.mjs",
  "src/security/passwords.mjs",
  "src/security/sessions.mjs",
  "src/services/auth-service.mjs",
  "src/services/project-service.mjs",
  "src/services/material-service.mjs",
  "src/services/chat-service.mjs",
  "scripts/seed-project-fixture.mjs",
  "scripts/verify-browser-evidence.mjs",
  "public/app.js",
  "public/modules/registry.js",
  "public/modules/shared.js",
  "public/modules/renderers.js"
]) run(process.execPath, ["--check", file]);
run(process.execPath, ["--test"]);
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
  assert.deepEqual(applyMigrations(database), ["001_initial.sql", "002_auth_project_access.sql", "003_module_registry_templates.sql", "004_materials_evidence.sql"]);
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
console.log("Verification passed: Phase 4 secure materials, bounded evidence, cited no-key RAG, project isolation, Phase 3 browser evidence, Xugu equivalence, and source read-only checks are valid.");
