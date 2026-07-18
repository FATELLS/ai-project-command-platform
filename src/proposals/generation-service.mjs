import { createHash, randomUUID } from "node:crypto";
import { createGenerationProviderFromEnv } from "../ai/provider-factory.mjs";
import { createAiQuota } from "../ai/quota.mjs";
import { getProposalTemplate } from "./catalog.mjs";
import { buildGenerationContext } from "./context-builder.mjs";
import { ProposalServiceError, proposalError } from "./errors.mjs";
import { buildGenerationPrompt } from "./prompt-builder.mjs";
import { createProposalRepository } from "./proposal-repository.mjs";
import { PROPOSAL_SCHEMA_VERSION } from "./schema.mjs";
import { validateProposal } from "./validator.mjs";

function requestHash(context) { return createHash("sha256").update(context.digest).digest("hex"); }
function safeCode(error) { return /^[A-Z][A-Z0-9_]{1,80}$/.test(String(error?.code ?? "")) ? error.code : "GENERATION_FAILED"; }
function repairable(error) { return new Set(["PROPOSAL_SCHEMA_INVALID", "PROPOSAL_ENVELOPE_MISMATCH", "EVIDENCE_NOT_ALLOWED", "PATCH_FIELD_NOT_ALLOWED", "INVALID_CHANGE_ENUM"]).has(error?.code); }
function retryable(error) { return error?.status === 429 || error?.status === 503 || /TIMEOUT|NETWORK|HTTP_5|DISABLED|BUSY|UNAVAILABLE/.test(String(error?.code ?? "")); }

function pricedUsage(usage, pricing) {
  const input = Math.max(0, Number(usage?.input ?? 0)); const output = Math.max(0, Number(usage?.output ?? 0));
  if (!pricing || !Number.isFinite(pricing.inputMicrosPerMillion) || !Number.isFinite(pricing.outputMicrosPerMillion)) return { inputTokens: input, outputTokens: output, costStatus: "unpriced", costMicros: null, currency: null, priceVersion: null };
  return { inputTokens: input, outputTokens: output, costStatus: "priced", costMicros: Math.ceil((input * pricing.inputMicrosPerMillion + output * pricing.outputMicrosPerMillion) / 1_000_000), currency: String(pricing.currency ?? "CNY").slice(0, 12), priceVersion: String(pricing.version ?? "configured").slice(0, 80) };
}

export function createGenerationService(database, options = {}) {
  const provider = options.provider ?? createGenerationProviderFromEnv(options.environment);
  const quota = options.quota ?? createAiQuota(database, { perMinute: 4, daily: 100, maxConcurrency: 2, ...(options.quotaOptions ?? {}) });
  const repository = options.repository ?? createProposalRepository(database, { now: options.now });
  const now = options.now ?? Date.now;

  function findIdempotent(projectId, userId, idempotencyKey) {
    const row = database.prepare("SELECT id FROM generation_jobs WHERE project_id=? AND created_by=? AND idempotency_key=?").get(projectId, userId, idempotencyKey);
    return row ? repository.getJob(projectId, row.id) : undefined;
  }

  function createJob(principal, input) {
    const idempotencyKey = String(input.idempotencyKey ?? "").trim();
    if (!/^[a-zA-Z0-9._-]{8,128}$/.test(idempotencyKey)) throw proposalError("INVALID_IDEMPOTENCY_KEY", "生成任务幂等标识无效");
    const existing = findIdempotent(input.projectId, principal.id, idempotencyKey);
    if (existing) return existing;
    const context = buildGenerationContext(database, { projectId: input.projectId, materialIds: input.materialIds, baseVersionId: input.baseVersionId });
    const template = getProposalTemplate(context.templateId, context.templateVersion);
    if (!template) throw proposalError("TEMPLATE_NOT_FOUND", "更新模板不可用", 409);
    const reservation = quota.reserve({ projectId: input.projectId, userId: principal.id, capability: "generation", request: context.digest });
    try {
      const job = repository.createJob({ projectId: context.projectId, baseVersionId: context.baseVersionId, templateId: context.templateId, templateVersion: context.templateVersion, schemaVersion: PROPOSAL_SCHEMA_VERSION, idempotencyKey, requestHash: requestHash(context), createdBy: principal.id, retryOfJobId: input.retryOfJobId, materials: context.materials, evidence: context.evidence });
      quota.complete(reservation, "succeeded"); return job;
    } catch (error) { quota.complete(reservation, "failed"); throw error; }
  }

  function lockedContext(job) {
    const context = buildGenerationContext(database, { projectId: job.projectId, materialIds: job.materials.map(item => item.id), baseVersionId: job.baseVersionId });
    const actual = context.evidence.map(item => `${item.evidenceId}:${item.contentHash}`);
    const locked = job.evidence.map(item => `${item.evidenceId}:${item.contentHash}`);
    if (actual.length !== locked.length || actual.some((value, index) => value !== locked[index])) throw proposalError("GENERATION_CONTEXT_STALE", "材料证据代际已变化", 409);
    return context;
  }

  async function processJob(projectId, jobId, contextOptions = {}) {
    let job = repository.getJob(projectId, jobId);
    if (!job) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    if (["succeeded", "failed_terminal", "stale"].includes(job.state)) return job;
    let release; let providerCalls = job.attemptsCount;
    try {
      const context = lockedContext(job); const template = getProposalTemplate(context.templateId, context.templateVersion);
      if (!template) throw proposalError("TEMPLATE_NOT_FOUND", "更新模板不可用", 409);
      repository.updateJob(projectId, jobId, { state: "retrieving_evidence", errorCode: null });
      release = quota.acquire();
      let validated; let validationCodes = [];
      for (let pass = 0; pass < 2; pass += 1) {
        providerCalls += 1; const attemptId = randomUUID(); const started = now(); const kind = pass === 0 ? "initial" : "structure_repair";
        repository.updateJob(projectId, jobId, { state: pass === 0 ? "generating" : "repairing", attempts: providerCalls });
        try {
          const raw = await provider.generate(buildGenerationPrompt(context, template, { validationCodes }), { signal: contextOptions.signal });
          repository.updateJob(projectId, jobId, { state: "validating" });
          validated = validateProposal(raw.content, context);
          const usage = pricedUsage(raw.usage, options.pricing);
          repository.addAttempt(projectId, jobId, { id: attemptId, attemptNumber: providerCalls, kind, outcome: "succeeded", providerLabel: raw.providerLabel ?? provider.safeLabel ?? (provider.configured ? "configured" : "disabled"), latencyMs: Math.max(0, now() - started), ...usage });
          break;
        } catch (error) {
          repository.addAttempt(projectId, jobId, { id: attemptId, attemptNumber: providerCalls, kind, outcome: "failed", providerLabel: provider.safeLabel ?? (provider.configured ? "configured" : "disabled"), latencyMs: Math.max(0, now() - started), resultCode: safeCode(error), costStatus: "unpriced" });
          if (pass === 0 && repairable(error)) { validationCodes = [safeCode(error)]; continue; }
          throw error;
        }
      }
      if (!validated) throw proposalError("PROPOSAL_VALIDATION_FAILED", "模型输出未通过结构校验", 422);
      const current = database.prepare("SELECT published_version_id AS id FROM projects WHERE id=?").get(projectId);
      if (!current || Number(current.id) !== Number(job.baseVersionId)) throw proposalError("BASE_VERSION_STALE", "发布版本已变化", 409);
      repository.saveProposal(projectId, jobId, validated);
      return repository.getJob(projectId, jobId);
    } catch (error) {
      const code = safeCode(error); const state = ["BASE_VERSION_STALE", "GENERATION_CONTEXT_STALE"].includes(code) ? "stale" : retryable(error) ? "failed_retryable" : "failed_terminal";
      repository.updateJob(projectId, jobId, { state, attempts: providerCalls, errorCode: code, validation: error instanceof ProposalServiceError ? { status: "failed", code, details: error.details ?? null } : { status: "failed", code } });
      return repository.getJob(projectId, jobId);
    } finally { release?.(); }
  }

  function retryJob(principal, projectId, jobId, idempotencyKey) {
    const prior = repository.getJob(projectId, jobId);
    if (!prior) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    if (prior.state !== "failed_retryable" && prior.state !== "stale") throw proposalError("GENERATION_JOB_NOT_RETRYABLE", "生成任务当前不可重试", 409);
    return createJob(principal, { projectId, materialIds: prior.materials.map(item => item.id), idempotencyKey, retryOfJobId: prior.id });
  }

  return Object.freeze({ createJob, processJob, retryJob, repository, provider, quota });
}
