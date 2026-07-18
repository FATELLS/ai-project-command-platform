import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = resolve(root, process.argv[2] ?? ".planning/evidence/phase3-browser-matrix.json");
const phase3RequiredCases = [
  "xugu-overview", "xugu-roadmap", "xugu-task-network", "xugu-gantt", "xugu-outcomes",
  "standard-project", "two-project-switch", "draft-module-config", "viewer-permissions",
  "loading-error-empty", "tablet-responsive", "mobile-responsive", "keyboard-reduced-motion",
  "security-payload", "browser-console", "reference-integrity"
];
const phase4RequiredCases = [
  "xugu-material-ledger", "standard-material-ledger", "material-upload-gates", "manual-material",
  "evidence-navigation", "qa-citations", "qa-insufficient", "provider-disabled", "role-permissions",
  "project-switch-clearing", "tablet-responsive", "mobile-responsive", "security-payload",
  "browser-console", "reference-integrity"
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jpegDimensions(bytes) {
  assert.equal(bytes[0], 0xff, "evidence is not a JPEG");
  assert.equal(bytes[1], 0xd8, "evidence is not a JPEG");
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= bytes.length, "invalid JPEG segment");
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions were not found");
}

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.schemaVersion, "1.0.0");
assert.ok(["03-module-registry-project-templates", "04-project-materials-evidence"].includes(manifest.phase), "unsupported browser evidence phase");
assert.ok(manifest.evidence && typeof manifest.evidence === "object");
const phaseNumber = manifest.phase.startsWith("03-") ? "3" : "4";
const requiredCases = phaseNumber === "3" ? phase3RequiredCases : phase4RequiredCases;

for (const [key, item] of Object.entries(manifest.evidence)) {
  assert.match(item.file, new RegExp(`^\\.planning/evidence/phase${phaseNumber}-[a-z0-9-]+\\.jpg$`), `${key} has an unsafe evidence path`);
  const bytes = await readFile(resolve(root, item.file));
  assert.equal(sha256(bytes), item.sha256, `${key} SHA-256 mismatch`);
  assert.deepEqual(jpegDimensions(bytes), { width: item.width, height: item.height }, `${key} dimensions mismatch`);
}

const caseMap = new Map(manifest.cases.map(item => [item.id, item]));
assert.equal(caseMap.size, manifest.cases.length, "browser case IDs must be unique");
for (const id of requiredCases) {
  const item = caseMap.get(id);
  assert.ok(item, `missing required browser case: ${id}`);
  assert.equal(item.status, "PASS", `required browser case is not PASS: ${id}`);
  assert.ok(item.expected?.trim(), `${id} is missing expected assertion`);
  assert.ok(item.actual?.trim(), `${id} is missing actual assertion`);
  assert.ok(manifest.evidence[item.evidence], `${id} references missing evidence`);
}

const referenceRoot = resolve(root, manifest.reference.path);
assert.equal(git(["rev-parse", "HEAD"], referenceRoot), manifest.reference.head, "reference HEAD changed");
assert.equal(git(["status", "--short"], referenceRoot), manifest.reference.statusShort, "reference worktree changed");
const referenceSeed = await readFile(resolve(referenceRoot, "data/state.seed.json"));
assert.equal(sha256(referenceSeed), manifest.reference.seedSha256, "reference seed changed");

console.log(`Browser evidence passed: ${requiredCases.length} required PASS cases, ${Object.keys(manifest.evidence).length} verified screenshots, reference unchanged.`);
