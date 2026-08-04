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

/**
 * 从 baseUrl 中提取 hostname，自动补入 allowedHosts。
 * 解决用户配了地址但忘了加白名单导致"hostname is not allowlisted"的问题。
 * 已有的 allowedHosts 不会丢失，只是合并。
 */
function autoMergeAllowedHosts(baseUrl, currentHosts) {
  const existing = String(currentHosts ?? "").split(",").map(h => h.trim()).filter(Boolean);
  if (!baseUrl) return existing.join(",");
  try {
    const hostname = new URL(baseUrl).hostname;
    if (hostname && !existing.includes(hostname)) existing.unshift(hostname);
  } catch { /* baseUrl 无效时不阻塞保存，让 validateProviderConfig 后续报错 */ }
  return existing.join(",");
}

function sanitizeProviderConfig(input) {
  const result = {};
  const provider = String(input.provider ?? "disabled");
  result.provider = provider === "openai-compatible" ? "openai-compatible" : "disabled";
  result.baseUrl = String(input.baseUrl ?? "").trim();
  result.model = String(input.model ?? "").trim();
  result.allowedHosts = autoMergeAllowedHosts(result.baseUrl, input.allowedHosts);
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
  result.allowedHosts = autoMergeAllowedHosts(result.baseUrl, input.allowedHosts);
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

  /**
   * 调用 OpenAI 兼容的 /v1/models 或 /models 端点获取可用模型列表。
   * 支持两种调用方式：
   *   1. 临时凭据模式：前端传入 baseUrl + apiKey（用于"保存前预览"）
   *   2. 已保存配置模式：从数据库读取已保存的配置
   */
  async function fetchModels(principal, { scope, baseUrl, apiKey } = {}) {
    if (!principal?.isPlatformAdmin) {
      const error = new Error("仅平台管理员可获取模型列表");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    // 确定使用哪个配置的凭据
    let url, key, hosts;
    if (baseUrl) {
      // 临时凭据模式：使用前端传入的值
      url = baseUrl.trim();
      key = (apiKey || "").trim();
      if (!url) {
        const error = new Error("请先填写 API 地址");
        error.status = 400;
        error.code = "MODELS_FETCH_NO_URL";
        throw error;
      }
    } else {
      // 已保存配置模式：从数据库读取
      if (!["chat", "generation", "vision"].includes(scope)) {
        const error = new Error("未知的 AI 服务类型");
        error.status = 400;
        error.code = "INVALID_AI_SCOPE";
        throw error;
      }
      const config = scope === "generation" ? getAiGenerationConfig()
        : scope === "vision" ? getAiVisionConfig()
        : getAiChatConfig();
      url = config.baseUrl || "";
      key = config.apiKey || "";
      hosts = config.allowedHosts || "";
      if (!url) {
        const error = new Error("请先填写并保存 API 地址");
        error.status = 400;
        error.code = "MODELS_FETCH_NO_URL";
        throw error;
      }
    }

    // 构建 models 端点 URL
    // baseUrl 通常是 https://api.example.com/v1，models 端点是 /v1/models
    // 如果 baseUrl 已经以 /v1 结尾，则追加 /models；否则追加 /v1/models
    const modelsUrl = url.endsWith("/") ? `${url}models` : `${url}/models`;

    // 检查域名白名单（安全校验）
    if (hosts) {
      const allowedHosts = hosts.split(",").map(h => h.trim()).filter(Boolean);
      try {
        const hostname = new URL(modelsUrl).hostname;
        if (allowedHosts.length > 0 && !allowedHosts.includes(hostname)) {
          const error = new Error(`域名 ${hostname} 不在允许列表中`);
          error.status = 400;
          error.code = "MODELS_FETCH_HOST_BLOCKED";
          throw error;
        }
      } catch { /* URL 无效时让 fetch 报错 */ }
    }

    try {
      const headers = { "Content-Type": "application/json" };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(`获取模型列表失败 (${response.status}): ${text.slice(0, 200)}`);
        error.status = 400;
        error.code = "MODELS_FETCH_FAILED";
        throw error;
      }
      const data = await response.json();
      // OpenAI 兼容格式: { data: [{ id: "model-name", ... }, ...] }
      const models = Array.isArray(data?.data)
        ? data.data.map(m => m.id).filter(Boolean).sort()
        : Array.isArray(data?.models)
          ? data.models.map(m => typeof m === "string" ? m : m.id).filter(Boolean).sort()
          : [];
      return { models };
    } catch (cause) {
      if (cause?.code === "MODELS_FETCH_FAILED") throw cause;
      const error = new Error(`获取模型列表失败: ${cause.message || cause}`);
      error.status = 400;
      error.code = "MODELS_FETCH_FAILED";
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
    fetchModels,
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
