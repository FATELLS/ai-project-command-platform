const stableIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const safeAssetPattern = /^(?:\.\/|\/)?assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

export class ModuleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModuleValidationError";
    this.code = "MODULE_VALIDATION_FAILED";
  }
}

function fail(path, message) {
  throw new ModuleValidationError(`${path}: ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value;
}

function array(value, path) {
  if (!Array.isArray(value)) fail(path, "must be an array");
  return value;
}

function stableId(value, path) {
  if (typeof value !== "string" || !stableIdPattern.test(value)) fail(path, "must be a stable lowercase ID");
  return value;
}

function uniqueIndex(items, path) {
  const result = new Map();
  array(items, path).forEach((item, index) => {
    object(item, `${path}[${index}]`);
    const id = stableId(item.id, `${path}[${index}].id`);
    if (result.has(id)) fail(path, `contains duplicate ID ${id}`);
    result.set(id, item);
  });
  return result;
}

function validateDate(value, path) {
  if (value === "" || value === null || value === undefined) return;
  const parsed = typeof value === "string" && isoDatePattern.test(value) ? new Date(`${value}T00:00:00Z`) : undefined;
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(path, "must be an ISO calendar date or empty");
  }
}

function validateTaskDag(tasks, taskById) {
  const edges = new Map();
  tasks.forEach((task, index) => {
    const path = `graph.tasks[${index}]`;
    const dependencies = array(task.dependsOn ?? [], `${path}.dependsOn`);
    const links = task.parentId ? [task.parentId, ...dependencies] : dependencies;
    const unique = new Set();
    for (const linkedId of links) {
      stableId(linkedId, `${path}.link`);
      if (linkedId === task.id) fail(path, "cannot reference itself");
      if (!taskById.has(linkedId)) fail(path, `references missing task ${linkedId}`);
      if (unique.has(linkedId)) fail(path, `contains duplicate link ${linkedId}`);
      unique.add(linkedId);
    }
    edges.set(task.id, [...unique]);
  });
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) fail("graph.tasks", `contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const linkedId of edges.get(id) ?? []) visit(linkedId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of edges.keys()) visit(id);
}

export function validateVersionGraph(graph) {
  object(graph, "graph");
  const metadata = object(graph.metadata, "graph.metadata");
  if (typeof metadata.version !== "string" || !metadata.version.trim()) fail("graph.metadata.version", "is required");
  const units = array(graph.units, "graph.units");
  const stages = array(graph.stages, "graph.stages");
  const closures = array(graph.closures, "graph.closures");
  const tasks = array(graph.tasks, "graph.tasks");
  const workstreams = array(graph.workstreams, "graph.workstreams");
  const risks = array(graph.risks, "graph.risks");
  const metrics = array(graph.metrics, "graph.metrics");
  const unitById = uniqueIndex(units, "graph.units");
  const stageById = uniqueIndex(stages, "graph.stages");
  const taskById = uniqueIndex(tasks, "graph.tasks");
  uniqueIndex(closures, "graph.closures");
  uniqueIndex(workstreams, "graph.workstreams");
  uniqueIndex(risks, "graph.risks");
  uniqueIndex(metrics, "graph.metrics");

  tasks.forEach((task, index) => {
    const path = `graph.tasks[${index}]`;
    stableId(task.unitId, `${path}.unitId`);
    if (!unitById.has(task.unitId)) fail(path, `references missing unit ${task.unitId}`);
    validateDate(task.startDate, `${path}.startDate`);
    validateDate(task.endDate, `${path}.endDate`);
    if (task.startDate && task.endDate && task.startDate > task.endDate) fail(path, "starts after it ends");
    if (task.progress !== null && task.progress !== undefined &&
        (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100)) {
      fail(`${path}.progress`, "must be null or between 0 and 100");
    }
  });
  validateTaskDag(tasks, taskById);

  closures.forEach((closure, index) => {
    for (const stageId of array(closure.between ?? [], `graph.closures[${index}].between`)) {
      stableId(stageId, `graph.closures[${index}].between`);
      if (!stageById.has(stageId)) fail(`graph.closures[${index}]`, `references missing stage ${stageId}`);
    }
    for (const asset of array(closure.previewAssets ?? [], `graph.closures[${index}].previewAssets`)) {
      if (typeof asset !== "string" || !safeAssetPattern.test(asset) || asset.includes("..")) {
        fail(`graph.closures[${index}].previewAssets`, "contains an unsafe asset reference");
      }
    }
  });

  workstreams.forEach((workstream, index) => {
    for (const taskId of array(workstream.taskIds ?? [], `graph.workstreams[${index}].taskIds`)) {
      if (!taskById.has(taskId)) fail(`graph.workstreams[${index}]`, `references missing task ${taskId}`);
    }
  });
  risks.forEach((risk, index) => {
    if (!["low", "medium", "high", "critical"].includes(risk.severity)) fail(`graph.risks[${index}].severity`, "is unknown");
    if (!["open", "monitoring", "mitigated", "closed"].includes(risk.status)) fail(`graph.risks[${index}].status`, "is unknown");
    validateDate(risk.dueDate, `graph.risks[${index}].dueDate`);
  });
  metrics.forEach((metric, index) => {
    if (!["pending", "on-track", "at-risk", "off-track"].includes(metric.status)) fail(`graph.metrics[${index}].status`, "is unknown");
    validateDate(metric.asOf, `graph.metrics[${index}].asOf`);
  });
  return graph;
}

export function validateModuleConfiguration(module, definition, position) {
  object(module, `modules[${position}]`);
  const allowedKeys = new Set(["type", "schemaVersion", "position", "enabled", "viewVariant"]);
  for (const key of Object.keys(module)) if (!allowedKeys.has(key)) fail(`modules[${position}].${key}`, "is not allowed");
  if (module.type !== definition.type) fail(`modules[${position}].type`, `must be ${definition.type}`);
  if (!semanticVersionPattern.test(module.schemaVersion) || module.schemaVersion !== definition.schemaVersion) {
    fail(`modules[${position}].schemaVersion`, `must be ${definition.schemaVersion}`);
  }
  if (!Number.isInteger(module.position) || module.position !== position) fail(`modules[${position}].position`, `must be ${position}`);
  if (typeof module.enabled !== "boolean") fail(`modules[${position}].enabled`, "must be boolean");
  if (!definition.allowedViews.includes(module.viewVariant)) fail(`modules[${position}].viewVariant`, "is not allowed");
  return module;
}

export function validateStoredModuleConfiguration(value, definition, position) {
  object(value, `storedModules[${position}]`);
  const keys = Object.keys(value);
  if (keys.some(key => !["schemaVersion", "viewVariant"].includes(key))) fail(`storedModules[${position}]`, "contains unknown configuration");
  return validateModuleConfiguration({
    type: definition.type,
    schemaVersion: value.schemaVersion,
    position,
    enabled: true,
    viewVariant: value.viewVariant
  }, definition, position);
}
