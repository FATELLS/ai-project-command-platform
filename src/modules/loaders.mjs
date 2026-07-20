function optional(value) {
  return value === "" || value === undefined ? null : value;
}

function currentStageId(graph) {
  const value = graph.metadata.currentStage;
  if (Number.isInteger(value)) return graph.stages[value]?.id ?? null;
  if (typeof value === "string" && graph.stages.some(stage => stage.id === value)) return value;
  return null;
}

export function loadOverview(graph) {
  return {
    goal: optional(graph.metadata.goal),
    summary: optional(graph.metadata.summary),
    statusLabel: optional(graph.metadata.statusLabel),
    currentStageId: currentStageId(graph),
    overallProgress: graph.metadata.overallProgress ?? null,
    facts: [
      { id: "units", value: graph.units.length },
      { id: "tasks", value: graph.tasks.length },
      { id: "stages", value: graph.stages.length },
      { id: "outcomes", value: graph.closures.length }
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
  return {
    currentStageId: currentStageId(graph),
    stages: graph.stages.map(stage => ({
      id: stage.id,
      title: stage.title,
      state: optional(stage.state),
      dateLabel: optional(stage.dateLabel),
      description: optional(stage.description),
      expectedOutput: optional(stage.expectedOutput),
      previewTitle: optional(stage.previewTitle),
      previewCaption: optional(stage.previewCaption),
      previewAssets: Array.isArray(stage.previewImages) ? [...stage.previewImages] : []
    })),
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
      previewAssets: [...closure.previewAssets]
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
