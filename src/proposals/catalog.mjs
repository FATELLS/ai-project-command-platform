const commonTaskFields = ["title", "unitId", "parentId", "dependsOn", "startDate", "endDate", "progress", "owner", "state", "expectedOutput"];
const fields = Object.freeze({
  overview: ["title", "summary", "status"],
  units: ["name", "description", "owner"],
  roadmap: ["title", "date", "description", "state"],
  "task-network": commonTaskFields,
  gantt: commonTaskFields,
  outcomes: ["title", "date", "state", "description", "result", "source"],
  risks: ["title", "severity", "status", "owner", "mitigation", "dueDate", "source"],
  metrics: ["name", "value", "unit", "status", "asOf", "target", "source"]
});

const highImpactFields = Object.freeze(["progress", "status", "state", "owner", "startDate", "endDate", "date", "dueDate", "asOf", "value", "target", "result", "source"]);

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
  template("new-project-material", "新项目材料", ["overview", "units", "roadmap", "task-network", "risks", "metrics"], { overview: ["update"], units: ["create"], roadmap: ["create"], "task-network": ["create"], risks: ["create"], metrics: ["create"] })
]);

export function getProposalTemplate(id, version = "1.0.0") {
  return proposalTemplates.find(item => item.id === id && item.version === version);
}
