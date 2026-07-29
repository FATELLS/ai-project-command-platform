/**
 * 测试 LLM 多模态视觉提取器
 *
 * 验证 PDF 和图片不再依赖 pdftotext / tesseract，
 * 直接走 LLM vision API 提取文本。
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../src/db/database.mjs";
import { createSettingsService } from "../src/services/settings-service.mjs";

const ROOT = resolve(".");
const MATERIALS_DIR = join(ROOT, "mock-materials", "comprehensive");

// 测试材料
const TEST_FILES = [
  { filename: "15-risk-control-report.pdf", ext: ".pdf", label: "PDF 风控立项报告" }
];

async function main() {
  console.log("=== LLM 视觉提取测试 ===\n");

  // 从 DB + env 构建最终 visionConfig（和 server.mjs 逻辑一致）
  const db = openDatabase(join(ROOT, "data", "platform.sqlite"));
  const settingsService = createSettingsService(db);
  const genEnv = settingsService.buildProviderEnvironment("generation");

  const visionConfig = {
    baseUrl: process.env.AI_VISION_BASE_URL || (genEnv.AI_GENERATION_BASE_URL ?? "").replace("/coding/paas/v4", "/paas/v4"),
    apiKey: process.env.AI_VISION_API_KEY || genEnv.AI_GENERATION_API_KEY,
    model: process.env.AI_VISION_MODEL || "",
    timeoutMs: Number(process.env.AI_VISION_TIMEOUT_MS ?? 120_000),
    maxOutputTokens: Number(process.env.AI_VISION_MAX_OUTPUT_TOKENS ?? 1024)
  };

  console.log(`Vision Config:`);
  console.log(`  baseUrl: ${visionConfig.baseUrl}`);
  console.log(`  model: ${visionConfig.model}`);
  console.log(`  apiKey (masked): ${visionConfig.apiKey ? visionConfig.apiKey.slice(0, 8) + "..." : "(empty)"}`);
  console.log(`  maxOutputTokens: ${visionConfig.maxOutputTokens}\n`);

  if (!visionConfig.apiKey || !visionConfig.model) {
    console.error("✗ Vision provider 未配置。请在 .env.local 中设置 AI_VISION_MODEL");
    db.close();
    process.exit(1);
  }

  const { extractMaterial } = await import("../src/materials/extractors/index.mjs");

  for (const tc of TEST_FILES) {
    console.log(`\n测试: ${tc.label} (${tc.filename})`);
    console.log("─".repeat(60));

    const filePath = join(MATERIALS_DIR, tc.filename);
    const fileBuffer = readFileSync(filePath);
    console.log(`  文件大小: ${(fileBuffer.byteLength / 1024).toFixed(1)} KB`);

    // 直接调提取器
    console.log("  调用 LLM 视觉提取...");
    const startTime = Date.now();
    try {
      const result = await extractMaterial(
        { path: filePath, extension: tc.ext },
        { capabilities: { visionConfig } }
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ✓ 提取成功 (${elapsed}s)`);
      console.log(`  ✓ ${result.blocks.length} 个 evidence blocks`);
      console.log(`  ✓ ${result.stats.textBytes} 字符`);
      console.log(`\n  前 5 个 blocks 预览:`);
      for (let i = 0; i < Math.min(5, result.blocks.length); i++) {
        const b = result.blocks[i];
        const preview = b.text.slice(0, 150).replace(/\n/g, " ");
        console.log(`    [${i}] kind=${b.kind} | ${preview}...`);
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  ✗ 提取失败 (${elapsed}s): ${error.message}`);
      console.error(`  code: ${error.code ?? "unknown"}`);
    }
  }

  db.close();
  console.log("\n=== 测试完成 ===");
}

// 加载 .env.local
const envPath = join(ROOT, ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim();
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
