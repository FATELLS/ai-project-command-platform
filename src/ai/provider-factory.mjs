import { createDisabledProvider } from "./providers/disabled-provider.mjs";
import { createOpenAiCompatibleProvider } from "./providers/openai-compatible-provider.mjs";
import { AiServiceError } from "./errors.mjs";

export function createProviderFromEnv(environment = process.env, options = {}) {
  const kind = environment.AI_CHAT_PROVIDER ?? "disabled";
  if (kind === "disabled" || !environment.AI_CHAT_API_KEY) return createDisabledProvider();
  if (kind !== "openai-compatible") throw new AiServiceError("AI_PROVIDER_CONFIG_INVALID", `Unsupported AI chat provider: ${kind}`, 400);
  return createOpenAiCompatibleProvider({ baseUrl: environment.AI_CHAT_BASE_URL, apiKey: environment.AI_CHAT_API_KEY, model: environment.AI_CHAT_MODEL, allowedHosts: String(environment.AI_CHAT_ALLOWED_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean), timeoutMs: Number(environment.AI_CHAT_TIMEOUT_MS ?? 45_000), maxOutputTokens: 1_200 }, options);
}

export function createGenerationProviderFromEnv(environment = process.env, options = {}) {
  const kind = environment.AI_GENERATION_PROVIDER ?? "disabled";
  if (kind === "disabled" || !environment.AI_GENERATION_API_KEY) return createDisabledProvider();
  if (kind !== "openai-compatible") throw new AiServiceError("AI_PROVIDER_CONFIG_INVALID", `Unsupported AI generation provider: ${kind}`, 400);
  return createOpenAiCompatibleProvider({
    baseUrl: environment.AI_GENERATION_BASE_URL,
    apiKey: environment.AI_GENERATION_API_KEY,
    model: environment.AI_GENERATION_MODEL,
    allowedHosts: String(environment.AI_GENERATION_ALLOWED_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean),
    timeoutMs: Number(environment.AI_GENERATION_TIMEOUT_MS ?? 60_000),
    maxOutputTokens: Math.min(Number(environment.AI_GENERATION_MAX_OUTPUT_TOKENS ?? 8_000), 8_000),
    maxContentCharacters: 128 * 1024,
    maxResponseBytes: 256 * 1024,
    reasoningEffort: environment.AI_GENERATION_REASONING_EFFORT || undefined,
    safeLabel: environment.AI_GENERATION_PROVIDER_LABEL ?? "openai-compatible"
  }, options);
}
