import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { defaultDatabasePath, openDatabase } from "./src/db/database.mjs";
import { applyMigrations } from "./src/db/migrate.mjs";
import { createApp } from "./src/http/app.mjs";
import { importLegacyProject } from "./src/migration/legacy-project.mjs";
import { createProjectRepository } from "./src/repositories/project-repository.mjs";
import { createAuthService } from "./src/services/auth-service.mjs";
import { createSettingsService } from "./src/services/settings-service.mjs";
import { createMaterialProcessingService } from "./src/materials/processing-service.mjs";
import { startMaterialProcessingWorker } from "./src/materials/worker.mjs";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const database = openDatabase(defaultDatabasePath());
let server;
let materialWorker;

try {
  applyMigrations(database);
  const repository = createProjectRepository(database);
  const seedFixturePath = process.env.PLATFORM_SEED_FIXTURE?.trim();
  if (seedFixturePath) {
    const seedProjectId = process.env.PLATFORM_SEED_PROJECT_ID?.trim() || "xugu-agentic-group";
    if (!repository.getProject(seedProjectId)) {
      const fixture = JSON.parse(readFileSync(resolve(seedFixturePath), "utf8"));
      importLegacyProject(database, fixture, { projectId: seedProjectId });
    }
  }

 const authService = createAuthService(database);
  if (!authService.hasPlatformAdmin()) {
    const bootstrapPassword = process.env.PLATFORM_BOOTSTRAP_PASSWORD?.trim();
    const result = authService.ensureBootstrapAdmin({
      loginName: process.env.PLATFORM_BOOTSTRAP_USERNAME || "admin",
      displayName: process.env.PLATFORM_BOOTSTRAP_DISPLAY_NAME || "平台管理员",
      ...(bootstrapPassword ? { password: bootstrapPassword } : {})
    });
    if (result.created) {
      if (result.usedDefaultPassword) {
        console.log(`默认管理员已创建: ${result.loginName} / admin123（首次登录后请立即修改密码）`);
      } else {
        console.log(`Bootstrap administrator created: ${result.loginName}`);
      }
    }
  }

  // 构建 vision 配置给材料提取器（PDF/图片走 LLM 多模态，不依赖 pdftotext/tesseract）
  // Coding Plan 在 /coding/paas/v4 端点上直接支持 glm-4.6v，无需切到 /paas/v4
  // 优先从 DB settings 读（前端保存的），fallback 到 .env.local 的 AI_VISION_*，再 fallback 到 generation 配置
  const settingsService = createSettingsService(database);
  const visionEnv = settingsService.buildProviderEnvironment("vision");
  const genEnv = settingsService.buildProviderEnvironment("generation");
  const visionConfig = {
    baseUrl: visionEnv.AI_VISION_BASE_URL || process.env.AI_VISION_BASE_URL || genEnv.AI_GENERATION_BASE_URL || "",
    apiKey: visionEnv.AI_VISION_API_KEY || process.env.AI_VISION_API_KEY || genEnv.AI_GENERATION_API_KEY || "",
    model: visionEnv.AI_VISION_MODEL || process.env.AI_VISION_MODEL || "glm-4.6v",
    timeoutMs: Number(visionEnv.AI_VISION_TIMEOUT_MS ?? process.env.AI_VISION_TIMEOUT_MS ?? 120_000),
    maxOutputTokens: Number(visionEnv.AI_VISION_MAX_OUTPUT_TOKENS ?? process.env.AI_VISION_MAX_OUTPUT_TOKENS ?? 4_000)
  };

  materialWorker = startMaterialProcessingWorker(createMaterialProcessingService(database, { visionConfig }), {
    onError(error) {
      console.error(`Material processing worker error: ${error?.message ?? error}`);
    }
  });
  server = createServer(createApp({
    database,
    authService,
    secureCookies: ["1", "true"].includes(String(process.env.PLATFORM_COOKIE_SECURE).toLowerCase())
  }));
  server.listen(port, host, () => {
    console.log(`AI Project Command Platform listening on http://${host}:${port}`);
  });
} catch (error) {
  database.close();
  console.error(error.message);
  process.exitCode = 1;
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  if (!server?.listening) {
    await materialWorker?.stop();
    if (database.isOpen) database.close();
    return;
  }
  server.close(async () => {
    await materialWorker?.stop();
    if (database.isOpen) database.close();
  });
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
