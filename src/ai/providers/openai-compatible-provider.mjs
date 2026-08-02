import { setTimeout as delay } from "node:timers/promises";
import { safeProviderError, AiServiceError } from "../errors.mjs";

const retryStatuses = new Set([408, 429, 500, 502, 503, 504]);
async function boundedBody(response, maximum) {
  if (!response.body) return ""; const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maximum) throw safeProviderError("AI_PROVIDER_RESPONSE_TOO_LARGE"); chunks.push(chunk); }
  return Buffer.concat(chunks).toString("utf8");
}

export function validateProviderConfig(config) {
  if (!config.baseUrl) throw new AiServiceError("AI_PROVIDER_CONFIG_INCOMPLETE", "AI provider base URL is required", 400);
  let url;
  try { url = new URL(config.baseUrl); } catch { throw new AiServiceError("AI_PROVIDER_CONFIG_INVALID_URL", "AI provider base URL is not a valid URL", 400); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new AiServiceError("AI_PROVIDER_CONFIG_INVALID_URL", "AI provider base URL must be a clean HTTPS URL (no path, query, or credentials)", 400);
  const allowed = new Set(config.allowedHosts ?? []);
  if (!allowed.has(url.hostname)) throw new AiServiceError("AI_PROVIDER_HOST_NOT_ALLOWED", `AI provider hostname "${url.hostname}" is not in the allowlist. Add it in Settings → Allowed Hosts, or it will be auto-added on next save.`, 400, { cause: { hostname: url.hostname, allowedHosts: [...allowed] } });
  if (!config.apiKey || !config.model) throw new AiServiceError("AI_PROVIDER_CONFIG_INCOMPLETE", "AI provider API key and model are both required", 400);
  if (config.reasoningEffort && !new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).has(config.reasoningEffort)) throw new AiServiceError("AI_PROVIDER_CONFIG_INVALID", "AI provider reasoning effort is invalid", 400);
  return url;
}

export function createOpenAiCompatibleProvider(config, options = {}) {
  const base = validateProviderConfig(config); const fetchImpl = options.fetchImpl ?? globalThis.fetch; const sleep = options.sleep ?? delay;
  const endpoint = new URL(`${base.pathname.replace(/\/$/, "")}/chat/completions`, base.origin).toString();
  const providerLabel = String(config.safeLabel ?? "openai-compatible").slice(0, 80);
  const configuredTimeoutMs = config.timeoutMs ?? 45_000;
  const configuredMaxTokens = Math.min(config.maxOutputTokens ?? 1_200, 8_000);
  return Object.freeze({ configured: true, safeLabel: providerLabel, async generate(request, { signal } = {}) {
    const requestBody = JSON.stringify({ model: config.model, messages: request.messages, temperature: 0.1, max_tokens: configuredMaxTokens, stream: false, response_format: request.responseFormat, ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}) });
    const bodyBytes = Buffer.byteLength(requestBody);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const fetchStart = Date.now();
      const deadline = AbortSignal.timeout(configuredTimeoutMs); const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
      if (attempt === 0) console.log(`[provider] ${new Date().toISOString()} POST ${endpoint} | model=${config.model} reqBody=${bodyBytes} bytes (~${Math.round(bodyBytes / 4)} tokens) timeoutMs=${configuredTimeoutMs} reasoning=${config.reasoningEffort ?? "default"}`);
      let response;
      try {
        response = await fetchImpl(endpoint, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json", accept: "application/json" }, body: requestBody, signal: combined });
      } catch (error) {
        const elapsed = Date.now() - fetchStart;
        console.error(`[provider] ${new Date().toISOString()} FETCH FAILED after ${elapsed}ms | ${error?.name}: ${error?.message?.slice(0, 200)}`);
        if (signal?.aborted) throw signal.reason; if (attempt === 0 && error?.name !== "AbortError") { await sleep(1); continue; } throw safeProviderError(error?.name === "AbortError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_NETWORK_ERROR");
      }
      const fetchMs = Date.now() - fetchStart;
      const body = await boundedBody(response, config.maxResponseBytes ?? 256 * 1024);
      console.log(`[provider] ${new Date().toISOString()} response ${response.status} in ${fetchMs}ms | body=${body.length} bytes`);
      if (!response.ok) { if (attempt === 0 && retryStatuses.has(response.status)) { await sleep(1); continue; } throw safeProviderError(`AI_PROVIDER_HTTP_${response.status}`); }
      let payload; try { payload = JSON.parse(body); } catch { throw safeProviderError("AI_PROVIDER_INVALID_JSON"); }
      if (!Array.isArray(payload.choices) || payload.choices.length !== 1) throw safeProviderError("AI_PROVIDER_INVALID_OUTPUT");
      const choice = payload.choices[0]; if (choice.message?.tool_calls || !["stop", "length"].includes(choice.finish_reason) || typeof choice.message?.content !== "string" || !choice.message.content.trim() || choice.message.content.length > (config.maxContentCharacters ?? 16_000)) throw safeProviderError("AI_PROVIDER_INVALID_OUTPUT");
      const rawContent = choice.message.content.trim();
      const extracted = rawContent.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
      console.log(`[provider] ${new Date().toISOString()} parsed OK | finish=${choice.finish_reason} inputTokens=${payload.usage?.prompt_tokens ?? "?"} outputTokens=${payload.usage?.completion_tokens ?? "?"} contentLen=${extracted.length}`);
      return { content: extracted, usage: { input: Number(payload.usage?.prompt_tokens ?? 0), output: Number(payload.usage?.completion_tokens ?? 0) }, providerLabel };
    }
    throw safeProviderError("AI_PROVIDER_UNAVAILABLE");
  } });
}
