#!/usr/bin/env node
// ============================================================
// 用 @yao-pkg/pkg 将 Node.js 应用打包成单文件二进制
// 输出: dist/ai-platform-linux-x64, dist/ai-platform-macos-arm64 等
// ============================================================

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(root, "dist");

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

const TARGETS = [
  "node22-linux-x64",
  "node22-macos-x64",
  "node22-macos-arm64",
  "node22-win-x64",
];

const pkgVersion = "6.1.0"; // @yao-pkg/pkg fork，支持 Node 22

async function main() {
  console.log("=== 构建原生二进制 ===\n");

  // 动态引入 pkg
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  // 确认 pkg 已安装
  try {
    await execAsync("npx --yes @yao-pkg/pkg --version");
  } catch {
    console.log("安装 @yao-pkg/pkg...");
    await execAsync("npm install --save-dev @yao-pkg/pkg", { cwd: root });
  }

  // 只构建当前平台（快速测试用），ALL_PLATFORMS=1 构建全平台
  const buildAll = process.env.ALL_PLATFORMS === "1";
  const targets = buildAll ? TARGETS : [TARGETS[0]];

  for (const target of targets) {
    console.log(`构建 ${target}...`);
    try {
      await execAsync(
        `npx @yao-pkg/pkg . --targets ${target} --output dist/ai-platform-${target}`,
        { cwd: root }
      );
      console.log(`  完成: dist/ai-platform-${target}`);
    } catch (e) {
      console.error(`  失败: ${e.message}`);
    }
  }

  console.log("\n=== 构建完成 ===");
  console.log(`输出目录: ${distDir}`);
}

main();
