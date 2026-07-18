const stableIdPattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+$/;

export const moduleViewVariants = Object.freeze({
  overview: Object.freeze(["mission-status"]),
  units: Object.freeze(["campaign-cards", "team-cards"]),
  roadmap: Object.freeze(["campaign-network", "linear-roadmap"]),
  "task-network": Object.freeze(["branching-network", "dependency-list"]),
  gantt: Object.freeze(["branching", "lanes"]),
  outcomes: Object.freeze(["closure-detail", "archive-grid"]),
  risks: Object.freeze(["risk-register"]),
  metrics: Object.freeze(["metric-cards"]),
  materials: Object.freeze(["materials-empty"])
});

const moduleTypes = Object.freeze(Object.keys(moduleViewVariants));
const topLevelKeys = new Set([
  "id", "version", "name", "theme", "terminology", "fields", "statuses",
  "validation", "defaultView", "requiredModules", "copy", "modules"
]);
const executableKeyPattern = /(?:component|renderer|templatePath|modulePath|script|javascript|html|css|sql|shell|command|executable|dynamicImport)/i;
const executableValuePattern = /(?:<\/?(?:script|style|svg|iframe)\b|javascript\s*:|data\s*:\s*text\/html|\bimport\s*\(|\brequire\s*\(|(?:^|[/\\])[\w.-]+\.(?:m?js|cjs|html|css)(?:$|[?#]))/i;

export class TemplateValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TemplateValidationError";
    this.code = "TEMPLATE_VALIDATION_FAILED";
  }
}

function fail(path, message) {
  throw new TemplateValidationError(`${path}: ${message}`);
}

function plainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(path, "must be a plain object");
  }
  return value;
}

function nonEmptyString(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-empty string");
  return value;
}

function stringArray(value, path) {
  if (!Array.isArray(value)) fail(path, "must be an array");
  return value.map((item, index) => nonEmptyString(item, `${path}[${index}]`));
}

function inspectPlainData(value, path = "template", seen = new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") {
    if (executableValuePattern.test(value)) fail(path, "must not contain executable content or a component path");
    return;
  }
  if (typeof value !== "object") fail(path, "must contain JSON-compatible data only");
  if (seen.has(value)) fail(path, "must not contain circular references");
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPlainData(item, `${path}[${index}]`, seen));
  } else {
    plainObject(value, path);
    for (const [key, child] of Object.entries(value)) {
      if (executableKeyPattern.test(key) || /^on[A-Z]/.test(key) || /^on[a-z]+$/i.test(key)) {
        fail(`${path}.${key}`, "executable configuration keys are not allowed");
      }
      inspectPlainData(child, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function validateTheme(theme) {
  plainObject(theme, "template.theme");
  const allowed = new Set(["preset", "accent", "palette", "canvas"]);
  for (const key of Object.keys(theme)) if (!allowed.has(key)) fail(`template.theme.${key}`, "is not allowed");
  nonEmptyString(theme.preset, "template.theme.preset");
  if (!/^#[0-9a-f]{6}$/i.test(theme.accent)) fail("template.theme.accent", "must be a six-digit hex color");
  const palette = stringArray(theme.palette, "template.theme.palette");
  if (palette.length < 2) fail("template.theme.palette", "must contain at least two tokens");
  nonEmptyString(theme.canvas, "template.theme.canvas");
}

function validateTerminology(terminology) {
  plainObject(terminology, "template.terminology");
  const required = ["preset", "overview", "unit", "task", "stage", "outcome", "workstream", "risk", "metric", "material"];
  for (const key of required) nonEmptyString(terminology[key], `template.terminology.${key}`);
  for (const key of Object.keys(terminology)) if (!required.includes(key)) fail(`template.terminology.${key}`, "is not allowed");
}

function validateFields(fields) {
  if (!Array.isArray(fields) || !fields.length) fail("template.fields", "must be a non-empty array");
  const ids = new Set();
  fields.forEach((field, index) => {
    plainObject(field, `template.fields[${index}]`);
    const allowed = new Set(["id", "label", "type", "required"]);
    for (const key of Object.keys(field)) if (!allowed.has(key)) fail(`template.fields[${index}].${key}`, "is not allowed");
    const id = nonEmptyString(field.id, `template.fields[${index}].id`);
    if (ids.has(id)) fail("template.fields", `contains duplicate field ${id}`);
    ids.add(id);
    nonEmptyString(field.label, `template.fields[${index}].label`);
    if (!["text", "long-text", "status"].includes(field.type)) fail(`template.fields[${index}].type`, "is unknown");
    if (typeof field.required !== "boolean") fail(`template.fields[${index}].required`, "must be boolean");
  });
}

function validateStatuses(statuses) {
  if (!Array.isArray(statuses) || !statuses.length) fail("template.statuses", "must be a non-empty array");
  const ids = new Set();
  statuses.forEach((status, index) => {
    plainObject(status, `template.statuses[${index}]`);
    const allowed = new Set(["id", "label"]);
    for (const key of Object.keys(status)) if (!allowed.has(key)) fail(`template.statuses[${index}].${key}`, "is not allowed");
    const id = nonEmptyString(status.id, `template.statuses[${index}].id`);
    if (ids.has(id)) fail("template.statuses", `contains duplicate status ${id}`);
    ids.add(id);
    nonEmptyString(status.label, `template.statuses[${index}].label`);
  });
}

function validateCopy(copy) {
  plainObject(copy, "template.copy");
  const required = ["banner", "status", "emptyProjectSummary"];
  for (const key of required) nonEmptyString(copy[key], `template.copy.${key}`);
  for (const key of Object.keys(copy)) if (!required.includes(key)) fail(`template.copy.${key}`, "is not allowed");
}

function validateModules(modules, requiredModules) {
  if (!Array.isArray(modules) || modules.length !== moduleTypes.length) {
    fail("template.modules", `must contain exactly ${moduleTypes.length} modules`);
  }
  const seen = new Set();
  modules.forEach((module, index) => {
    plainObject(module, `template.modules[${index}]`);
    const allowed = new Set(["type", "schemaVersion", "position", "required", "enabled", "title", "viewVariant", "emptyState"]);
    for (const key of Object.keys(module)) if (!allowed.has(key)) fail(`template.modules[${index}].${key}`, "is not allowed");
    const type = nonEmptyString(module.type, `template.modules[${index}].type`);
    if (!moduleViewVariants[type]) fail(`template.modules[${index}].type`, `unknown module type ${type}`);
    if (seen.has(type)) fail("template.modules", `contains duplicate module type ${type}`);
    seen.add(type);
    if (!semanticVersionPattern.test(module.schemaVersion)) fail(`template.modules[${index}].schemaVersion`, "must be a semantic version");
    if (module.position !== index) fail(`template.modules[${index}].position`, `must be normalized to ${index}`);
    if (typeof module.required !== "boolean" || typeof module.enabled !== "boolean") {
      fail(`template.modules[${index}]`, "required and enabled must be boolean");
    }
    if (module.required !== requiredModules.includes(type)) fail(`template.modules[${index}].required`, "must match requiredModules");
    if (module.required && !module.enabled) fail(`template.modules[${index}].enabled`, "required modules must be enabled");
    nonEmptyString(module.title, `template.modules[${index}].title`);
    nonEmptyString(module.emptyState, `template.modules[${index}].emptyState`);
    if (!moduleViewVariants[type].includes(module.viewVariant)) {
      fail(`template.modules[${index}].viewVariant`, `is not allowed for ${type}@${module.schemaVersion}`);
    }
  });
  for (const type of moduleTypes) if (!seen.has(type)) fail("template.modules", `is missing module type ${type}`);
}

export function validateTemplateManifest(manifest) {
  inspectPlainData(manifest);
  plainObject(manifest, "template");
  for (const key of Object.keys(manifest)) if (!topLevelKeys.has(key)) fail(`template.${key}`, "is not allowed");
  for (const key of topLevelKeys) if (!(key in manifest)) fail(`template.${key}`, "is required");
  if (!stableIdPattern.test(manifest.id)) fail("template.id", "must be a stable lowercase ID");
  if (!semanticVersionPattern.test(manifest.version)) fail("template.version", "must be a semantic version");
  nonEmptyString(manifest.name, "template.name");
  validateTheme(manifest.theme);
  validateTerminology(manifest.terminology);
  validateFields(manifest.fields);
  validateStatuses(manifest.statuses);
  plainObject(manifest.validation, "template.validation");
  if (Object.keys(manifest.validation).some(key => !["projectNameMinLength", "projectNameMaxLength"].includes(key))) {
    fail("template.validation", "contains an unknown validation rule");
  }
  if (!Number.isInteger(manifest.validation.projectNameMinLength) || !Number.isInteger(manifest.validation.projectNameMaxLength) ||
      manifest.validation.projectNameMinLength < 1 || manifest.validation.projectNameMaxLength < manifest.validation.projectNameMinLength) {
    fail("template.validation", "project name bounds are invalid");
  }
  if (manifest.defaultView !== "overview") fail("template.defaultView", "must be overview");
  const requiredModules = stringArray(manifest.requiredModules, "template.requiredModules");
  if (new Set(requiredModules).size !== requiredModules.length) fail("template.requiredModules", "contains duplicates");
  if (!requiredModules.includes("overview")) fail("template.requiredModules", "must include overview");
  for (const type of requiredModules) if (!moduleViewVariants[type]) fail("template.requiredModules", `contains unknown module ${type}`);
  validateCopy(manifest.copy);
  validateModules(manifest.modules, requiredModules);
  return manifest;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
