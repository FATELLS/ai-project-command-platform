import { getProposalTemplate } from "./catalog.mjs";
import { parseProposal } from "./schema.mjs";
import { proposalError } from "./errors.mjs";

const semantics = new Set(["fact", "plan", "suggestion", "unknown"]);
const operations = new Set(["create", "update", "delete"]);
const highImpactDefaults = new Set(["progress", "completion", "status", "state", "owner", "startDate", "endDate", "dueDate", "asOf", "value", "target", "result", "source"]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function fail(code, message, details) { throw proposalError(code, message, 422, details); }
function equalArrays(left, right) { return left.length === right.length && left.every((item, index) => item === right[index]); }
function normalized(value) { return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN"); }
function moduleAllowed(template, module) { return Array.isArray(template.modules) ? template.modules.includes(module) : Boolean(template.modules?.[module]); }
function operationAllowed(template, module, operation) {
  const rule = template.operations;
  if (Array.isArray(rule)) return rule.includes(operation);
  const allowed = rule?.[module] ?? rule?.default ?? [];
  return allowed.includes(operation);
}
function allowedPatchFields(template, module) {
  const rule = template.patchFields?.[module] ?? template.patchFields?.default ?? template.fields?.[module] ?? [];
  return new Set(rule);
}
function targetMap(context, module) {
  const graph = context.published;
  if (module === "units") return new Map(graph.units.map(item => [item.id, item]));
  if (module === "roadmap") return new Map(graph.stages.map(item => [item.id, item]));
  if (module === "task-network" || module === "gantt") return new Map(graph.tasks.map(item => [item.id, item]));
  if (module === "risks") return new Map(graph.risks.map(item => [item.id, item]));
  if (module === "metrics") return new Map(graph.metrics.map(item => [item.id, item]));
  if (module === "outcomes") return new Map(graph.outcomes.map(item => [item.id, item]));
  return new Map();
}
function validateDates(patch, changeId) {
  for (const field of ["startDate", "endDate", "dueDate", "asOf", "date"]) {
    if (patch[field] !== undefined && patch[field] !== null && patch[field] !== "" && (typeof patch[field] !== "string" || !isoDate.test(patch[field]))) fail("INVALID_DATE", "提案包含无效日期", { changeId, field });
  }
  if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) fail("INVALID_DATE_RANGE", "任务开始日期晚于结束日期", { changeId });
}
function validateTaskGraph(context, changes) {
  const tasks = new Map(context.published.tasks.map(item => [item.id, structuredClone(item)]));
  for (const change of changes.filter(item => ["task-network", "gantt"].includes(item.module))) {
    if (change.operation === "delete") { tasks.delete(change.targetId); continue; }
    const existing = tasks.get(change.targetId);
    if (change.operation === "update" && !existing) fail("TARGET_NOT_FOUND", "提案目标不存在", { changeId: change.changeId });
    if (change.operation === "create" && existing) fail("DUPLICATE_TARGET", "提案创建 ID 与现有任务重复", { changeId: change.changeId });
    tasks.set(change.targetId, { ...(existing ?? { id: change.targetId, dependsOn: [], parentId: "" }), ...change.patch, id: change.targetId });
  }
  const names = new Map();
  for (const task of tasks.values()) {
    const name = normalized(task.title);
    if (name && names.has(name) && names.get(name) !== task.id) fail("DUPLICATE_NAME", "提案将产生重复任务名称", { targetId: task.id });
    if (name) names.set(name, task.id);
    const unit = task.unitId;
    const links = [...new Set([task.parentId, ...(task.dependsOn ?? [])].filter(Boolean))];
    for (const link of links) {
      const linked = tasks.get(link);
      if (!linked) fail("TASK_LINK_NOT_FOUND", "任务依赖目标不存在", { targetId: task.id, link });
      if (link === task.id) fail("TASK_GRAPH_CYCLE", "任务不能依赖自身", { targetId: task.id });
      if (unit && linked.unitId && unit !== linked.unitId) fail("TASK_LINK_CROSS_UNIT", "任务依赖必须位于同一团队或作战单元", { targetId: task.id, link });
    }
  }
  const visiting = new Set(); const visited = new Set();
  const visit = id => { if (visiting.has(id)) fail("TASK_GRAPH_CYCLE", "任务依赖形成循环", { targetId: id }); if (visited.has(id)) return; visiting.add(id); const task = tasks.get(id); for (const link of [task?.parentId, ...(task?.dependsOn ?? [])].filter(Boolean)) visit(link); visiting.delete(id); visited.add(id); };
  for (const id of tasks.keys()) visit(id);
}

export function validateProposal(raw, context) {
  const proposal = parseProposal(raw);
  const template = getProposalTemplate(context.templateId, context.templateVersion);
  if (!template) fail("TEMPLATE_NOT_FOUND", "更新模板不可用");
  if (proposal.projectId !== context.projectId || Number(proposal.baseVersionId) !== Number(context.baseVersionId)) fail("PROPOSAL_ENVELOPE_MISMATCH", "提案项目或基准版本不匹配");
  if (proposal.template.id !== context.templateId || proposal.template.version !== context.templateVersion) fail("PROPOSAL_ENVELOPE_MISMATCH", "提案模板不匹配");
  const lockedMaterials = context.materials.map(item => item.id);
  if (!equalArrays(proposal.materialIds, lockedMaterials)) fail("PROPOSAL_ENVELOPE_MISMATCH", "提案材料列表不匹配");
  const evidence = new Set(context.evidence.map(item => item.evidenceId));
  const seenChanges = new Set(); const seenOperations = new Set(); const warnings = new Set(proposal.warnings ?? []);
  for (const change of proposal.changes) {
    if (seenChanges.has(change.changeId)) fail("DUPLICATE_CHANGE_ID", "提案包含重复 changeId", { changeId: change.changeId });
    seenChanges.add(change.changeId);
    if (!semantics.has(change.semanticType) || !operations.has(change.operation)) fail("INVALID_CHANGE_ENUM", "提案变更枚举无效", { changeId: change.changeId });
    if (!moduleAllowed(template, change.module) || !operationAllowed(template, change.module, change.operation)) fail("CHANGE_NOT_ALLOWED", "模板不允许该模块或操作", { changeId: change.changeId });
    const signature = `${change.module}:${change.targetId}`;
    if (seenOperations.has(signature)) fail("CONFLICTING_CHANGES", "同一目标包含多个冲突变更", { changeId: change.changeId });
    seenOperations.add(signature);
    const targets = targetMap(context, change.module);
    if (change.operation !== "create" && !targets.has(change.targetId)) fail("TARGET_NOT_FOUND", "提案目标不存在", { changeId: change.changeId });
    if (change.operation === "create" && targets.has(change.targetId)) fail("DUPLICATE_TARGET", "提案创建 ID 与现有对象重复", { changeId: change.changeId });
    const allowed = allowedPatchFields(template, change.module);
    for (const field of Object.keys(change.patch)) if (!allowed.has(field)) fail("PATCH_FIELD_NOT_ALLOWED", "模板不允许该字段", { changeId: change.changeId, field });
    if (!Array.isArray(change.evidenceIds) || new Set(change.evidenceIds).size !== change.evidenceIds.length || change.evidenceIds.some(id => !evidence.has(id))) fail("EVIDENCE_NOT_ALLOWED", "提案引用了不可用证据", { changeId: change.changeId });
    const highImpact = new Set([...(template.highImpactFields ?? []), ...highImpactDefaults]);
    const containsHighImpact = Object.keys(change.patch).some(field => highImpact.has(field));
    if ((change.semanticType === "fact" || containsHighImpact) && change.evidenceIds.length < 1) fail("EVIDENCE_REQUIRED", "事实或高影响字段必须引用证据", { changeId: change.changeId });
    if (change.semanticType === "unknown") warnings.add("UNKNOWN_SEMANTICS");
    if (change.semanticType === "suggestion") warnings.add("SUGGESTION_NOT_FACT");
    if (change.confidence < 0.6) warnings.add("LOW_CONFIDENCE");
    if (containsHighImpact) warnings.add("HIGH_IMPACT_FIELD");
    if (change.operation === "delete") warnings.add("DELETE_OPERATION");
    validateDates(change.patch, change.changeId);
  }
  validateTaskGraph(context, proposal.changes);
  return Object.freeze({ ...proposal, warnings: [...warnings].sort(), validation: { status: "passed", schema: true, ownership: true, baseVersion: true, evidence: true, dates: true, taskGraph: true, duplicates: true, semantics: true, validatedAt: new Date().toISOString() } });
}
