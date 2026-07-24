import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { defaultDatabasePath, openDatabase } from "./src/db/database.mjs";
import { applyMigrations } from "./src/db/migrate.mjs";
import { createApp } from "./src/http/app.mjs";
import { importLegacyProject } from "./src/migration/legacy-project.mjs";
import { createProjectRepository } from "./src/repositories/project-repository.mjs";
import { createAuthService } from "./src/services/auth-service.mjs";
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
    const bootstrapPassword = process.env.PLATFORM_BOOTSTRAP_PASSWORD;
    if (!bootstrapPassword) {
      throw new Error("首次启动需要设置 PLATFORM_BOOTSTRAP_PASSWORD（至少 12 个字符）");
    }
    const result = authService.ensureBootstrapAdmin({
      loginName: process.env.PLATFORM_BOOTSTRAP_USERNAME || "admin",
      displayName: process.env.PLATFORM_BOOTSTRAP_DISPLAY_NAME || "平台管理员",
      password: bootstrapPassword
    });
    if (result.created) console.log(`Bootstrap administrator created: ${result.loginName}`);
  }

  materialWorker = startMaterialProcessingWorker(createMaterialProcessingService(database), {
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
