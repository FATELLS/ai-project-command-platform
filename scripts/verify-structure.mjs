#!/usr/bin/env node
/**
 * Structure verification script.
 * Checks that the V2 workspace structure conforms to PROJECT-STRUCTURE.md.
 *
 * Run: node scripts/verify-structure.mjs
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function checkDir(path, shouldExist = true) {
  const exists = existsSync(join(root, path));
  if (shouldExist && !exists) {
    errors.push(`Missing directory: ${path}`);
  }
  if (!shouldExist && exists) {
    errors.push(`Forbidden directory exists: ${path}`);
  }
}

function checkFile(path, shouldExist = true) {
  const exists = existsSync(join(root, path));
  if (shouldExist && !exists) {
    errors.push(`Missing file: ${path}`);
  }
}

// === Required top-level structure ===
const requiredDirs = [
  ".github",
  ".specify",
  "apps/api/src",
  "apps/web/src",
  "packages/contracts/src",
  "packages/database/src",
  "packages/domain/src",
  "packages/test-kit/src",
  "specs",
  "docs/product",
  "docs/architecture",
  "docs/adr",
  "docs/engineering",
  "docs/operations",
  "docs/changes",
  "tests",
  "ops",
];

for (const dir of requiredDirs) {
  checkDir(dir);
}

// === Required root files ===
const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "tsconfig.base.json",
  ".gitignore",
  "docs/REFACTOR-PLAN.md",
  ".specify/memory/constitution.md",
  "docs/architecture/PROJECT-STRUCTURE.md",
  "docs/architecture/MIGRATION-MAP.md",
];

for (const file of requiredFiles) {
  checkFile(file);
}

// === Forbidden directories ===
const forbiddenDirs = [
  "utils",
  "helpers",
  "common",
  "misc",
];

for (const dir of forbiddenDirs) {
  checkDir(dir, false);
}

// === Report ===
console.log("\n=== Structure Verification ===\n");

if (errors.length > 0) {
  console.error(`❌ ${errors.length} error(s):`);
  for (const e of errors) {
    console.error(`   - ${e}`);
  }
  process.exit(1);
}

console.log(`✅ All ${requiredDirs.length} required directories present`);
console.log(`✅ All ${requiredFiles.length} required files present`);
console.log(`✅ No forbidden catch-all directories (${forbiddenDirs.join(", ")})`);
console.log("\nStructure verification PASSED.\n");
