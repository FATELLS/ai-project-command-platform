import { AiServiceError } from "./errors.mjs";

export const insufficientAnswer = Object.freeze({ schemaVersion: "project-answer-v1", answer: "现有资料不足以回答这个问题。", citations: [], caveat: "现有资料不足以回答这个问题。", followUps: [] });

function exactKeys(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }

export function validateAnswer(raw, allowlist) {
  let value;
  try { value = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider output is not valid JSON", 502); }
  if (!exactKeys(value, ["schemaVersion", "answer", "citations", "caveat", "followUps"]) || value.schemaVersion !== "project-answer-v1") throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider output schema is invalid", 502);
  if (typeof value.answer !== "string" || value.answer.length < 1 || value.answer.length > 4_000 || typeof value.caveat !== "string" || value.caveat.length > 1_000) throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider text bounds are invalid", 502);
  if (!Array.isArray(value.citations) || value.citations.length < 1 || value.citations.length > 8 || !Array.isArray(value.followUps) || value.followUps.length > 3) throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider citation bounds are invalid", 502);
  const seen = new Set(); const citations = value.citations.map(citation => {
    if (!exactKeys(citation, ["evidenceId", "claim"]) || typeof citation.evidenceId !== "string" || typeof citation.claim !== "string" || !citation.claim || citation.claim.length > 800 || seen.has(citation.evidenceId) || !allowlist.has(citation.evidenceId)) throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider cited an unavailable source", 502);
    seen.add(citation.evidenceId); const hit = allowlist.get(citation.evidenceId);
    return { evidenceId: hit.evidenceId, materialId: hit.materialId, kind: hit.kind, location: hit.location, claim: citation.claim };
  });
  if (value.followUps.some(item => typeof item !== "string" || item.length < 1 || item.length > 120)) throw new AiServiceError("AI_PROVIDER_INVALID_OUTPUT", "Provider follow-up bounds are invalid", 502);
  return { ...value, citations };
}
