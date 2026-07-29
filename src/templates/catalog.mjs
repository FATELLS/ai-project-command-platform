import { deepFreeze, validateTemplateManifest } from "./template-validator.mjs";

const moduleOrder = ["overview", "roadmap", "units", "task-network", "gantt", "risks", "metrics", "materials"];

function modules(config) {
  return moduleOrder.map((type, position) => ({
    type,
    schemaVersion: "1.0.0",
    position,
    required: type === "overview",
    enabled: true,
    title: config[type].title,
    viewVariant: config[type].viewVariant,
    emptyState: config[type].emptyState
  }));
}

function manifest(value) {
  validateTemplateManifest(value);
  return deepFreeze(value);
}

export const campaignMapTemplate = manifest({
  id: "campaign-map-v1",
  version: "1.0.0",
  name: "Campaign Map",
  theme: {
    preset: "xugu-blue",
    accent: "#1265f2",
    palette: ["xugu-blue", "white", "warm-orange"],
    canvas: "warm-command"
  },
  terminology: {
    preset: "campaign",
    overview: "作战总览",
    unit: "作战单元",
    task: "行动任务",
    stage: "战役节点",
    outcome: "战果档案",
    workstream: "公司级战线",
    risk: "风险",
    metric: "指标",
    material: "项目材料"
  },
  fields: [
    { id: "name", label: "项目名称", type: "text", required: true },
    { id: "goal", label: "作战目标", type: "long-text", required: false },
    { id: "summary", label: "当前战况", type: "long-text", required: false },
    { id: "projectStatus", label: "项目状态", type: "status", required: true }
  ],
  statuses: [
    { id: "planning", label: "规划中" },
    { id: "active", label: "作战中" },
    { id: "completed", label: "已完成" }
  ],
  validation: { projectNameMinLength: 2, projectNameMaxLength: 80 },
  defaultView: "overview",
  requiredModules: ["overview"],
  copy: {
    banner: "XUGU AGENTIC GROUP SCHEDULE",
    status: "当前战况",
    emptyProjectSummary: "项目已创建，待配置作战单元和战役路线。"
  },
  modules: modules({
    overview: { title: "作战总览", viewVariant: "mission-status", emptyState: "项目概览尚待补充" },
    roadmap: { title: "战役路线", viewVariant: "campaign-network", emptyState: "尚未建立战役路线" },
    units: { title: "作战单元", viewVariant: "campaign-cards", emptyState: "尚未建立作战单元" },
    "task-network": { title: "任务网络", viewVariant: "branching-network", emptyState: "暂无行动任务" },
    gantt: { title: "甘特协同", viewVariant: "branching", emptyState: "暂无可展示的甘特任务" },
    risks: { title: "风险台账", viewVariant: "risk-register", emptyState: "暂无已登记风险" },
    metrics: { title: "效果指标", viewVariant: "metric-cards", emptyState: "暂无已登记指标" },
    materials: { title: "项目材料", viewVariant: "materials-empty", emptyState: "项目材料功能将在下一阶段开放" }
  })
});

export const standardProjectTemplate = manifest({
  id: "standard-project-v1",
  version: "1.0.0",
  name: "Standard Project",
  theme: {
    preset: "neutral-blue",
    accent: "#5f7088",
    palette: ["neutral-blue", "white", "soft-gray"],
    canvas: "warm-command"
  },
  terminology: {
    preset: "standard",
    overview: "项目总览",
    unit: "团队",
    task: "任务",
    stage: "里程碑",
    outcome: "交付物",
    workstream: "工作流",
    risk: "风险",
    metric: "指标",
    material: "项目材料"
  },
  fields: [
    { id: "name", label: "项目名称", type: "text", required: true },
    { id: "goal", label: "项目目标", type: "long-text", required: false },
    { id: "summary", label: "项目摘要", type: "long-text", required: false },
    { id: "projectStatus", label: "项目状态", type: "status", required: true }
  ],
  statuses: [
    { id: "planning", label: "规划中" },
    { id: "active", label: "进行中" },
    { id: "completed", label: "已完成" }
  ],
  validation: { projectNameMinLength: 2, projectNameMaxLength: 80 },
  defaultView: "overview",
  requiredModules: ["overview"],
  copy: {
    banner: "STANDARD PROJECT SCHEDULE",
    status: "当前状态",
    emptyProjectSummary: "项目已创建，待配置团队、任务与里程碑。"
  },
  modules: modules({
    overview: { title: "项目总览", viewVariant: "mission-status", emptyState: "项目概览尚待补充" },
    roadmap: { title: "项目路线", viewVariant: "linear-roadmap", emptyState: "尚未建立项目路线" },
    units: { title: "团队", viewVariant: "team-cards", emptyState: "尚未建立团队" },
    "task-network": { title: "任务依赖", viewVariant: "dependency-list", emptyState: "暂无任务" },
    gantt: { title: "项目甘特", viewVariant: "lanes", emptyState: "暂无可展示的甘特任务" },
    risks: { title: "风险台账", viewVariant: "risk-register", emptyState: "暂无已登记风险" },
    metrics: { title: "项目指标", viewVariant: "metric-cards", emptyState: "暂无已登记指标" },
    materials: { title: "项目材料", viewVariant: "materials-empty", emptyState: "项目材料功能将在下一阶段开放" }
  })
});

export const templateCatalog = deepFreeze({
  "campaign-map-v1": { "1.0.0": campaignMapTemplate },
  "standard-project-v1": { "1.0.0": standardProjectTemplate }
});

export function resolveTemplate(templateId, version = "1.0.0") {
  const resolved = templateCatalog[templateId]?.[version];
  if (!resolved) throw new Error(`Unknown template ${templateId}@${version}`);
  return resolved;
}

export function listTemplates() {
  return Object.values(templateCatalog).flatMap(versions => Object.values(versions));
}

export function templateConfigJson(template) {
  validateTemplateManifest(template);
  return JSON.stringify(template);
}
