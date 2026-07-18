import { createDisabledProvider } from "./providers/disabled-provider.mjs";
import { createOpenAiCompatibleProvider } from "./providers/openai-compatible-provider.mjs";

export function createProviderFromEnv(environment = process.env, options = {}) {
  const kind = environment.AI_CHAT_PROVIDER ?? "disabled";
  if (kind === "disabled" || !environment.AI_CHAT_API_KEY) return createDisabledProvider();
  if (kind !== "openai-compatible") throw new TypeError("Unsupported production AI provider");
  return createOpenAiCompatibleProvider({ baseUrl: environment.AI_CHAT_BASE_URL, apiKey: environment.AI_CHAT_API_KEY, model: environment.AI_CHAT_MODEL, allowedHosts: String(environment.AI_CHAT_ALLOWED_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean), timeoutMs: Number(environment.AI_CHAT_TIMEOUT_MS ?? 45_000), maxOutputTokens: 1_200 }, options);
}
