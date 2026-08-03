#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { arch } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const legacyBackendName = ["sql", "ite"].join("");
const legacyJsPackage = ["sql", ".js"].join("");
const legacyBackendSwitch = ["PLATFORM", "DB", "BACKEND"].join("_");
const required = [
  "AGENTS.md",
  "AI-SPEC.md",
  "README.md",
  "server.mjs",
  "src/db/database.mjs",
  "src/db/xugu-database.cjs",
  "src/db/xugu-worker.cjs",
  "src/db/xugu-migrations/001_initial.sql",
  "src/db/xugu-migrations/008_unified_cards.sql",
  "test/xugu-integration.test.mjs",
  "vendor/xugudb/image/manifest.json",
  "vendor/xugudb/nodejs/xugudbjs.node",
  "vendor/xugudb/nodejs/xugudbjs-linux-aarch64.node", ".planning/design/system/README.md",
  ".planning/design/system/SYSTEM-SPEC.md",
  ".planning/design/system/ARCHITECTURE.md",
  ".planning/design/system/TRACEABILITY.md",
  ".planning/design/system/V1-CONSOLIDATION.md",
  "docs/RESULT.md"
];

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else output.push(path);
  }
  return output;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

for (const name of required) {
  assert.ok(existsSync(join(root, name)), `required release file is missing: ${name}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.match(process.version, /^v20\./, "Node.js 20.x is required by the bundled native driver");
for (const dependency of [legacyBackendName, legacyJsPackage, "odbc", "deasync"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined, `obsolete persistence dependency remains: ${dependency}`);
  assert.equal(packageJson.devDependencies?.[dependency], undefined, `obsolete persistence dependency remains: ${dependency}`);
}

const manifestPath = join(root, "vendor/xugudb/image/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.databasePort, 5138);

// schemaVersion 2: 多架构 images；schemaVersion 1: 单架构顶层（向后兼容）
if (manifest.images) {
  assert.ok(manifest.images.arm64, "manifest missing arm64 image entry");
  const armEntry = manifest.images.arm64;
  const armArchive = join(root, "vendor/xugudb/image", armEntry.archive);
  assert.ok(armEntry.archiveSha256, "arm64 image archiveSha256 is required");
  assert.ok(statSync(armArchive).size > 1024 * 1024, "bundled Xugu ARM64 image archive is unexpectedly small");
  assert.equal(sha256(armArchive), armEntry.archiveSha256, "bundled Xugu ARM64 image checksum mismatch");

  // amd64 镜像如果存在则校验
  const ar = arch();
  const dockerArch = ar === "x64" || ar === "x86_64" ? "amd64" : ar;
  const currentEntry = manifest.images[dockerArch];
  if (currentEntry && currentEntry.archiveSha256 && existsSync(join(root, "vendor/xugudb/image", currentEntry.archive))) {
    const currentArchive = join(root, "vendor/xugudb/image", currentEntry.archive);
    assert.ok(statSync(currentArchive).size > 1024 * 1024, `bundled Xugu ${dockerArch} image archive is unexpectedly small`);
    assert.equal(sha256(currentArchive), currentEntry.archiveSha256, `bundled Xugu ${dockerArch} image checksum mismatch`);
  }
} else {
  // v1 向后兼容
  assert.equal(manifest.architecture, "arm64");
  const imageArchive = join(root, "vendor/xugudb/image", manifest.archive);
  assert.ok(statSync(imageArchive).size > 1024 * 1024, "bundled Xugu image archive is unexpectedly small");
  assert.equal(sha256(imageArchive), manifest.archiveSha256, "bundled Xugu image checksum mismatch");
}

const sourceFiles = [
  ...await filesUnder(join(root, "src")),
  ...await filesUnder(join(root, "scripts")),
  ...await filesUnder(join(root, "test")),
  ...await filesUnder(join(root, "packaging")),
  ...await filesUnder(join(root, ".github")),
  ...await filesUnder(join(root, "docs")),
  ...await filesUnder(join(root, ".planning", "design", "system")),
  join(root, "server.mjs"),
  join(root, "package.json"),
  join(root, "README.md"),
  join(root, "AGENTS.md")
].filter(path => path !== join(root, "scripts", "verify.mjs") && [".mjs", ".cjs", ".js", ".sql", ".json", ".md", ".yml", ".yaml", ".sh", ".ps1"].includes(extname(path)));

const forbiddenPatterns = [
  [new RegExp(legacyBackendName, "i"), "obsolete database backend reference"],
  [new RegExp(legacyJsPackage.replace(".", "\\."), "i"), "obsolete database package reference"],
  [new RegExp(legacyBackendSwitch, "i"), "obsolete backend switch"],
  [/\bAUTOINCREMENT\b|\bPRAGMA\b|\bINSERT\s+OR\b|\bON\s+CONFLICT\b|\bCOLLATE\s+NOCASE\b|\bjson_extract\b/i, "incompatible SQL syntax"]
];
for (const path of sourceFiles) {
  const content = await readFile(path, "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    assert.equal(pattern.test(content), false, `${label}: ${relative(root, path)}`);
  }
}

const codeFiles = sourceFiles.filter(path => [".mjs", ".cjs", ".js"].includes(extname(path)));
for (const path of codeFiles) run(process.execPath, ["--check", path]);

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const forbiddenTracked = tracked.filter(file =>
  (file !== ".env.example" && /^\.env(?:\.|$)/.test(file)) ||
  file === "data/ai-config.json" ||
  /^(?:data|runtime|storage)\/(?:uploads|processed|materials|logs)\//.test(file) ||
  /\.(?:pem|key|p12|log)$/.test(file)
);
assert.deepEqual(forbiddenTracked, [], `runtime or sensitive files are tracked: ${forbiddenTracked.join(", ")}`);

const referenceSeed = resolve(root, "../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/data/state.seed.json");
if (existsSync(referenceSeed)) {
  assert.equal(
    sha256(join(root, "fixtures/projects/xugu-agentic-group.json")),
    sha256(referenceSeed),
    "Xugu migration fixture no longer matches the read-only source application"
  );
}

console.log("Static release checks passed: Xugu image, drivers, source syntax, persistence boundary and tracked artifacts.");
