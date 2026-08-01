import { validateAnswer, insufficientAnswer } from "../ai/answer-validator.mjs";
import { AiServiceError } from "../ai/errors.mjs";
import { buildPrompt } from "../ai/prompt-builder.mjs";
import { createProviderFromEnv } from "../ai/provider-factory.mjs";
import { readPublishedFacts } from "../ai/published-facts.mjs";
import { createAiQuota } from "../ai/quota.mjs";
import { createEvidenceRetriever } from "../ai/retriever.mjs";

function authorize(database, principal, projectId) {
  if (!principal?.id) return null;
  if (principal.isPlatformAdmin) return { audience: "editor" };
  const member = database.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, principal.id);
  if (!member) return null;
  return { audience: member.role === "viewer" ? "project_member" : "editor" };
}

export function createChatService(database, options = {}) {
  const provider = options.provider ?? createProviderFromEnv(options.environment);
  const quota = options.quota ?? createAiQuota(database, { perMinute: 30, daily: 100000, maxConcurrency: 4, ...(options.quotaOptions ?? {}) });
  const retriever = options.retriever ?? createEvidenceRetriever(database);

  async function answer(principal, { projectId, question }, context = {}) {
    const permission = options.authorize ? options.authorize(principal, projectId) : authorize(database, principal, projectId);
    if (!permission) throw new AiServiceError("PROJECT_NOT_FOUND", "Project was not found", 404);
    const normalized = String(question ?? "").normalize("NFKC").trim();
    if (!normalized || normalized.length > 1_000) throw new AiServiceError("INVALID_QUESTION", "Question must contain 1 to 1000 characters", 400);
    const published = readPublishedFacts(database, projectId);
    if (!published) throw new AiServiceError("PROJECT_NOT_FOUND", "Project was not found", 404);
    const reservation = quota.reserve({ projectId, userId: principal.id, capability: "chat", request: normalized });
    let release;
    try {
      const hits = retriever.search({ projectId, question: normalized, audience: permission.audience });
      if (!hits.length) { quota.complete(reservation, "succeeded"); return structuredClone(insufficientAnswer); }
      const prompt = buildPrompt({ question: normalized, published, hits });
      if (!prompt.allowlist.size) { quota.complete(reservation, "succeeded"); return structuredClone(insufficientAnswer); }
      release = quota.acquire();
      const raw = await provider.generate({ messages: prompt.messages, responseFormat: prompt.responseFormat }, { signal: context.signal });
      const result = validateAnswer(raw?.content, prompt.allowlist);
      quota.complete(reservation, "succeeded", Number(raw?.usage?.output ?? 1));
      return result;
    } catch (error) {
      quota.complete(reservation, "failed");
      throw error;
    } finally { release?.(); }
  }

  return Object.freeze({ answer, provider, quota, retriever });
}
