// 任务卡片通用字段——PMBOK 归并的通用项目元素。
// 分三档：P0 必选（任何材料都该能提取）、P1 条件必选（看材料类型）、P2 可选增强（多次累积）。
// 提取端（prompt-builder）和输入端（上传引导）共用同一套分级规则。
//
// 存储映射（Table + JSON 混合模式）:
//   P0 必备字段 → project_cards 表列（支持 WHERE / ORDER BY / INDEX）
//   P1/P2/类型特有 → card_attrs JSON（灵活追加）

// P0 公共必备字段——所有卡片类型都有，存为表列
const cardColumnFields = [
  "title",        // 标题（unit 用 name，metric 用 name，映射到 title 列）
  "owner",        // 负责人
  "state",        // 状态
  "objective",    // 目标/范围
  "startDate",    // 开始日期
  "endDate",      // 截止日期
  "progress",     // 进度：0-100
  "health",       // 健康度：on-track / at-risk / off-track
  "unitId",       // 所属作战单元（结构关系）
  "parentId",     // 父任务（结构关系）
  "dependsOn"     // 前置依赖（结构关系）
];

// P1/P2 + 类型特有字段——追加到 card_attrs JSON
const cardAttrsFields = [
  "stakeholders",       // 相关方 JSON 数组
  "deliverables",       // 交付物 JSON 数组
  "risks",              // 任务级风险 JSON 数组
  "acceptanceCriteria", // 验收标准
  "decisions",          // 决策记录 JSON 数组
  "expectedOutput",     // 预期产出（acceptanceCriteria 缺失时兜底）
  // —— 类型特有字段（按 element_type 不同出现在 card_attrs 里）——
  "severity",           // risk: low/medium/high/critical
  "mitigation",         // risk: 缓解措施
  "dueDate",            // risk: 截止日期（映射到 end_date 列）
  "value",              // metric: 当前值
  "target",             // metric: 目标值
  "unit",               // metric: 单位
  "asOf",               // metric: 时间点（映射到 start_date 列）
  "status",             // unit/metric: 细分状态
  "source",             // 通用：来源
  "dateLabel",          // stage/outcome: 日期标签
  "description",        // stage/outcome/workstream: 描述
  "result"              // outcome: 结果
];

// 合并后的完整字段列表（向后兼容）
const commonTaskFields = [...cardColumnFields, ...cardAttrsFields];

const fields = Object.freeze({
  overview: ["title", "summary", "status"],
  units: ["name", "description", "owner", "status", "effectiveDate", "lifecycleReason", "source"],
  roadmap: ["title", "date", "description", "state"],
  "task-network": commonTaskFields,
  gantt: commonTaskFields,
  outcomes: ["title", "date", "state", "description", "result", "source"],
  risks: ["title", "severity", "status", "owner", "mitigation", "dueDate", "source"],
  metrics: ["name", "value", "unit", "status", "asOf", "target", "source"]
});

const highImpactFields = Object.freeze([
  "progress", "status", "state", "owner", "startDate", "endDate", "date", "dueDate",
  "asOf", "effectiveDate", "lifecycleReason", "value", "target", "result", "source",
  "health", "acceptanceCriteria"
]);

function template(id, label, modules, operations) {
  return Object.freeze({ id, version: "1.0.0", label, schemaVersion: "change-proposal-v1@1.0.0", maxChanges: 100,
    modules: Object.freeze([...modules]), operations: Object.freeze(Object.fromEntries(Object.entries(operations).map(([key, value]) => [key, Object.freeze([...value])]))),
    patchFields: Object.freeze(Object.fromEntries(modules.map(module => [module, Object.freeze([...(fields[module] ?? [])])]))), highImpactFields });
}

export const proposalTemplates = Object.freeze([
  template("meeting-notes", "会议纪要", ["task-network", "risks", "outcomes"], { "task-network": ["create", "update"], risks: ["create", "update"], outcomes: ["create", "update"] }),
  template("project-plan", "项目计划", ["units", "roadmap", "task-network", "risks", "metrics"], { units: ["create", "update"], roadmap: ["create", "update"], "task-network": ["create", "update", "delete"], risks: ["create", "update", "delete"], metrics: ["create", "update"] }),
  template("progress-report", "进度汇报", ["task-network", "risks", "outcomes", "metrics"], { "task-network": ["create", "update"], risks: ["create", "update"], outcomes: ["create", "update"], metrics: ["create", "update"] }),
  template("metrics-data", "指标数据", ["metrics"], { metrics: ["create", "update"] }),
  template("outcome-archive", "成果归档", ["outcomes"], { outcomes: ["create", "update"] }),
  template("new-project-material", "新项目材料", ["overview", "units", "roadmap", "task-network", "risks", "metrics"], { overview: ["update"], units: ["create"], roadmap: ["create"], "task-network": ["create"], risks: ["create"], metrics: ["create"] }),
  template("interaction", "交互提案", ["task-network", "units", "roadmap", "gantt"], { "task-network": ["create", "update"], units: ["create", "update"], roadmap: ["create", "update"], gantt: ["create", "update"] })
]);

// 卡片元素分级——提取端（prompt-builder）和输入端（上传引导）共用。
export const cardElementLevels = Object.freeze({
  required: Object.freeze(["title", "objective", "owner", "stakeholders", "startDate", "endDate", "state", "progress", "health"]),
  conditional: Object.freeze(["deliverables", "risks"]),
  optional: Object.freeze(["acceptanceCriteria", "decisions"])
});

// 存储映射：公共字段 → 表列，差异字段 → card_attrs JSON
export const cardStorageMap = Object.freeze({
  columns: Object.freeze(cardColumnFields),
  attrs: Object.freeze(cardAttrsFields)
});

export function getProposalTemplate(id, version = "1.0.0") {
  return proposalTemplates.find(item => item.id === id && item.version === version);
}
