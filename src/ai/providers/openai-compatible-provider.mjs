import { setTimeout as delay } from "node:timers/promises";
import { safeProviderError } from "../errors.mjs";

const retryStatuses = new Set([408, 429, 500, 502, 503, 504]);
async function boundedBody(response, maximum) {
  if (!response.body) return ""; const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maximum) throw safeProviderError("AI_PROVIDER_RESPONSE_TOO_LARGE"); chunks.push(chunk); }
  return Buffer.concat(chunks).toString("utf8");
}

export function validateProviderConfig(config) {
  const url = new URL(config.baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new TypeError("AI provider base URL must be a clean HTTPS URL");
  const allowed = new Set(config.allowedHosts ?? []);
  if (!allowed.has(url.hostname)) throw new TypeError("AI provider hostname is not allowlisted");
  if (!config.apiKey || !config.model) throw new TypeError("AI provider key and model are required");
  if (config.reasoningEffort && !new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).has(config.reasoningEffort)) throw new TypeError("AI provider reasoning effort is invalid");
  return url;
}

export function createOpenAiCompatibleProvider(config, options = {}) {
  const base = validateProviderConfig(config); const fetchImpl = options.fetchImpl ?? globalThis.fetch; const sleep = options.sleep ?? delay;
  const endpoint = new URL(`${base.pathname.replace(/\/$/, "")}/chat/completions`, base.origin).toString();
  return Object.freeze({ configured: true, safeLabel: String(config.safeLabel ?? "openai-compatible").slice(0, 80), async generate(request, { signal } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const deadline = AbortSignal.timeout(config.timeoutMs ?? 45_000); const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
      let response;
      try {
        response = await fetchImpl(endpoint, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ model: config.model, messages: request.messages, temperature: 0.1, max_tokens: Math.min(config.maxOutputTokens ?? 1_200, 8_000), stream: false, response_format: request.responseFormat, ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}) }), signal: combined });
      } catch (error) {
        if (signal?.aborted) throw signal.reason; if (attempt === 0 && error?.name !== "AbortError") { await sleep(1); continue; } throw safeProviderError(error?.name === "AbortError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_NETWORK_ERROR");
      }
      const body = await boundedBody(response, config.maxResponseBytes ?? 256 * 1024);
      if (!response.ok) { if (attempt === 0 && retryStatuses.has(response.status)) { await sleep(1); continue; } throw safeProviderError(`AI_PROVIDER_HTTP_${response.status}`); }
      let payload; try { payload = JSON.parse(body); } catch { throw safeProviderError("AI_PROVIDER_INVALID_JSON"); }
      if (!Array.isArray(payload.choices) || payload.choices.length !== 1) throw safeProviderError("AI_PROVIDER_INVALID_OUTPUT");
      const choice = payload.choices[0]; if (choice.message?.tool_calls || choice.finish_reason !== "stop" || typeof choice.message?.content !== "string" || !choice.message.content.trim() || choice.message.content.length > (config.maxContentCharacters ?? 16_000)) throw safeProviderError("AI_PROVIDER_INVALID_OUTPUT");
      return { content: choice.message.content, usage: { input: Number(payload.usage?.prompt_tokens ?? 0), output: Number(payload.usage?.completion_tokens ?? 0) }, providerLabel: String(config.safeLabel ?? "openai-compatible").slice(0, 80) };
    }
    throw safeProviderError("AI_PROVIDER_UNAVAILABLE");
  } });
}
