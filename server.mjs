#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadRuntimeConfig } from "./src/config/local-config.mjs";

// 配置加载顺序（严格）：
//   1. loadEnvFiles()  → .env / .env.local（已有的 process.env 值优先不被覆盖）
//   2. loadLocalConfigToEnv() → .api-keys.local.json（仅在环境变量为空时注入）
// 这确保源码运行和 portable 包使用同一配置源。
loadRuntimeConfig();

import { openDatabase } from "./src/db/database.mjs";
import { applyMigrations } from "./src/db/migrate.mjs";
import { createApp } from "./src/http/app.mjs";
import { importLegacyProject } from "./src/migration/legacy-project.mjs";
import { createProjectRepository } from "./src/repositories/project-repository.mjs";
import { createAuthService } from "./src/services/auth-service.mjs";
import { createSettingsService } from "./src/services/settings-service.mjs";
import { createMaterialProcessingService } from "./src/materials/processing-service.mjs";
import { startMaterialProcessingWorker } from "./src/materials/worker.mjs";
import { validateProviderConfig } from "./src/ai/providers/openai-compatible-provider.mjs";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
async function connectDatabase() {
  const timeoutMs = Number(process.env.XUGU_CONNECT_TIMEOUT_MS || 420_000);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return openDatabase();
    } catch {
      if (Date.now() >= deadline) {
        const error = new Error("Xugu connection deadline exceeded");
        error.code = "XUGU_CONNECT_TIMEOUT";
        throw error;
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 1_000));
    }
  }
}

const database = await connectDatabase();
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
  // 优先从 DB settings 读（前端保存的），fallback 到 .env.local 的 AI_VISION_*，再 fallback 到 generation 配置
  const settingsService = createSettingsService(database);
  const visionEnv = settingsService.buildProviderEnvironment("vision");
  const genEnv = settingsService.buildProviderEnvironment("generation");
  const chatEnv = settingsService.buildProviderEnvironment("chat");

  // 启动时 AI 配置健康检查——提前暴露"配了但调不通"的问题
  for (const [scope, env] of [["chat", chatEnv], ["generation", genEnv], ["vision", visionEnv]]) {
    const prefix = scope === "generation" ? "AI_GENERATION" : scope === "vision" ? "AI_VISION" : "AI_CHAT";
    const provider = env[`${prefix}_PROVIDER`];
    if (provider && provider !== "disabled" && env[`${prefix}_API_KEY`]) {
      try {
        validateProviderConfig({
          baseUrl: env[`${prefix}_BASE_URL`],
          apiKey: env[`${prefix}_API_KEY`],
          model: env[`${prefix}_MODEL`],
          allowedHosts: String(env[`${prefix}_ALLOWED_HOSTS`] ?? "").split(",").map(v => v.trim()).filter(Boolean),
          reasoningEffort: env[`${prefix}_REASONING_EFFORT`] || undefined
        });
        console.log(`  AI ${scope}: ${provider} / ${env[`${prefix}_MODEL`]} — 配置校验通过`);
      } catch (configError) {
        console.warn(`  ⚠ AI ${scope} 配置有误 | code=${configError?.code ?? "AI_PROVIDER_CONFIG_INVALID"}`);
        console.warn(`    请在设置页（/settings）检查并重新保存 AI ${scope} 配置，保存时系统会自动补全白名单。`);
      }
    }
  }
  const visionConfig = {
    baseUrl: visionEnv.AI_VISION_BASE_URL || process.env.AI_VISION_BASE_URL || genEnv.AI_GENERATION_BASE_URL || "",
    apiKey: visionEnv.AI_VISION_API_KEY || process.env.AI_VISION_API_KEY || genEnv.AI_GENERATION_API_KEY || "",
    model: visionEnv.AI_VISION_MODEL || process.env.AI_VISION_MODEL || genEnv.AI_GENERATION_MODEL || "",
    timeoutMs: Number(visionEnv.AI_VISION_TIMEOUT_MS ?? process.env.AI_VISION_TIMEOUT_MS ?? 120_000),
    maxOutputTokens: Number(visionEnv.AI_VISION_MAX_OUTPUT_TOKENS ?? process.env.AI_VISION_MAX_OUTPUT_TOKENS ?? 4_000)
  };

  materialWorker = startMaterialProcessingWorker(createMaterialProcessingService(database, { visionConfig }), {
    onError(error) {
      console.error(`Material processing worker error | code=${error?.code ?? "MATERIAL_WORKER_ERROR"}`);
    }
  });
  server = createServer(createApp({
    database,
    authService,
    secureCookies: ["1", "true"].includes(String(process.env.PLATFORM_COOKIE_SECURE).toLowerCase())
  }));
  server.listen(port, host, () => {
    console.log(`AI Project Command Platform listening on http://${host}:${port}`);
    console.log("  数据库后端: 虚谷数据库 (XuGu)");
    console.log(`  配置入口: 平台设置 → AI 配置（首次使用请在网页后台填写 provider/baseUrl/apiKey/model）`);
  });
} catch (error) {
  database.close?.();
  console.error(`Platform startup failed | code=${error?.code ?? "PLATFORM_STARTUP_FAILED"}`);
  process.exitCode = 1;
}

let shutdownPromise;

function closeHttpServer() {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    server.close(error => error ? rejectClose(error) : resolveClose());
    server.closeIdleConnections?.();
  });
}

function closeDatabase() {
  if (database.isOpen === false) return;
  database.close?.();
}

async function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`正在停止平台服务（${signal}）...`);
    const httpClosed = closeHttpServer();
    await materialWorker?.stop();
    await httpClosed;
    closeDatabase();
    console.log("平台服务已停止。");
  })().catch(error => {
    console.error(`平台服务停止失败 | code=${error?.code ?? "PLATFORM_SHUTDOWN_FAILED"}`);
    process.exitCode = 1;
  });
  return shutdownPromise;
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
