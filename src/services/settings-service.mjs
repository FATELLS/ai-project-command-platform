import { withTransaction } from "../db/database.mjs";
import { upsert } from "../db/sql-dialect.mjs";
import { createGenerationProviderFromEnv, createProviderFromEnv } from "../ai/provider-factory.mjs";

const KEYS = Object.freeze({
  chatProvider: "ai_chat",
  generationProvider: "ai_generation",
  visionProvider: "ai_vision"
});

function readSetting(database, key) {
  const row = database.prepare("SELECT value_json AS v FROM platform_settings WHERE key = ?").get(key);
  return row ? JSON.parse(row.v) : {};
}

function writeSetting(database, key, value, userId) {
  const at = new Date().toISOString();
  withTransaction(database, () => {
    upsert(database, "platform_settings",
      ["key", "value_json", "updated_at", "updated_by"],
      [key, JSON.stringify(value), at, userId ?? null],
      ["key"],
      ["value_json", "updated_at", "updated_by"]
    );
  });
}

function sanitizeProviderConfig(input) {
  const result = {};
  const provider = String(input.provider ?? "disabled");
  result.provider = provider === "openai-compatible" ? "openai-compatible" : "disabled";
  result.baseUrl = String(input.baseUrl ?? "").trim();
  result.model = String(input.model ?? "").trim();
  result.allowedHosts = String(input.allowedHosts ?? "").trim();
  result.reasoningEffort = String(input.reasoningEffort ?? "").trim() || undefined;
  result.providerLabel = String(input.providerLabel ?? "").trim() || undefined;
  result.timeoutMs = Math.max(1_000, Math.min(600_000, Number(input.timeoutMs) || 60_000));
  result.maxOutputTokens = Math.max(100, Math.min(8_000, Number(input.maxOutputTokens) || 8_000));
  // API key: only store if explicitly provided; keep existing if empty string sent
  result.apiKey = input.apiKey;
  return result;
}

/**
 * 视觉模型配置 — 用于 PDF/图片的多模态提取。
 * 与普通 provider 配置的差异：maxOutputTokens 上限放宽到 16_000（长文档提取需要更多 token）。
 */
function sanitizeVisionProviderConfig(input) {
  const result = {};
  const provider = String(input.provider ?? "disabled");
  result.provider = provider === "openai-compatible" ? "openai-compatible" : "disabled";
  result.baseUrl = String(input.baseUrl ?? "").trim();
  result.model = String(input.model ?? "").trim();
  result.allowedHosts = String(input.allowedHosts ?? "").trim();
  result.providerLabel = String(input.providerLabel ?? "").trim() || undefined;
  result.timeoutMs = Math.max(1_000, Math.min(600_000, Number(input.timeoutMs) || 120_000));
  result.maxOutputTokens = Math.max(100, Math.min(16_000, Number(input.maxOutputTokens) || 4_000));
  result.apiKey = input.apiKey;
  return result;
}

export function createSettingsService(database, options = {}) {
  function getAiChatConfig() {
    return readSetting(database, KEYS.chatProvider);
  }

  function getAiGenerationConfig() {
    return readSetting(database, KEYS.generationProvider);
  }

  function getAiVisionConfig() {
    return readSetting(database, KEYS.visionProvider);
  }

  function getAllSettings() {
    const chat = getAiChatConfig();
    const generation = getAiGenerationConfig();
    const vision = getAiVisionConfig();
    return {
      aiChat: {
        provider: chat.provider ?? "disabled",
        baseUrl: chat.baseUrl ?? "",
        model: chat.model ?? "",
        allowedHosts: chat.allowedHosts ?? "",
        apiKeyMasked: chat.apiKey ? maskKey(chat.apiKey) : "",
        apiKeySet: Boolean(chat.apiKey)
      },
      aiGeneration: {
        provider: generation.provider ?? "disabled",
        baseUrl: generation.baseUrl ?? "",
        model: generation.model ?? "",
        allowedHosts: generation.allowedHosts ?? "",
        reasoningEffort: generation.reasoningEffort ?? "",
        providerLabel: generation.providerLabel ?? "",
        timeoutMs: generation.timeoutMs ?? 60_000,
        maxOutputTokens: generation.maxOutputTokens ?? 8_000,
        apiKeyMasked: generation.apiKey ? maskKey(generation.apiKey) : "",
        apiKeySet: Boolean(generation.apiKey)
      },
      aiVision: {
        provider: vision.provider ?? "disabled",
        baseUrl: vision.baseUrl ?? "",
        model: vision.model ?? "",
        allowedHosts: vision.allowedHosts ?? "",
        providerLabel: vision.providerLabel ?? "",
        timeoutMs: vision.timeoutMs ?? 120_000,
        maxOutputTokens: vision.maxOutputTokens ?? 4_000,
        apiKeyMasked: vision.apiKey ? maskKey(vision.apiKey) : "",
        apiKeySet: Boolean(vision.apiKey)
      }
    };
  }

  function updateAiChatConfig(principal, input) {
    const sanitized = sanitizeProviderConfig(input);
    if (!sanitized.apiKey) {
      // Keep existing key if not provided
      const existing = getAiChatConfig();
      sanitized.apiKey = existing.apiKey;
    }
    writeSetting(database, KEYS.chatProvider, sanitized, principal.id);
 return { ok: true };
  }

  function updateAiGenerationConfig(principal, input) {
    const sanitized = sanitizeProviderConfig(input);
    if (!sanitized.apiKey) {
      const existing = getAiGenerationConfig();
      sanitized.apiKey = existing.apiKey;
    }
    writeSetting(database, KEYS.generationProvider, sanitized, principal.id);
 return { ok: true };
  }

  function updateAiVisionConfig(principal, input) {
    const sanitized = sanitizeVisionProviderConfig(input);
    if (!sanitized.apiKey) {
      const existing = getAiVisionConfig();
      sanitized.apiKey = existing.apiKey;
    }
    writeSetting(database, KEYS.visionProvider, sanitized, principal.id);
    return { ok: true };
  }

  function buildProviderEnvironment(scope) {
    // Merge DB settings over process.env so DB takes priority
    const config = scope === "generation" ? getAiGenerationConfig()
      : scope === "vision" ? getAiVisionConfig()
      : getAiChatConfig();
    const prefix = scope === "generation" ? "AI_GENERATION"
      : scope === "vision" ? "AI_VISION"
      : "AI_CHAT";
    const env = { ...process.env };
    if (config.provider) env[`${prefix}_PROVIDER`] = config.provider;
    if (config.baseUrl) env[`${prefix}_BASE_URL`] = config.baseUrl;
    if (config.apiKey) env[`${prefix}_API_KEY`] = config.apiKey;
    if (config.model) env[`${prefix}_MODEL`] = config.model;
    if (config.allowedHosts) env[`${prefix}_ALLOWED_HOSTS`] = config.allowedHosts;
    if (config.reasoningEffort !== undefined) env[`${prefix}_REASONING_EFFORT`] = config.reasoningEffort ?? "";
    if (config.providerLabel !== undefined) env[`${prefix}_PROVIDER_LABEL`] = config.providerLabel ?? "";
    if (config.timeoutMs) env[`${prefix}_TIMEOUT_MS`] = String(config.timeoutMs);
    if (config.maxOutputTokens) env[`${prefix}_MAX_OUTPUT_TOKENS`] = String(config.maxOutputTokens);
    return env;
  }

  async function testConnection(principal, scope) {
    if (!principal?.isPlatformAdmin) {
      const error = new Error("仅平台管理员可测试 AI 连接");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }
    if (!["chat", "generation", "vision"].includes(scope)) {
      const error = new Error("未知的 AI 服务类型");
      error.status = 400;
      error.code = "INVALID_AI_SCOPE";
      throw error;
    }
    const environment = buildProviderEnvironment(scope);
    const startedAt = Date.now();
    try {
      const provider = scope === "generation"
        ? (options.createGenerationProvider ?? createGenerationProviderFromEnv)(environment)
        : scope === "vision"
          ? (options.createChatProvider ?? createProviderFromEnv)({
              ...environment,
              AI_CHAT_PROVIDER: environment.AI_VISION_PROVIDER,
              AI_CHAT_BASE_URL: environment.AI_VISION_BASE_URL,
              AI_CHAT_API_KEY: environment.AI_VISION_API_KEY,
              AI_CHAT_MODEL: environment.AI_VISION_MODEL,
              AI_CHAT_ALLOWED_HOSTS: environment.AI_VISION_ALLOWED_HOSTS,
              AI_CHAT_TIMEOUT_MS: environment.AI_VISION_TIMEOUT_MS
            })
          : (options.createChatProvider ?? createProviderFromEnv)(environment);
      const result = await provider.generate({
        messages: [
          { role: "system", content: "You are a connection health check. Reply with OK." },
          { role: "user", content: "OK" }
        ]
      });
      return {
        ok: true,
        scope,
        providerLabel: result.providerLabel ?? provider.safeLabel ?? "openai-compatible",
        latencyMs: Math.max(0, Date.now() - startedAt)
      };
    } catch (cause) {
      if (Number.isInteger(cause?.status) && typeof cause?.code === "string") throw cause;
      const error = new Error("AI 连接配置无效，请检查地址、允许域名、模型和密钥");
      error.status = 400;
      error.code = "AI_CONNECTION_CONFIG_INVALID";
      error.cause = cause;
      throw error;
    }
  }

  return Object.freeze({
    getAllSettings,
    updateAiChatConfig,
    updateAiGenerationConfig,
    updateAiVisionConfig,
    testConnection,
    buildProviderEnvironment,
    getAiChatConfig,
    getAiGenerationConfig,
    getAiVisionConfig
  });
}

function maskKey(key) {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
