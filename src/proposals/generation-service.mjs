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
function repairable(error) { return new Set(["PROPOSAL_SCHEMA_INVALID", "PROPOSAL_ENVELOPE_MISMATCH", "EVIDENCE_NOT_ALLOWED", "PATCH_FIELD_NOT_ALLOWED", "INVALID_CHANGE_ENUM", "INVALID_DATE", "INVALID_DATE_RANGE", "TARGET_NOT_FOUND", "DUPLICATE_TARGET", "DUPLICATE_CHANGE_ID", "CONFLICTING_CHANGES", "TASK_UNIT_NOT_FOUND", "TASK_LINK_NOT_FOUND", "TASK_LINK_CROSS_UNIT", "TASK_GRAPH_CYCLE", "DUPLICATE_NAME"]).has(error?.code); }
function retryable(error) { return error?.status === 429 || error?.status === 503 || /TIMEOUT|NETWORK|HTTP_5|DISABLED|BUSY|UNAVAILABLE/.test(String(error?.code ?? "")); }

/**
 * 结构化生成管道日志——所有日志统一带 [gen] 前缀和 jobId，
 * 方便从控制台输出或日志文件中快速定位生成卡在哪个阶段。
 */
function genLog(jobId, phase, message, extra) {
  const ts = new Date().toISOString();
  const parts = [`[gen] ${ts} job=${jobId} ${phase}`];
  if (message) parts.push(String(message));
  if (extra && typeof extra === "object") {
    const summary = Object.entries(extra)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" ");
    if (summary) parts.push(summary);
  }
  console.log(parts.join(" | "));
}

function pricedUsage(usage, pricing) {
  const input = Math.max(0, Number(usage?.input ?? 0)); const output = Math.max(0, Number(usage?.output ?? 0));
  if (!pricing || !Number.isFinite(pricing.inputMicrosPerMillion) || !Number.isFinite(pricing.outputMicrosPerMillion)) return { inputTokens: input, outputTokens: output, costStatus: "unpriced", costMicros: null, currency: null, priceVersion: null };
  return { inputTokens: input, outputTokens: output, costStatus: "priced", costMicros: Math.ceil((input * pricing.inputMicrosPerMillion + output * pricing.outputMicrosPerMillion) / 1_000_000), currency: String(pricing.currency ?? "CNY").slice(0, 12), priceVersion: String(pricing.version ?? "configured").slice(0, 80) };
}

export function createGenerationService(database, options = {}) {
  const provider = options.provider ?? createGenerationProviderFromEnv(options.environment);
  const quota = options.quota ?? createAiQuota(database, { perMinute: 20, daily: 100000, maxConcurrency: 4, ...(options.quotaOptions ?? {}) });
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
    if (actual.length !== locked.length || actual.some((value, index) => value !== locked[index])) throw proposalError("GENERATION_CONTEXT_STALE", "材料内容已更新，请重新生成", 409);
    return context;
  }

  async function processJob(projectId, jobId, contextOptions = {}) {
    let job = repository.getJob(projectId, jobId);
    if (!job) throw proposalError("GENERATION_JOB_NOT_FOUND", "生成任务不存在或你无权访问", 404);
    if (["succeeded", "failed_terminal", "stale"].includes(job.state)) return job;
    genLog(jobId, "start", `processJob begin`, { projectId, state: job.state, template: `${job.template?.id}@${job.template?.version}`, materials: job.materials?.length, evidence: job.evidence?.length });
    const t0 = Date.now();
    let release; let providerCalls = job.attemptsCount;
    try {
      const tCtx0 = Date.now();
      const context = lockedContext(job);
      genLog(jobId, "context", `context built in ${Date.now() - tCtx0}ms`, { evidenceBlocks: context.evidence?.length, publishedTasks: context.published?.tasks?.length, digest: context.digest?.slice(0, 12) });
      const template = getProposalTemplate(context.templateId, context.templateVersion);
      if (!template) throw proposalError("TEMPLATE_NOT_FOUND", "更新模板不可用", 409);
      repository.updateJob(projectId, jobId, { state: "retrieving_evidence", errorCode: null });
      release = quota.acquire();
      genLog(jobId, "quota", `quota acquired in ${Date.now() - t0}ms`);
      let validated; let validationCodes = [];
      for (let pass = 0; pass < 2; pass += 1) {
        providerCalls += 1; const attemptId = randomUUID(); const started = now(); const kind = pass === 0 ? "initial" : "structure_repair";
        repository.updateJob(projectId, jobId, { state: pass === 0 ? "generating" : "repairing", attempts: providerCalls });

        // 构建 prompt 并记录大小（关键诊断信号）
        const tPrompt0 = Date.now();
        const prompt = buildGenerationPrompt(context, template, { validationCodes });
        const systemLen = prompt.messages[0]?.content?.length ?? 0;
        const userLen = prompt.messages[1]?.content?.length ?? 0;
        genLog(jobId, "prompt", `prompt built in ${Date.now() - tPrompt0}ms`, { kind, systemChars: systemLen, userChars: userLen, totalChars: systemLen + userLen, approxTokens: Math.round((systemLen + userLen) / 4) });

        try {
          genLog(jobId, "provider-call", `calling AI provider (${kind})...`, { model: provider.safeLabel, timeoutMs: options.environment?.AI_GENERATION_TIMEOUT_MS ?? "default" });
          const raw = await provider.generate(prompt, { signal: contextOptions.signal });
          const providerMs = Date.now() - started;
          genLog(jobId, "provider-done", `provider responded in ${providerMs}ms`, { inputTokens: raw.usage?.input, outputTokens: raw.usage?.output, contentLen: raw.content?.length, providerLabel: raw.providerLabel });

          repository.updateJob(projectId, jobId, { state: "validating" });
          const tValid0 = Date.now();
          validated = validateProposal(raw.content, context);
          genLog(jobId, "validated", `proposal validated in ${Date.now() - tValid0}ms`, { changes: validated.changes?.length, warnings: validated.warnings?.length });

          const usage = pricedUsage(raw.usage, options.pricing);
          repository.addAttempt(projectId, jobId, { id: attemptId, attemptNumber: providerCalls, kind, outcome: "succeeded", providerLabel: raw.providerLabel ?? provider.safeLabel ?? (provider.configured ? "configured" : "disabled"), latencyMs: Math.max(0, now() - started), ...usage });
          break;
        } catch (error) {
          const providerMs = Date.now() - started;
          genLog(jobId, "provider-error", `attempt ${kind} failed in ${providerMs}ms`, { code: safeCode(error), message: error?.message?.slice(0, 200) });
          repository.addAttempt(projectId, jobId, { id: attemptId, attemptNumber: providerCalls, kind, outcome: "failed", providerLabel: provider.safeLabel ?? (provider.configured ? "configured" : "disabled"), latencyMs: Math.max(0, now() - started), resultCode: safeCode(error), costStatus: "unpriced" });
          if (pass === 0 && repairable(error)) { validationCodes = [safeCode(error), ...(error.details ? [`${safeCode(error)}: ${JSON.stringify(error.details)}`] : [])]; genLog(jobId, "repair", `entering structure_repair pass`, { validationCodes }); continue; }
          throw error;
        }
      }
      if (!validated) throw proposalError("PROPOSAL_VALIDATION_FAILED", "模型输出未通过结构校验", 422);
      const current = database.prepare("SELECT published_version_id AS id FROM projects WHERE id=?").get(projectId);
      if (!current || Number(current.id) !== Number(job.baseVersionId)) throw proposalError("BASE_VERSION_STALE", "发布版本已变化", 409);
      repository.saveProposal(projectId, jobId, validated);
      genLog(jobId, "done", `processJob succeeded in ${Date.now() - t0}ms`, { state: "succeeded", totalAttempts: providerCalls });
      return repository.getJob(projectId, jobId);
    } catch (error) {
      const code = safeCode(error); const state = ["BASE_VERSION_STALE", "GENERATION_CONTEXT_STALE"].includes(code) ? "stale" : retryable(error) ? "failed_retryable" : "failed_terminal";
      genLog(jobId, "failed", `processJob failed in ${Date.now() - t0}ms`, { code, state, message: error?.message?.slice(0, 200) });
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
