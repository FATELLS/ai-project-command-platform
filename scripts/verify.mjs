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
  "fixtures/projects/xugu-agentic-group.json",
  "src/db/migrations/001_initial.sql"
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
  "src/migration/legacy-project.mjs",
  "src/repositories/project-repository.mjs"
]) run(process.execPath, ["--check", file]);
run(process.execPath, ["--test"]);

const tracked = run("git", ["ls-files"], { capture: true }).split("\n").filter(Boolean);
const forbiddenTracked = tracked.filter(file =>
  file === ".env" || file === "data/ai-config.json" ||
  /^data\/(?:uploads|processed)\//.test(file) || /\.sqlite(?:-wal|-shm)?$/.test(file)
);
assert.deepEqual(forbiddenTracked, [], `runtime or sensitive files are tracked: ${forbiddenTracked.join(", ")}`);

const runtimeDir = await mkdtemp(join(tmpdir(), "platform-verify-"));
const database = openDatabase(join(runtimeDir, "platform.sqlite"));
const server = createServer(createApp({ database }));
try {
  assert.deepEqual(applyMigrations(database), ["001_initial.sql"]);
  assert.deepEqual(applyMigrations(database), []);
  const imported = importLegacyProject(database, fixture, {
    projectId: "xugu-agentic-group",
    now: "2026-07-18T00:00:00.000Z"
  });
  assert.equal(imported.validation.published.units, 7);
  assert.equal(imported.validation.published.tasks, 29);
  assert.deepEqual(exportLegacyProject(database, "xugu-agentic-group"), fixture);

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  const scopedResponse = await fetch(`http://127.0.0.1:${port}/api/projects/xugu-agentic-group/public`);
  const compatibilityResponse = await fetch(`http://127.0.0.1:${port}/api/public`);
  assert.equal(scopedResponse.status, 200);
  assert.equal(compatibilityResponse.status, 200);
  const scoped = await scopedResponse.json();
  const compatibility = await compatibilityResponse.json();
  assert.equal(scoped.version, "v4.2");
  assert.equal(scoped.groups.length, 7);
  assert.equal(scoped.tasks.length, 29);
  assert.deepEqual(compatibility, scoped);
} finally {
  if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
  database.close();
}

assert.deepEqual(await referenceSnapshot(), referenceBefore, "read-only Xugu reference project changed during verification");
console.log("Verification passed: Phase 1 SQLite, Xugu migration, project isolation, and API compatibility are valid.");
