import { proposalError } from "./errors.mjs";

export const PROPOSAL_SCHEMA_VERSION = "change-proposal-v1@1.0.0";
const modules = new Set(["overview", "units", "roadmap", "task-network", "gantt", "outcomes", "risks", "metrics"]);
const operations = new Set(["create", "update", "delete"]);
const semantics = new Set(["fact", "plan", "suggestion", "unknown"]);
const stableId = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const warningCode = /^[A-Z][A-Z0-9_]{1,63}$/;
const unsafeText = /<\/?(?:script|style|iframe|object|embed)|javascript\s*:|data\s*:\s*text\/(?:html|javascript)|\bon(?:load|error|click)\s*=/i;
const unsafeKey = /^(?:html|css|javascript|script|sql|shell|command|component|componentPath|path|url|href|src|tool|tools)$/i;

function fail(message) { throw proposalError("PROPOSAL_SCHEMA_INVALID", message, 422); }
function object(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} 必须是对象`); return value; }
function exact(value, keys, label) { object(value, label); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(`${label} 字段不符合 Schema`); }
function text(value, label, min, max) { if (typeof value !== "string" || value.length < min || value.length > max || unsafeText.test(value)) fail(`${label} 文本无效`); return value; }
function warnings(value, label) { if (!Array.isArray(value) || value.length > 20 || new Set(value).size !== value.length || value.some(item => typeof item !== "string" || !warningCode.test(item))) fail(`${label} 警告码无效`); return value; }
function validateJson(value, label, depth = 0) {
  if (depth > 4) fail(`${label} 嵌套过深`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) fail(`${label} 数值无效`); return; }
  if (typeof value === "string") { text(value, label, 0, 4_000); return; }
  if (Array.isArray(value)) { if (value.length > 50) fail(`${label} 数组过长`); for (const [index, item] of value.entries()) validateJson(item, `${label}[${index}]`, depth + 1); return; }
  object(value, label); const keys = Object.keys(value); if (keys.length > 24) fail(`${label} 字段过多`);
  for (const key of keys) { if (unsafeKey.test(key) || key.length > 64) fail(`${label} 包含禁止字段`); validateJson(value[key], `${label}.${key}`, depth + 1); }
}

export function parseProposal(raw) {
  let value;
  if (typeof raw === "string") {
    if (Buffer.byteLength(raw) > 128 * 1024) fail("提案输出过大");
    try { value = JSON.parse(raw); } catch { fail("提案不是有效 JSON"); }
  } else { value = structuredClone(raw); }
  exact(value, ["schemaVersion", "projectId", "baseVersionId", "template", "materialIds", "summary", "changes", "warnings"], "proposal");
  if (value.schemaVersion !== PROPOSAL_SCHEMA_VERSION) fail("提案 Schema 版本无效");
  if (typeof value.projectId !== "string" || !stableId.test(value.projectId)) fail("projectId 无效");
  if (!Number.isSafeInteger(value.baseVersionId) || value.baseVersionId < 1) fail("baseVersionId 无效");
  exact(value.template, ["id", "version"], "template");
  if (!stableId.test(value.template.id) || !/^\d+\.\d+\.\d+$/.test(value.template.version)) fail("template 无效");
  if (!Array.isArray(value.materialIds) || value.materialIds.length < 1 || value.materialIds.length > 8 || new Set(value.materialIds).size !== value.materialIds.length || value.materialIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9._-]{16,128}$/.test(id))) fail("materialIds 无效");
  text(value.summary, "summary", 1, 2_000); warnings(value.warnings, "proposal");
  if (!Array.isArray(value.changes) || value.changes.length < 1 || value.changes.length > 100) fail("changes 数量无效");
  const changes = value.changes.map((change, index) => {
    exact(change, ["changeId", "module", "operation", "targetId", "semanticType", "patch", "evidenceIds", "confidence", "warnings"], `changes[${index}]`);
    if (typeof change.changeId !== "string" || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(change.changeId)) fail("changeId 无效");
    if (!modules.has(change.module) || !operations.has(change.operation) || !semantics.has(change.semanticType)) fail("变更枚举无效");
    if (typeof change.targetId !== "string" || !stableId.test(change.targetId)) fail("targetId 无效");
    object(change.patch, "patch"); validateJson(change.patch, `changes[${index}].patch`);
    if (!Array.isArray(change.evidenceIds) || change.evidenceIds.length > 48 || new Set(change.evidenceIds).size !== change.evidenceIds.length || change.evidenceIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9._-]{16,128}$/.test(id))) fail("evidenceIds 无效");
    if (typeof change.confidence !== "number" || !Number.isFinite(change.confidence) || change.confidence < 0 || change.confidence > 1) fail("confidence 无效");
    warnings(change.warnings, `changes[${index}]`);
    if (Buffer.byteLength(JSON.stringify(change.patch)) > 16 * 1024) fail("patch 过大");
    return change;
  });
  return Object.freeze({ ...value, changes });
}
