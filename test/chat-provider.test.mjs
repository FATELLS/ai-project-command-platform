import assert from "node:assert/strict";
import test from "node:test";
import { createProviderFromEnv } from "../src/ai/provider-factory.mjs";
import { createOpenAiCompatibleProvider } from "../src/ai/providers/openai-compatible-provider.mjs";

const config = { baseUrl: "https://api.example.test/v1", apiKey: "top-secret", model: "model", allowedHosts: ["api.example.test"], timeoutMs: 100, maxResponseBytes: 1024 };
const request = { messages: [{ role: "system", content: "safe" }], responseFormat: { type: "json_object" } };

test("no-key factory is disabled and production environment cannot enable fake", async () => {
  const disabled = createProviderFromEnv({}); assert.equal(disabled.configured, false); await assert.rejects(disabled.generate(request), error => error.code === "AI_PROVIDER_DISABLED");
  assert.throws(() => createProviderFromEnv({ AI_CHAT_PROVIDER: "fake", AI_CHAT_API_KEY: "x" }), /Unsupported/);
});

test("OpenAI-compatible adapter uses an allowlisted HTTPS endpoint and never sends tools", async () => {
  let captured; const provider = createOpenAiCompatibleProvider(config, { fetchImpl: async (url, init) => { captured = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: { prompt_tokens: 2, completion_tokens: 1 } }), { status: 200 }); } });
  const result = await provider.generate(request); assert.equal(captured.url, "https://api.example.test/v1/chat/completions"); assert.equal("tools" in captured.body, false); assert.equal(captured.body.max_tokens, 1200); assert.equal(result.usage.output, 1);
  assert.throws(() => createOpenAiCompatibleProvider({ ...config, baseUrl: "http://api.example.test" }), /HTTPS/);
  assert.throws(() => createOpenAiCompatibleProvider({ ...config, allowedHosts: ["other.test"] }), /allowlist/);
});

test("transient errors retry once while invalid, tool-call, truncated and oversized outputs fail safely", async () => {
  let calls = 0; const retry = createOpenAiCompatibleProvider(config, { sleep: async () => {}, fetchImpl: async () => { calls += 1; return calls === 1 ? new Response("busy secret body", { status: 503 }) : new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] }), { status: 200 }); } });
  await retry.generate(request); assert.equal(calls, 2);
  for (const payload of [
    "not json",
    JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { content: "{}", tool_calls: [{}] } }] }),
    JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })
  ]) {
    const provider = createOpenAiCompatibleProvider(config, { fetchImpl: async () => new Response(payload, { status: 200 }) });
    await assert.rejects(provider.generate(request), error => error.code?.startsWith("AI_PROVIDER_") && !error.message.includes("secret"));
  }
  const large = createOpenAiCompatibleProvider({ ...config, maxResponseBytes: 8 }, { fetchImpl: async () => new Response("x".repeat(20), { status: 200 }) });
  await assert.rejects(large.generate(request), error => error.code === "AI_PROVIDER_RESPONSE_TOO_LARGE");
});

test("deadline and upstream failures expose stable redacted errors", async () => {
  const timeout = createOpenAiCompatibleProvider({ ...config, timeoutMs: 5 }, { fetchImpl: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("top-secret"), { name: "AbortError" })))) });
  await assert.rejects(timeout.generate(request), error => error.code === "AI_PROVIDER_TIMEOUT" && !error.message.includes("top-secret"));
  const unauthorized = createOpenAiCompatibleProvider(config, { fetchImpl: async () => new Response("api-key top-secret", { status: 401 }) });
  await assert.rejects(unauthorized.generate(request), error => error.code === "AI_PROVIDER_HTTP_401" && !error.message.includes("top-secret"));
});
