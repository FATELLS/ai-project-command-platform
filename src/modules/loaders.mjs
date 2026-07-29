function optional(value) {
  return value === "" || value === undefined ? null : value;
}

// 从任务的日期范围自动推导战役阶段（stages）。
// 当项目尚无显式 stages（AI 只生成了任务网络），把有日期的任务
// 按时间窗口聚合成阶段，让路线图（roadmap）可以正常渲染。
function deriveStagesFromTasks(tasks) {
  const scheduled = tasks.filter(task => task.startDate || task.endDate)
    .sort((a, b) => String(a.startDate || a.endDate || "").localeCompare(String(b.startDate || b.endDate || "")));
  if (!scheduled.length) return [];
  return scheduled.map((task, index) => {
    const start = task.startDate || task.endDate;
    const end = task.endDate || task.startDate;
    const dateLabel = start === end ? start : `${start}–${end}`;
    return {
      id: `derived-stage-${index + 1}`,
      sourceTaskId: task.id,
      title: task.title,
      state: task.state || (Number(task.progress) >= 100 ? "已完成" : "进行中"),
      dateLabel,
      description: task.expectedOutput || "",
      expectedOutput: task.expectedOutput || ""
    };
  });
}

function resolveStages(graph) {
  if (graph.stages && graph.stages.length) return graph.stages;
  return deriveStagesFromTasks(graph.tasks ?? []);
}

function currentStageId(graph) {
  const stages = resolveStages(graph);
  const value = graph.metadata.currentStage;
  if (Number.isInteger(value)) return stages[value]?.id ?? null;
  if (typeof value === "string" && stages.some(stage => stage.id === value)) return value;
  return null;
}

// ============================================================
// 统一卡片加载器
// 接收 graph 对象（由 project-repository 从 project_cards 表组装）
// graph 结构: { metadata, modules, units, tasks, stages, closures,
//              workstreams, risks, metrics }
// 每种卡片类型的元素来自 graph 中对应的数组
// ============================================================

export function loadOverview(graph) {
  const stages = resolveStages(graph);
  return {
    goal: optional(graph.metadata.goal),
    summary: optional(graph.metadata.summary),
    statusLabel: optional(graph.metadata.statusLabel),
    currentStageId: currentStageId(graph),
    overallProgress: graph.metadata.overallProgress ?? null,
    facts: [
      { id: "units", value: graph.units.length },
      { id: "tasks", value: graph.tasks.length },
      { id: "stages", value: stages.length }
    ]
  };
}

export function loadUnits(graph) {
  return {
    units: graph.units.map(unit => ({
      id: unit.id,
      name: unit.name,
      short: optional(unit.short),
      owner: optional(unit.owner),
      objective: optional(unit.objective),
      currentWork: optional(unit.currentWork),
      expectedOutput: optional(unit.expectedOutput),
      source: optional(unit.source)
    }))
  };
}

export function loadRoadmap(graph) {
  const stages = resolveStages(graph);
  return {
    currentStageId: currentStageId(graph),
    stages: stages.map(stage => ({
      id: stage.id,
      sourceTaskId: optional(stage.sourceTaskId),
      title: stage.title,
      state: optional(stage.state),
      dateLabel: optional(stage.dateLabel),
      description: optional(stage.description),
      expectedOutput: optional(stage.expectedOutput),
      previewTitle: optional(stage.previewTitle),
      previewCaption: optional(stage.previewCaption),
      previewAssets: Array.isArray(stage.previewImages) ? [...stage.previewImages] : []
    })),
    units: graph.units.map(unit => ({ id: unit.id, name: unit.name, status: optional(unit.status), owner: optional(unit.owner), objective: optional(unit.objective) })),
    tasks: graph.tasks.map(task => ({
      ...task,
      id: task.id,
      unitId: task.unitId,
      parentId: optional(task.parentId),
      title: task.title,
      owner: optional(task.owner),
      state: optional(task.state),
      progress: task.progress ?? null,
      startDate: optional(task.startDate),
      endDate: optional(task.endDate),
      expectedOutput: optional(task.expectedOutput),
      dependsOn: [...(Array.isArray(task.dependsOn) ? task.dependsOn : [])]
    })),
    edges: graph.tasks.flatMap(task => (Array.isArray(task.dependsOn) ? task.dependsOn : []).map(dependencyId => ({ from: dependencyId, to: task.id, kind: "depends-on" }))),
    closures: graph.closures.map(closure => ({
      id: closure.id,
      title: closure.title,
      dateLabel: optional(closure.dateLabel),
      state: optional(closure.state),
      between: [...closure.between],
      description: optional(closure.description),
      result: optional(closure.result),
      source: optional(closure.source)
    })),
    workstreams: graph.workstreams.map(workstream => ({
      id: workstream.id,
      title: workstream.title,
      description: optional(workstream.description),
      taskIds: [...workstream.taskIds]
    }))
  };
}

export function loadTaskNetwork(graph) {
  return {
    units: graph.units.map(unit => ({ id: unit.id, name: unit.name })),
    nodes: graph.tasks.map(task => ({
      id: task.id,
      unitId: task.unitId,
      parentId: optional(task.parentId),
      title: task.title,
      owner: optional(task.owner),
      state: optional(task.state),
      progress: task.progress ?? null
    })),
    edges: graph.tasks.flatMap(task => task.dependsOn.map(dependencyId => ({
      from: dependencyId,
      to: task.id,
      kind: "depends-on"
    })))
  };
}

export function loadGantt(graph) {
  const scheduled = graph.tasks.filter(task => task.startDate && task.endDate);
  const dates = scheduled.flatMap(task => [task.startDate, task.endDate]).sort();
  return {
    range: { start: dates[0] ?? null, end: dates.at(-1) ?? null },
    lanes: graph.units.map(unit => ({
      unitId: unit.id,
      taskIds: graph.tasks.filter(task => task.unitId === unit.id).map(task => task.id)
    })),
    tasks: graph.tasks.map(task => ({
      id: task.id,
      unitId: task.unitId,
      title: task.title,
      startDate: optional(task.startDate),
      endDate: optional(task.endDate),
      progress: task.progress ?? null,
      dependencyIds: [...task.dependsOn]
    })),
    unscheduledIds: graph.tasks.filter(task => !task.startDate || !task.endDate).map(task => task.id)
  };
}

export function loadOutcomes(graph) {
  return {
    outcomes: graph.closures.map(closure => ({
      id: closure.id,
      title: closure.title,
      dateLabel: optional(closure.dateLabel),
      state: optional(closure.state),
      description: optional(closure.description),
      result: optional(closure.result),
      source: optional(closure.source),
      previewAssets: Array.isArray(closure.previewAssets) ? [...closure.previewAssets] : [],
      between: [...closure.between]
    }))
  };
}

export function loadRisks(graph) {
  return { risks: graph.risks.map(risk => ({ ...risk })) };
}

export function loadMetrics(graph) {
  return { metrics: graph.metrics.map(metric => ({ ...metric })) };
}

export function loadMaterials() {
  return {
    availability: "phase-4",
    summary: { count: 0, readyCount: 0 },
    items: []
  };
}
