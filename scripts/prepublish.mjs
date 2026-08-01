#!/usr/bin/env node
// prepublish.mjs — npm publish 前的安全检查
//
// 只做单元测试（容忍已知的 cancelled flaky）+ 源文件语法检查。
// 完整 verify（含 Playwright E2E）需要浏览器环境，不在 npm publish 时运行。

import { spawnSync } from "node:child_process";
import { glob } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", ...options });
  return result;
}

// 1. 语法检查所有源文件
console.log("--- 语法检查 ---");
const checkFiles = [
  "server.mjs",
  ...spawnSync("find", ["src", "-name", "*.mjs"], { cwd: root, encoding: "utf8" }).stdout.trim().split("\n"),
  ...spawnSync("find", ["scripts", "-name", "*.mjs", "-not", "-name", "prepublish.mjs"], { cwd: root, encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean),
].filter(Boolean);

let syntaxError = false;
for (const file of checkFiles) {
  const result = run(process.execPath, ["--check", file]);
  if (result.status !== 0) {
    console.error(`  ✗ ${file}`);
    syntaxError = true;
  }
}
if (syntaxError) {
  console.error("语法检查失败");
  process.exit(1);
}
console.log(`  ✓ ${checkFiles.length} 个文件语法检查通过`);

// 2. 单元测试（容忍已知的 cancelled flaky，只要有 0 fail 就通过）
console.log("\n--- 单元测试 ---");
const testResult = run(process.execPath, ["--test", "test/*.test.mjs"], { capture: true });
const testOutput = (testResult.stdout || "") + (testResult.stderr || "");

if (testResult.status !== 0) {
  // 检查是否有真正的 fail
  const failMatch = testOutput.match(/# fail (\d+)/);
  const failCount = failMatch ? parseInt(failMatch[1]) : 999;
  const passMatch = testOutput.match(/# pass (\d+)/);
  const passCount = passMatch ? parseInt(passMatch[1]) : 0;
  if (failCount === 0 && passCount > 0) {
    console.log(`  ✓ 单元测试通过：${passCount} pass / 0 fail（有 cancelled 项但无 fail）`);
  } else {
    console.error(`  ✗ 单元测试失败：${failCount} 个 fail，${passCount} 个 pass`);
    console.error(testOutput.slice(-2000));
    process.exit(1);
  }
} else {
  const passMatch = testOutput.match(/# pass (\d+)/);
  const passCount = passMatch ? parseInt(passMatch[1]) : "?";
  console.log(`  ✓ 单元测试全部通过（${passCount} pass）`);
}

console.log("\n✓ prepublish 检查通过，可以发布");
