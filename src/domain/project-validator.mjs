const stableIdPattern = /^[a-z0-9][a-z0-9._-]*$/;

export class ProjectValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectValidationError";
    this.code = "PROJECT_VALIDATION_FAILED";
  }
}

function fail(label, message) {
  throw new ProjectValidationError(`${label}: ${message}`);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(label, "must be an array");
  return value;
}

function requireStableId(value, label) {
  if (typeof value !== "string" || !stableIdPattern.test(value)) {
    fail(label, "must be a stable lowercase ID");
  }
  return value;
}

function indexById(items, label) {
  const result = new Map();
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(`${label}[${index}]`, "must be an object");
    const id = requireStableId(item.id, `${label}[${index}].id`);
    if (result.has(id)) fail(label, `contains duplicate ID ${id}`);
    result.set(id, item);
  }
  return result;
}

function validateDateRange(task, label) {
  if (!task.startDate || !task.endDate) return;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(task.startDate) || !isoDate.test(task.endDate)) fail(label, "has an invalid ISO date range");
  if (task.startDate > task.endDate) fail(label, "starts after it ends");
}

function validateTaskGraph(tasks, taskById, unitById, label) {
  const edges = new Map();
  for (const [index, task] of tasks.entries()) {
    const taskLabel = `${label}.tasks[${index}]`;
    if (!unitById.has(task.groupId)) fail(taskLabel, `references missing unit ${task.groupId}`);
    if (task.progress !== null && task.progress !== undefined &&
        (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100)) {
      fail(taskLabel, "progress must be null or between 0 and 100");
    }
    validateDateRange(task, taskLabel);
    const links = [];
    if (task.parentId) links.push(task.parentId);
    for (const dependency of requireArray(task.dependsOn ?? [], `${taskLabel}.dependsOn`)) links.push(dependency);
    for (const linkedId of links) {
      requireStableId(linkedId, `${taskLabel}.link`);
      if (linkedId === task.id) fail(taskLabel, "cannot link to itself");
      const linked = taskById.get(linkedId);
      if (!linked) fail(taskLabel, `references missing task ${linkedId}`);
      if (linked.groupId !== task.groupId) fail(taskLabel, `has cross-unit link to ${linkedId}`);
    }
    edges.set(task.id, [...new Set(links)]);
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) fail(label, `task graph contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of edges.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of edges.keys()) visit(id);
}

export function validateProjectSnapshot(snapshot, label = "snapshot") {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) fail(label, "must be an object");
  if (typeof snapshot.title !== "string" || !snapshot.title.trim()) fail(label, "requires a title");
  if (typeof snapshot.version !== "string" || !snapshot.version.trim()) fail(label, "requires a version");

  const groups = requireArray(snapshot.groups, `${label}.groups`);
  const stages = requireArray(snapshot.stages, `${label}.stages`);
  const tasks = requireArray(snapshot.tasks, `${label}.tasks`);
  const closures = requireArray(snapshot.closures ?? [], `${label}.closures`);
  const workstreams = requireArray(snapshot.companyWorkstreams ?? [], `${label}.companyWorkstreams`);
  const unitById = indexById(groups, `${label}.groups`);
  indexById(stages, `${label}.stages`);
  indexById(closures, `${label}.closures`);
  const taskById = indexById(tasks, `${label}.tasks`);
  const workstreamById = indexById(workstreams, `${label}.companyWorkstreams`);
  validateTaskGraph(tasks, taskById, unitById, label);

  for (const [id, workstream] of workstreamById) {
    for (const taskId of requireArray(workstream.taskIds ?? [], `${label}.companyWorkstreams.${id}.taskIds`)) {
      if (!taskById.has(taskId)) fail(label, `workstream ${id} references missing task ${taskId}`);
    }
  }

  return {
    version: snapshot.version,
    units: groups.length,
    tasks: tasks.length,
    stages: stages.length,
    closures: closures.length,
    workstreams: workstreams.length
  };
}

export function validateLegacyFixture(fixture) {
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) fail("fixture", "must be an object");
  const materials = requireArray(fixture.materials ?? [], "fixture.materials");
  if (materials.length) fail("fixture.materials", "Phase 1 imports sanitized fixtures only");
  return {
    published: validateProjectSnapshot(fixture.published, "published"),
    draft: validateProjectSnapshot(fixture.draft, "draft")
  };
}
