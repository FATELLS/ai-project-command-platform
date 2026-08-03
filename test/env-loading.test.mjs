import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("env file loading", () => {
  let rootDir;
  let savedGenerationModel;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "platform-env-"));
    savedGenerationModel = process.env.AI_GENERATION_MODEL;
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    if (savedGenerationModel === undefined) delete process.env.AI_GENERATION_MODEL;
    else process.env.AI_GENERATION_MODEL = savedGenerationModel;
  });

  test("parseEnvFile parses KEY=VALUE correctly", async () => {
    writeFileSync(join(rootDir, ".env"), [
      "# comment line",
      "",
      "TEST_ENV_VAR_1=hello",
      "TEST_ENV_VAR_2=world",
    ].join("\n"));

    const environment = {};
    const { loadEnvFiles } = await import("../src/config/local-config.mjs");
    loadEnvFiles({ rootDir, environment, quiet: true });
    assert.equal(environment.TEST_ENV_VAR_1, "hello");
    assert.equal(environment.TEST_ENV_VAR_2, "world");
  });

  test("loadEnvFiles does not override existing process.env values", async () => {
    writeFileSync(join(rootDir, ".env.local"), "AI_GENERATION_MODEL=from-file\n");
    const environment = { AI_GENERATION_MODEL: "preset-by-shell" };
    const { loadEnvFiles } = await import("../src/config/local-config.mjs");
    loadEnvFiles({ rootDir, environment, quiet: true });
    assert.equal(environment.AI_GENERATION_MODEL, "preset-by-shell");
  });

  test("loadEnvFiles applies .env.local over .env as one merged file layer", async () => {
    writeFileSync(join(rootDir, ".env"), "AI_GENERATION_PROVIDER=disabled\nSHARED=base\n");
    writeFileSync(join(rootDir, ".env.local"), "AI_GENERATION_PROVIDER=openai-compatible\n");
    const environment = {};
    const { loadEnvFiles } = await import("../src/config/local-config.mjs");
    loadEnvFiles({ rootDir, environment, quiet: true });
    assert.equal(environment.AI_GENERATION_PROVIDER, "openai-compatible");
    assert.equal(environment.SHARED, "base");
  });

  test("loadLocalConfigToEnv does not override existing env vars", async () => {
    // 设置一个已有值
    process.env.AI_GENERATION_MODEL = "shell-preset";

    const { loadLocalConfigToEnv } = await import("../src/config/local-config.mjs");
    loadLocalConfigToEnv();

    // .api-keys.local.json 的 glm-4.6 不应覆盖
    assert.equal(
      process.env.AI_GENERATION_MODEL,
      "shell-preset",
      "环境变量应优先于 .api-keys.local.json"
    );
  });
});
