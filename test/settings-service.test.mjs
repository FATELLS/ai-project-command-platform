import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createSettingsService } from "../src/services/settings-service.mjs";

test("platform admin can test saved AI connections without exposing the key", async () => {
  const database = openDatabase(":memory:");
  applyMigrations(database);
  let receivedEnvironment;
  const provider = {
    configured: true,
    safeLabel: "test-provider",
    async generate(request) {
      assert.equal(request.messages.at(-1).content, "OK");
      return { content: "OK", providerLabel: "test-provider", usage: { input: 1, output: 1 } };
    }
  };
  const service = createSettingsService(database, {
    createChatProvider(environment) {
      receivedEnvironment = environment;
      return provider;
    },
    createGenerationProvider() {
      return provider;
    }
  });
  const admin = { isPlatformAdmin: true };

  service.updateAiChatConfig(admin, {
    provider: "openai-compatible",
    baseUrl: "https://api.example.test/v1",
    apiKey: "secret-test-key",
    model: "test-model",
    allowedHosts: "api.example.test"
  });

  const result = await service.testConnection(admin, "chat");
  assert.equal(result.ok, true);
  assert.equal(result.providerLabel, "test-provider");
  assert.equal(receivedEnvironment.AI_CHAT_API_KEY, "secret-test-key");
  assert.equal(Object.hasOwn(result, "apiKey"), false);
  await assert.rejects(service.testConnection({ id: "viewer", isPlatformAdmin: false }, "chat"), error => error.code === "FORBIDDEN");
  database.close();
});
