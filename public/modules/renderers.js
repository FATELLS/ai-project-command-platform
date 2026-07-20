import { definitionList, el, emptyState, formatDay, localScroller, safeText, statusText, svgEl } from "./shared.js";

function cardHeading(kicker, title, copy) {
  return el("header", { className: "module-card-heading" }, [
    el("span", { className: "eyebrow", text: kicker }),
    el("h2", { text: title }),
    copy ? el("p", { text: copy }) : null
  ]);
}

function stateClass(value, current = false) {
  if (current) return "current";
  if (/完成|确认|closed|mitigated/i.test(String(value))) return "complete";
  return "planned";
}

function setQuery(navigate, changes) {
  const params = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  navigate(`${location.pathname}${params.size ? `?${params}` : ""}`);
}

function routePath(points) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const dx = point.x - previous.x;
    return `${path} C ${previous.x + dx / 2},${previous.y} ${point.x - dx / 2},${point.y} ${point.x},${point.y}`;
  }, `M ${points[0].x},${points[0].y}`);
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseStageWindow(label = "") {
  const text = String(label).replace(/\s+/g, " ").trim();
  const range = text.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})\s*[–-]\s*(?:(\d{4})[.-])?(\d{1,2})[.-](\d{1,2})/);
  if (range) return { start: isoDate(range[1], range[2], range[3]), end: isoDate(range[4] ?? range[1], range[5], range[6]) };
  const exact = text.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (exact) return { start: isoDate(exact[1], exact[2], exact[3]), end: isoDate(exact[1], exact[2], exact[3]) };
  const monthStart = text.match(/(\d{4})[.-](\d{1,2})\s*起/);
  if (monthStart) return { start: isoDate(monthStart[1], monthStart[2], 1), end: "" };
  const quarter = text.match(/(\d{4})\s*Q([1-4])/i);
  if (quarter) {
    const startMonth = (Number(quarter[2]) - 1) * 3 + 1;
    return { start: isoDate(quarter[1], startMonth, 1), end: isoDate(quarter[1], startMonth + 2, new Date(Number(quarter[1]), startMonth + 2, 0).getDate()) };
  }
  const half = text.match(/(\d{4})\s*H([12])/i);
  if (half) return half[2] === "1" ? { start: `${half[1]}-01-01`, end: `${half[1]}-06-30` } : { start: `${half[1]}-07-01`, end: `${half[1]}-12-31` };
  return { start: "", end: "" };
}

function overlapsWindow(task, window) {
  if (!window.start && !window.end) return false;
  const start = task.startDate || task.endDate || "";
  const end = task.endDate || task.startDate || "";
  if (!start && !end) return false;
  return (!window.end || start <= window.end) && (!window.start || end >= window.start);
}

function stageBranchGroups(context, stage) {
  const window = parseStageWindow(stage.dateLabel);
  const units = new Map((context.snapshot?.groups ?? []).map(unit => [unit.id, unit.name]));
  const grouped = new Map();
  for (const task of context.snapshot?.tasks ?? []) {
    if (!overlapsWindow(task, window)) continue;
    const unitId = task.groupId ?? task.unitId ?? "unknown";
    const items = grouped.get(unitId) ?? [];
    items.push(task);
    grouped.set(unitId, items);
  }
  return [...grouped.entries()].map(([unitId, tasks]) => ({
    unitId,
    unitName: units.get(unitId) ?? unitId,
    tasks: tasks.sort((left, right) => safeText(left.startDate, "9999").localeCompare(safeText(right.startDate, "9999")) || safeText(left.title).localeCompare(safeText(right.title)))
  })).sort((left, right) => left.unitName.localeCompare(right.unitName, "zh-CN"));
}

function taskInlineDetail(context, task, unitName = "") {
  if (!task) return null;
  return el("article", { className: "inline-task-detail" }, [
    el("span", { className: "eyebrow", text: `${unitName ? `${unitName} · ` : ""}${context.presentation.task}` }),
    el("h4", { text: task.title }),
    definitionList([["状态", task.state], ["负责人", task.owner], ["开始", task.startDate], ["结束", task.endDate], ["进度", Number.isFinite(task.progress) ? `${task.progress}%` : ""], ["预期产出", task.expectedOutput], ["来源", task.source]]),
    el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/task-network?task=${encodeURIComponent(task.id)}`, text: "在任务网络中查看" })
  ]);
}

function unitRouteDetail(context, unit) {
  const unitTasks = (context.snapshot?.tasks ?? []).filter(task => task.groupId === unit.id);
  const selectedTask = unitTasks.find(task => task.id === context.query.get("task"));
  const stages = context.snapshot?.stages ?? [];
  const lanes = stages.map(stage => {
    const stageLike = { ...stage, dateLabel: stage.dateLabel ?? stage.date };
    return { stage: stageLike, tasks: unitTasks.filter(task => overlapsWindow(task, parseStageWindow(stageLike.dateLabel))) };
  }).filter(item => item.tasks.length);
  return el("section", { className: "unit-card-detail", tabIndex: -1 }, [
    el("header", {}, [el("span", { className: "eyebrow", text: "UNIT ROUTE" }), el("h4", { text: `${unit.name}路线与节点` })]),
    lanes.length ? el("div", { className: "unit-route-lanes" }, lanes.map(({ stage, tasks }) => el("article", { className: "unit-route-node" }, [
      el("div", { className: "unit-route-head" }, [
        el("strong", { text: stage.title }),
        el("small", { text: `${safeText(stage.dateLabel, "日期待确认")} · ${tasks.length} ${context.presentation.task}` })
      ]),
      el("div", { className: "unit-route-tasks" }, tasks.map(task => el("div", { className: `unit-route-task${task.id === selectedTask?.id ? " selected" : ""}` }, [
        el("button", {
          type: "button",
          className: "stage-task-chip",
          ariaPressed: task.id === selectedTask?.id ? "true" : "false",
          onClick: () => setQuery(context.navigate, { unit: unit.id, task: task.id })
        }, [el("strong", { text: task.title }), el("small", { text: `${safeText(task.startDate, "待排期")} → ${safeText(task.endDate, "待确认")} · ${statusText(task.state)}` })]),
        task.id === selectedTask?.id ? taskInlineDetail(context, task, unit.name) : null
      ])))
    ]))) : el("p", { className: "empty-source", text: `当前发布数据还没有能按时间窗口归入${unit.name}的路线任务。` }),
    el("div", { className: "detail-actions" }, [
      el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/task-network?unit=${encodeURIComponent(unit.id)}`, text: "查看任务网络" }),
      el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/gantt?unit=${encodeURIComponent(unit.id)}`, text: "查看甘特" })
    ])
  ]);
}

export function renderOverview(context) {
  const { data, project, presentation, snapshot } = context;
  const facts = new Map((data.facts ?? []).map(fact => [fact.id, fact.value]));
  const factLabels = {
    units: presentation.unit,
    tasks: presentation.task,
    stages: presentation.stage,
    outcomes: presentation.outcome
  };
  const currentStage = (snapshot?.stages ?? []).find(stage => stage.id === data.currentStageId);
  const currentLabel = currentStage?.title ?? data.statusLabel ?? "待配置";
  return el("div", { className: "overview-module" }, [
    el("section", { className: "project-hero goal-hero" }, [
      el("div", { className: "hero-copy goal-copy" }, [
        el("span", { className: "single-goal", text: presentation.heroKicker }),
        el("h1", { text: project.name }),
        el("div", { className: "project-id", text: project.id }),
        el("p", { text: data.summary ?? data.goal ?? "项目概览尚待补充" }),
        el("div", { className: "hero-badges goal-tags" }, [
          el("span", { className: "badge active", text: project.status === "active" ? "进行中" : project.status }),
          el("span", { className: "badge role", text: context.roleLabel }),
          el("span", { className: "badge version", text: context.version }),
          el("span", { className: "badge archived", text: context.templateLabel })
        ])
      ]),
      el("aside", { className: "overall-card campaign-status-card" }, [
        el("div", { className: "planning-orbit", ariaHidden: "true" }, [el("i"), el("b", { text: "PLAN" })]),
        el("div", { className: "overall-copy" }, [
          el("small", { text: presentation.currentKicker }),
          el("b", { text: currentLabel }),
          el("span", { text: data.statusLabel ?? "依据已发布项目事实推进当前工作" }),
          el("div", { className: "planning-badge", text: data.overallProgress == null ? "暂无正式完成率" : `正式完成率 ${data.overallProgress}%` })
        ]),
        el("img", { src: "/assets/transformation-group-transparent-v2.png", alt: "" })
      ])
    ]),
    el("section", { className: "fact-grid", ariaLabel: "项目事实计数" }, ["units", "tasks", "stages", "outcomes"].map(id =>
      el("article", { className: "fact-card" }, [el("strong", { text: String(facts.get(id) ?? 0) }), el("span", { text: factLabels[id] })]))),
    el("div", { className: "detail-grid" }, [
      el("section", { className: "detail-panel" }, [
        el("h2", { text: "当前状态" }),
        definitionList([
          ["状态说明", data.statusLabel], ["当前阶段", currentLabel],
          ["正式完成率", data.overallProgress == null ? "暂无正式完成率" : `${data.overallProgress}%`],
          ["更新时间", context.updatedAt], ["发布版本", context.version]
        ], "detail-list")
      ]),
      el("section", { className: "detail-panel" }, [
        el("h2", { text: "发布数据边界" }),
        el("p", { className: "boundary-note", text: "当前页面只读取已发布数据。草稿模块配置不会立即改变本页，审核与发布仍属于后续受控工作流。" })
      ])
    ])
  ]);
}

export function renderUnits(context) {
  const units = Array.isArray(context.data.units) ? context.data.units : [];
  if (!units.length) return emptyState(context.module.emptyState, `需要由获授权成员补充已确认的${context.presentation.unit}数据。`);
  const taskCounts = new Map();
  for (const task of context.snapshot?.tasks ?? []) taskCounts.set(task.groupId, (taskCounts.get(task.groupId) ?? 0) + 1);
  const selectedId = context.query.get("unit");
  const selected = units.find(unit => unit.id === selectedId);
  const lifecycle = unit => unit.status === "archived" ? "已归档" : unit.status === "exited" ? "已退出" : "活跃";
  const grid = el("div", { className: "unit-grid" }, units.map(unit => el("article", { className: `unit-card${selected?.id === unit.id ? " selected" : ""}` }, [
    el("div", { className: "unit-card-top" }, [
      el("span", { className: "unit-mark", ariaHidden: "true", text: safeText(unit.short, unit.name.slice(0, 1)) }),
      el("span", { className: "count-pill", text: `${taskCounts.get(unit.id) ?? 0} ${context.presentation.task}` }),
      el("span", { className: `unit-lifecycle unit-${unit.status ?? "active"}`, text: lifecycle(unit) })
    ]),
    el("h3", { text: unit.name }),
    el("p", { className: "unit-owner", text: safeText(unit.owner, "负责人待确认") }),
    el("p", { text: safeText(unit.objective, "目标待补充") }),
    definitionList([["当前工作", unit.currentWork], ["预期产出", unit.expectedOutput], ["生命周期", `${lifecycle(unit)}${unit.effectiveDate ? ` · ${formatDay(unit.effectiveDate)}` : ""}`], ["原因", unit.lifecycleReason], ["来源", unit.source]]),
    el("button", { type: "button", className: "secondary-button", text: selected?.id === unit.id ? `收起${context.presentation.unit}详情` : `查看${context.presentation.unit}详情`, onClick: () => setQuery(context.navigate, { unit: selected?.id === unit.id ? "" : unit.id, task: "" }) }),
    selected?.id === unit.id ? unitRouteDetail(context, unit) : null
  ])));
  return el("section", { className: "module-primary-card" }, [
    cardHeading("UNITS · FIXED REGISTRY", context.module.title, `${units.length} 个${context.presentation.unit}，全部来自当前发布版本。`),
    grid
  ]);
}

function roadmapSvg(context, stages, selectedStageId, branchGroups = [], selectedUnitId = "") {
  const width = Math.max(760, stages.length * 180 + 80);
  const height = context.module.viewVariant === "campaign-network" ? 390 : 290;
  const svg = svgEl("svg", { class: "roadmap-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "roadmap-svg-title roadmap-svg-desc" });
  svg.append(svgEl("title", { id: "roadmap-svg-title" }, []), svgEl("desc", { id: "roadmap-svg-desc" }, []));
  svg.querySelector("title").textContent = `${context.module.title}可视化`;
  svg.querySelector("desc").textContent = `${stages.length} 个顺序阶段；完整文本见图后列表。`;
  const points = stages.map((_, index) => ({
    x: stages.length === 1 ? width / 2 : 70 + index * ((width - 140) / (stages.length - 1)),
    y: context.module.viewVariant === "campaign-network" ? 135 + (index % 2 ? 30 : -15) : 115
  }));
  if (stages.length > 1) {
    svg.append(svgEl("path", { d: routePath(points), class: "route-line", fill: "none" }));
  }
  stages.forEach((stage, index) => {
    const { x, y } = points[index];
    const group = svgEl("g", {
      class: `route-node ${stateClass(stage.state, stage.id === context.data.currentStageId)}${stage.id === selectedStageId ? " selected" : ""}`,
      tabindex: "0",
      role: "button",
      "aria-pressed": stage.id === selectedStageId ? "true" : "false",
      "aria-label": `${index + 1}. ${stage.title}，${statusText(stage.state)}，${safeText(stage.dateLabel, "日期待确认")}`,
      "data-stage-id": stage.id
    });
    group.append(svgEl("circle", { cx: x, cy: y, r: 28 }), svgEl("circle", { cx: x, cy: y, r: 40, class: "route-hit" }));
    const number = svgEl("text", { x, y: y + 5, "text-anchor": "middle", class: "route-number" }); number.textContent = String(index + 1);
    const label = svgEl("text", { x, y: y + 62, "text-anchor": "middle", class: "route-label" }); label.textContent = stage.title;
    const date = svgEl("text", { x, y: y + 82, "text-anchor": "middle", class: "route-date" }); date.textContent = safeText(stage.dateLabel, "待确认");
    group.append(number, label, date);
    svg.append(group);
  });
  const selectedIndex = stages.findIndex(stage => stage.id === selectedStageId);
  const selectedPoint = points[selectedIndex];
  if (selectedPoint && branchGroups.length) {
    const visibleBranches = branchGroups.slice(0, 6);
    const hiddenCount = Math.max(0, branchGroups.length - visibleBranches.length);
    const chipWidth = 88, chipHeight = 30, gap = 10;
    const totalWidth = visibleBranches.length * chipWidth + (visibleBranches.length - 1) * gap;
    const startX = Math.max(20, Math.min(width - totalWidth - 20, selectedPoint.x - totalWidth / 2));
    const branchesAbove = selectedPoint.y > 145;
    const branchY = branchesAbove ? 38 : 292;
    const railY = branchY + chipHeight / 2;
    const elbowX = Math.max(84, Math.min(width - 84, selectedPoint.x + (selectedPoint.x > width / 2 ? -74 : 74)));
    const nodeExitY = selectedPoint.y + (branchesAbove ? -34 : 34);
    const hubY = branchesAbove ? Math.min(selectedPoint.y - 58, railY) : Math.max(selectedPoint.y + 100, railY - 38);
    const summary = svgEl("g", { class: "route-branch-summary", "aria-label": `${safeText(stages[selectedIndex].title)}包含${branchGroups.length}个${context.presentation.unit}分支` });
    summary.append(svgEl("path", { d: `M ${selectedPoint.x},${nodeExitY} C ${selectedPoint.x},${hubY} ${elbowX},${hubY} ${elbowX},${railY}`, class: "branch-spine", fill: "none" }));
    visibleBranches.forEach((group, index) => {
      const x = startX + index * (chipWidth + gap);
      const y = branchY + (index % 2 ? 18 : 0);
      const centerX = x + chipWidth / 2;
      summary.append(svgEl("path", { d: `M ${elbowX},${railY} C ${elbowX},${y + chipHeight / 2} ${centerX},${railY} ${centerX},${y + chipHeight / 2}`, class: "branch-line", fill: "none" }));
      const chip = svgEl("g", {
        class: `branch-chip${group.unitId === selectedUnitId ? " selected" : ""}`,
        tabindex: "0",
        role: "button",
        "aria-pressed": group.unitId === selectedUnitId ? "true" : "false",
        "aria-label": `${group.unitName}，${group.tasks.length} 个${context.presentation.task}`,
        "data-unit-id": group.unitId
      });
      chip.append(svgEl("rect", { x, y, width: chipWidth, height: chipHeight, rx: 15 }));
      const label = svgEl("text", { x: x + 11, y: y + 19, class: "branch-label" });
      label.textContent = safeText(group.unitName).replace(/作战单元$/, "").slice(0, 5);
      const count = svgEl("text", { x: x + chipWidth - 10, y: y + 19, "text-anchor": "end", class: "branch-count" });
      count.textContent = `${group.tasks.length}`;
      chip.append(label, count);
      summary.append(chip);
    });
    if (hiddenCount) {
      const more = svgEl("text", { x: startX + totalWidth + 8, y: branchY + 21, class: "branch-more" });
      more.textContent = `+${hiddenCount}`;
      summary.append(more);
    }
    svg.append(summary);
  }
  return svg;
}

export function renderRoadmap(context) {
  const stages = Array.isArray(context.data.stages) ? context.data.stages : [];
  if (!stages.length) return emptyState(context.module.emptyState);
  const requestedStageId = context.query.get("stage");
  const selectedStage = stages.find(item => item.id === requestedStageId) ?? stages.find(item => item.id === context.data.currentStageId) ?? stages[0];
  const branchGroups = stageBranchGroups(context, selectedStage);
  const selectedUnitId = context.query.get("unit");
  const branchTasks = branchGroups.flatMap(group => group.tasks.map(task => ({ ...task, unitName: group.unitName })));
  const selectedTask = branchTasks.find(task => task.id === context.query.get("task"));
  const visual = roadmapSvg(context, stages, selectedStage.id, branchGroups, selectedUnitId);
  visual.addEventListener("click", event => {
    const stageId = event.target.closest?.("[data-stage-id]")?.dataset.stageId;
    const unitId = event.target.closest?.("[data-unit-id]")?.dataset.unitId;
    if (unitId) { setQuery(context.navigate, { stage: selectedStage.id, unit: unitId, task: "" }); return; }
    if (stageId) setQuery(context.navigate, { stage: stageId, unit: "", task: "" });
  });
  visual.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const stageId = event.target.closest?.("[data-stage-id]")?.dataset.stageId;
    const unitId = event.target.closest?.("[data-unit-id]")?.dataset.unitId;
    if (unitId) { event.preventDefault(); setQuery(context.navigate, { stage: selectedStage.id, unit: unitId, task: "" }); return; }
    if (stageId) { event.preventDefault(); setQuery(context.navigate, { stage: stageId, unit: "", task: "" }); }
  });
  const stageAssets = Array.isArray(selectedStage.previewAssets) ? selectedStage.previewAssets : [];
  const orderedBranchGroups = selectedUnitId ? [...branchGroups].sort((left, right) => (right.unitId === selectedUnitId) - (left.unitId === selectedUnitId)) : branchGroups;
  const branchMap = branchGroups.length ? el("section", { className: "stage-branch-map", ariaLabel: `${selectedStage.title}作战分支` }, [
    el("header", {}, [el("span", { className: "eyebrow", text: "BRANCHES" }), el("h3", { text: `${context.presentation.unit}分支任务` })]),
    el("div", { className: "stage-branch-lanes" }, orderedBranchGroups.map(group => el("article", { className: `stage-branch-lane${group.unitId === selectedUnitId ? " selected" : ""}` }, [
      el("h4", { text: group.unitName }),
      el("div", { className: "stage-task-chips" }, group.tasks.map(task => el("div", { className: `stage-task-item${task.id === selectedTask?.id ? " selected" : ""}` }, [
        el("button", {
          type: "button",
          className: "stage-task-chip",
          ariaPressed: task.id === selectedTask?.id ? "true" : "false",
          onClick: () => setQuery(context.navigate, { stage: selectedStage.id, task: task.id })
        }, [el("strong", { text: task.title }), el("small", { text: `${safeText(task.startDate, "待排期")} → ${safeText(task.endDate, "待确认")} · ${statusText(task.state)}` })]),
        task.id === selectedTask?.id ? taskInlineDetail(context, task, group.unitName) : null
      ])))
    ])))
  ]) : el("section", { className: "stage-branch-map empty-preview" }, [el("h3", { text: `暂无映射到该${context.presentation.stage}的分支任务` }), el("p", { text: "当前发布数据未提供可按时间窗口归入该节点的任务；后续材料可通过提案补充任务日期或更明确的阶段归属。" })]);
  const stageDetail = el("section", { className: "selection-detail stage-node-detail", tabIndex: -1 }, [
    el("div", { className: "stage-node-copy" }, [
      el("span", { className: `badge ${["complete", "current"].includes(stateClass(selectedStage.state, selectedStage.id === context.data.currentStageId)) ? "active" : "archived"}`, text: statusText(selectedStage.state) }),
      el("h2", { text: selectedStage.title }),
      definitionList([["日期", selectedStage.dateLabel], ["说明", selectedStage.description], ["预期产出", selectedStage.expectedOutput]])
    ]),
    el("article", { className: "stage-preview" }, [
      el("h3", { text: safeText(selectedStage.previewTitle, `${context.presentation.stage}预览`) }),
      el("p", { text: safeText(selectedStage.previewCaption, "暂无节点预览说明") }),
      stageAssets.length ? el("div", { className: "stage-preview-grid" }, stageAssets.map((asset, index) => el("button", { type: "button", className: "stage-preview-thumb", onClick: event => openLightbox(context, stageAssets, index, event.currentTarget) }, [
        el("img", { src: asset.startsWith("/") ? asset : `/${asset.replace(/^\.\//, "")}`, alt: `${selectedStage.title}预览 ${index + 1}` })
      ]))) : el("small", { text: "无本地预览" })
    ]),
    branchMap
  ]);
  return el("div", {}, [
    el("section", { className: "module-primary-card" }, [
      cardHeading(context.module.viewVariant === "campaign-network" ? "CAMPAIGN ROUTE" : "LINEAR ROADMAP", context.module.title, `点击${context.presentation.stage}可切换到对应节点详情；路线几何由当前发布数据计算。`),
      localScroller(`${context.module.title}路线图，可水平滚动`, visual)
    ]),
    stageDetail
  ]);
}

function taskDetails(context, node) {
  const snapshotTask = (context.snapshot?.tasks ?? []).find(task => task.id === node.id) ?? {};
  const predecessors = (context.data.edges ?? []).filter(edge => edge.to === node.id).map(edge => context.data.nodes.find(item => item.id === edge.from)?.title ?? edge.from);
  const dependents = (context.data.edges ?? []).filter(edge => edge.from === node.id).map(edge => context.data.nodes.find(item => item.id === edge.to)?.title ?? edge.to);
  return el("aside", { className: "selection-detail" }, [
    el("h3", { text: node.title }),
    definitionList([["负责人", node.owner], ["状态", node.state], ["上级任务", context.data.nodes.find(item => item.id === node.parentId)?.title], ["前置任务", predecessors.join("、") || "无"], ["后续任务", dependents.join("、") || "无"], ["开始", snapshotTask.startDate], ["结束", snapshotTask.endDate], ["预期产出", snapshotTask.expectedOutput], ["来源", snapshotTask.source]])
  ]);
}

function dependencyList(context, nodes, selectedId) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  return el("div", { className: "dependency-list" }, nodes.map(node => {
    const dependencies = (context.data.edges ?? []).filter(edge => edge.to === node.id).map(edge => nodeById.get(edge.from)?.title ?? edge.from);
    return el("button", { type: "button", className: `dependency-row${node.id === selectedId ? " selected" : ""}`, onClick: () => setQuery(context.navigate, { task: node.id }) }, [
      el("span", { className: "task-state", text: statusText(node.state) }),
      el("strong", { text: node.title }), el("span", { text: safeText(node.owner, "负责人待确认") }),
      el("small", { text: dependencies.length ? `依赖：${dependencies.join("、")}` : "无前置依赖" })
    ]);
  }));
}

function networkSvg(context, nodes) {
  const width = Math.max(820, Math.ceil(nodes.length / 4) * 190 + 100);
  const height = Math.max(420, Math.min(900, Math.ceil(nodes.length / 4) * 115 + 100));
  const positions = new Map(nodes.map((node, index) => [node.id, { x: 90 + (index % 4) * 190, y: 75 + Math.floor(index / 4) * 115 }]));
  const svg = svgEl("svg", { class: "network-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${nodes.length} 个${context.presentation.task}的依赖网络；完整列表位于图后` });
  for (const edge of context.data.edges ?? []) {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    if (from && to) svg.append(svgEl("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: "dependency-edge" }));
  }
  nodes.forEach(node => {
    const position = positions.get(node.id);
    const group = svgEl("g", { class: "task-node", tabindex: "0", role: "button", "data-task-id": node.id, "aria-label": `${node.title}，${safeText(node.owner, "负责人待确认")}，${statusText(node.state)}` });
    group.append(svgEl("rect", { x: position.x - 72, y: position.y - 28, width: 144, height: 56, rx: 12 }));
    const title = svgEl("text", { x: position.x, y: position.y - 2, "text-anchor": "middle" }); title.textContent = node.title.length > 10 ? `${node.title.slice(0, 10)}…` : node.title;
    const owner = svgEl("text", { x: position.x, y: position.y + 17, "text-anchor": "middle", class: "task-node-owner" }); owner.textContent = safeText(node.owner, "待确认");
    group.append(title, owner); svg.append(group);
  });
  const select = event => {
    const id = event.target.closest?.("[data-task-id]")?.dataset.taskId;
    if (id) setQuery(context.navigate, { task: id });
  };
  svg.addEventListener("click", select);
  svg.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(event); } });
  return svg;
}

export function renderTaskNetwork(context) {
  const allNodes = Array.isArray(context.data.nodes) ? context.data.nodes : [];
  if (!allNodes.length) return emptyState(context.module.emptyState);
  const requestedUnit = context.query.get("unit");
  const units = context.data.units ?? [];
  const activeUnit = units.some(unit => unit.id === requestedUnit) ? requestedUnit : "";
  const nodes = activeUnit ? allNodes.filter(node => node.unitId === activeUnit) : allNodes;
  const selectedId = context.query.get("task");
  const selected = allNodes.find(node => node.id === selectedId);
  const selector = el("select", { ariaLabel: `筛选${context.presentation.unit}` }, [el("option", { value: "", text: `全部${context.presentation.unit}` }), ...units.map(unit => el("option", { value: unit.id, text: unit.name }))]);
  selector.value = activeUnit;
  selector.addEventListener("change", () => setQuery(context.navigate, { unit: selector.value, task: "" }));
  const useList = context.module.viewVariant === "dependency-list" || matchMedia("(max-width: 767px)").matches;
  const displayNodes = nodes.length > 40 && !activeUnit ? [] : nodes;
  return el("section", { className: "module-primary-card" }, [
    cardHeading("TASK DEPENDENCIES", context.module.title, `${allNodes.length} 个${context.presentation.task}；层级与依赖使用不同文本说明。`),
    el("div", { className: "visual-controls" }, [selector, el("span", { className: "legend hierarchy", text: "层级关系" }), el("span", { className: "legend dependency", text: "依赖关系" })]),
    nodes.length > 40 && !activeUnit ? emptyState("任务较多，请先选择一个分组", "超过 40 个可见节点时按组查看，避免生成不可读的缩略网络。") :
      useList ? dependencyList(context, displayNodes, selectedId) : localScroller("任务依赖网络，可水平滚动", networkSvg(context, displayNodes)),
    useList ? null : el("h3", { className: "alternative-heading", text: "依赖文本列表" }),
    useList ? null : dependencyList(context, displayNodes, selectedId),
    selected ? taskDetails(context, selected) : null
  ]);
}

function dayNumber(value) { return Math.floor(new Date(`${value}T00:00:00Z`).valueOf() / 86_400_000); }

export function renderGantt(context) {
  const tasks = Array.isArray(context.data.tasks) ? context.data.tasks : [];
  if (!tasks.length) return emptyState(context.module.emptyState);
  const requestedUnit = context.query.get("unit");
  const visibleTasks = requestedUnit ? tasks.filter(task => task.unitId === requestedUnit) : tasks;
  const scheduled = visibleTasks.filter(task => task.startDate && task.endDate);
  const unscheduled = visibleTasks.filter(task => !task.startDate || !task.endDate);
  const start = scheduled.length ? Math.min(...scheduled.map(task => dayNumber(task.startDate))) : null;
  const end = scheduled.length ? Math.max(...scheduled.map(task => dayNumber(task.endDate))) : null;
  const span = start == null ? 1 : Math.max(1, end - start + 1);
  const snapshotTasks = new Map((context.snapshot?.tasks ?? []).map(task => [task.id, task]));
  const timeline = el("div", { className: "gantt-timeline", style: `--gantt-days:${span}` }, [
    el("div", { className: "gantt-scale" }, [el("span", { text: scheduled.length ? formatDay(scheduled[0]?.startDate) : "" }), el("span", { text: scheduled.length ? formatDay([...scheduled].sort((a, b) => b.endDate.localeCompare(a.endDate))[0]?.endDate) : "" })]),
    ...scheduled.map(task => {
      const left = ((dayNumber(task.startDate) - start) / span) * 100;
      const width = Math.max(1.5, ((dayNumber(task.endDate) - dayNumber(task.startDate) + 1) / span) * 100);
      const source = snapshotTasks.get(task.id) ?? {};
      const label = `${task.title}，${safeText(source.owner, "负责人待确认")}，${formatDay(task.startDate)} 至 ${formatDay(task.endDate)}，${statusText(source.state)}`;
      return el("button", { type: "button", className: "gantt-bar", style: `--bar-left:${left}%;--bar-width:${width}%`, ariaLabel: label, title: label, onClick: () => setQuery(context.navigate, { task: task.id }) }, [el("span", { text: task.title })]);
    })
  ]);
  const tableRows = visibleTasks.map(task => {
    const source = snapshotTasks.get(task.id) ?? {};
    return el("tr", {}, [el("th", { scope: "row", text: task.title }), el("td", { text: safeText(source.owner, "负责人待确认") }), el("td", { text: task.startDate ? formatDay(task.startDate) : "待排期" }), el("td", { text: task.endDate ? formatDay(task.endDate) : "待排期" }), el("td", { text: task.progress == null ? "—" : `${task.progress}%` })]);
  });
  return el("section", { className: "module-primary-card" }, [
    cardHeading(context.module.viewVariant === "branching" ? "BRANCHING GANTT" : "TEAM LANES", context.module.title, "时间范围由任务真实日期计算，未排期任务单列。"),
    scheduled.length ? localScroller("甘特时间轴，可水平滚动", timeline) : null,
    unscheduled.length ? el("section", { className: "unscheduled-lane" }, [el("h3", { text: "待排期" }), el("p", { text: "以下任务尚无完整日期，不会被分配虚构位置。" }), el("ul", {}, unscheduled.map(task => el("li", { text: task.title })))]) : null,
    el("div", { className: "table-scroll", tabIndex: 0, role: "region", ariaLabel: "甘特任务文本表" }, [el("table", { className: "module-table" }, [
      el("thead", {}, [el("tr", {}, ["任务", "负责人", "开始", "结束", "进度"].map(label => el("th", { scope: "col", text: label })))]), el("tbody", {}, tableRows)
    ])])
  ]);
}

function openLightbox(context, assets, startIndex, returnFocus) {
  let index = startIndex;
  const backdrop = el("div", { className: "lightbox-backdrop" });
  const image = el("img", { alt: "" });
  const caption = el("p");
  const close = () => { backdrop.remove(); returnFocus?.focus(); };
  const update = () => {
    const source = assets[index];
    image.src = source.startsWith("/") ? source : `/${source.replace(/^\.\//, "")}`;
    image.alt = `成果预览 ${index + 1}`;
    caption.textContent = `${index + 1} / ${assets.length} · ${source.split("/").at(-1)}`;
  };
  const panel = el("section", { className: "lightbox", role: "dialog", ariaModal: "true", ariaLabel: "成果预览" }, [
    el("button", { type: "button", className: "lightbox-close", ariaLabel: "关闭预览", text: "×", onClick: close }), image, caption,
    el("div", { className: "lightbox-actions" }, [
      el("button", { type: "button", className: "secondary-button", text: "上一张", disabled: assets.length < 2, onClick: () => { index = (index - 1 + assets.length) % assets.length; update(); } }),
      el("button", { type: "button", className: "secondary-button", text: "下一张", disabled: assets.length < 2, onClick: () => { index = (index + 1) % assets.length; update(); } })
    ])
  ]);
  backdrop.append(panel);
  backdrop.addEventListener("keydown", event => {
    if (event.key === "Escape") { close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll("button:not(:disabled)")];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  image.addEventListener("error", () => { image.hidden = true; caption.textContent = "预览资源不可用"; });
  document.body.append(backdrop); update(); panel.querySelector("button").focus();
}

export function renderOutcomes(context) {
  const outcomes = Array.isArray(context.data.outcomes) ? context.data.outcomes : [];
  if (!outcomes.length) return emptyState(context.module.emptyState);
  return el("section", { className: "module-primary-card" }, [
    cardHeading(context.module.viewVariant === "closure-detail" ? "CLOSURE ARCHIVE" : "DELIVERABLE ARCHIVE", context.module.title, `${outcomes.length} 条已登记记录；状态仅呈现存储事实。`),
    el("div", { className: "outcome-grid" }, outcomes.map(outcome => el("article", { className: "outcome-card" }, [
      el("span", { className: `badge ${stateClass(outcome.state) === "complete" ? "active" : "archived"}`, text: statusText(outcome.state) }),
      el("h3", { text: outcome.title }),
      el("p", { text: safeText(outcome.description, "暂无说明") }),
      definitionList([["日期", outcome.dateLabel], ["结果", outcome.result], ["来源", outcome.source]]),
      outcome.previewAssets?.length ? el("button", { type: "button", className: "secondary-button", text: `查看 ${outcome.previewAssets.length} 项预览`, onClick: event => openLightbox(context, outcome.previewAssets, 0, event.currentTarget) }) : el("small", { text: "无本地预览" })
    ])))
  ]);
}

const severityOrder = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3 });
const severityLabels = Object.freeze({ critical: "严重", high: "高", medium: "中", low: "低" });

export function renderRisks(context) {
  let risks = Array.isArray(context.data.risks) ? [...context.data.risks] : [];
  if (!risks.length) return emptyState("暂无已登记风险", "这表示尚未录入风险，不代表项目已确认无风险。");
  const severity = context.query.get("severity");
  if (severity && severityOrder[severity] !== undefined) risks = risks.filter(risk => risk.severity === severity);
  risks.sort((left, right) => (severityOrder[left.severity] ?? 9) - (severityOrder[right.severity] ?? 9) || safeText(left.dueDate, "9999").localeCompare(safeText(right.dueDate, "9999")));
  return el("section", { className: "module-primary-card" }, [
    cardHeading("RISK REGISTER", context.module.title, "默认按严重程度与到期日排序；颜色之外始终显示文本标签。"),
    el("div", { className: "risk-summary" }, Object.keys(severityOrder).map(value => el("button", { type: "button", className: `risk-chip severity-${value}`, ariaPressed: severity === value ? "true" : "false", text: `${severityLabels[value]} ${context.data.risks.filter(risk => risk.severity === value).length}`, onClick: () => setQuery(context.navigate, { severity: severity === value ? "" : value }) }))),
    risks.length ? el("div", { className: "table-scroll", tabIndex: 0, role: "region", ariaLabel: "风险台账" }, [el("table", { className: "module-table risk-table" }, [
      el("thead", {}, [el("tr", {}, ["风险", "严重程度", "状态", "负责人", "缓解措施", "到期日", "来源"].map(label => el("th", { scope: "col", text: label })))]),
      el("tbody", {}, risks.map(risk => el("tr", {}, [el("th", { scope: "row", text: risk.title }), el("td", { text: severityLabels[risk.severity] ?? risk.severity }), el("td", { text: statusText(risk.status) }), el("td", { text: safeText(risk.owner, "待确认") }), el("td", { text: safeText(risk.mitigation) }), el("td", { text: risk.dueDate ? formatDay(risk.dueDate) : "待确认" }), el("td", { text: safeText(risk.source) })])))
    ])]) : emptyState("当前筛选下没有风险", "可清除严重程度筛选查看全部已登记风险。")
  ]);
}

export function renderMetrics(context) {
  const metrics = Array.isArray(context.data.metrics) ? context.data.metrics : [];
  if (!metrics.length) return emptyState("暂无已登记指标", "获授权编辑者可在后续受控流程中补充经过验证的指标值。");
  return el("section", { className: "module-primary-card" }, [
    cardHeading("VERIFIED METRICS", context.module.title, "缺失值显示“待补充”；目标不会替代事实值。"),
    el("div", { className: "metric-grid" }, metrics.map(metric => el("article", { className: "metric-card" }, [
      el("span", { className: "metric-status", text: statusText(metric.status) }), el("h3", { text: metric.name }),
      el("p", { className: `metric-value${metric.value == null ? " missing" : ""}`, text: metric.value == null ? "待补充" : `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}` }),
      definitionList([["目标", metric.target == null ? "待补充" : typeof metric.target === "object" ? JSON.stringify(metric.target) : String(metric.target)], ["截至", metric.asOf ? formatDay(metric.asOf) : "待确认"], ["来源", metric.source]])
    ])))
  ]);
}

const phaseThreeMaterialsBoundaryCopy = Object.freeze(["项目材料功能将在下一阶段开放", "当前页面不会读取或上传材料。"]); // Historical acceptance marker.
const materialStatus = Object.freeze({
  gate_checking: "门阀校验中", staging: "等待上传", uploading: "上传中", queued: "预处理中",
  processing: "预处理中", ready: "证据已就绪", dependency_missing: "需人工确认", failed: "处理失败"
});

function materialPath(context, suffix = "") {
  return `/api/projects/${encodeURIComponent(context.project.id)}/materials${suffix}`;
}

function chatPath(context, suffix = "") {
  return `/api/projects/${encodeURIComponent(context.project.id)}/chat${suffix}`;
}

function generationPath(context, suffix = "") {
  return `/api/projects/${encodeURIComponent(context.project.id)}/generation-tasks${suffix}`;
}

function proposalPath(context, suffix = "") {
  return `/api/projects/${encodeURIComponent(context.project.id)}/change-proposals${suffix}`;
}

function releasePath(context, suffix = "") {
  return `/api/projects/${encodeURIComponent(context.project.id)}/release${suffix}`;
}

function materialsUiPath(context, suffix = "") {
  return `/projects/${encodeURIComponent(context.project.id)}/modules/materials${suffix}`;
}

function uiDate(value) {
  if (!value) return "待补充";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function bytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "待补充";
  if (number < 1024) return `${number} B`;
  if (number < 1024 ** 2) return `${(number / 1024).toFixed(1)} KiB`;
  return `${(number / 1024 ** 2).toFixed(1)} MiB`;
}

function locatorLabel(evidence = {}) {
  const location = evidence.location ?? {};
  if (Number.isInteger(location.slide)) return `第 ${location.slide} 张幻灯片${Number.isInteger(location.paragraph) ? ` · 第 ${location.paragraph} 段` : ""}`;
  if (Number.isInteger(location.page)) return `第 ${location.page} 页`;
  if (Number.isInteger(location.paragraph)) return `第 ${location.paragraph} 段${location.heading ? ` · ${location.heading}` : ""}`;
  if (Number.isInteger(location.line)) return `第 ${location.line} 行`;
  if (location.type === "manual" && location.field) return `人工材料 · ${location.field === "title" ? "标题" : location.field === "body" ? "正文" : safeText(location.field)}`;
  if (location.type === "json" && location.pointer) return `JSON · ${safeText(location.pointer)}`;
  if (location.sheet || location.range) return `${safeText(location.sheet, "工作表")} · ${safeText(location.table, "表 1")} · ${safeText(location.range, "范围待确认")}`;
  if (Number.isInteger(location.image)) return `图 ${location.image}${location.region ? ` · ${location.region}` : ""}`;
  if (Number.isInteger(evidence.ordinal)) return `第 ${evidence.ordinal + 1} 段`;
  return "未提供精确区域";
}

function localTabs(context, view) {
  const qaLabel = context.presentation.kind === "campaign" ? "战情问答" : "项目问答";
  const proposalLabel = context.presentation.kind === "campaign" ? "作战更新提案" : "项目更新提案";
  const base = `/projects/${encodeURIComponent(context.project.id)}/modules/materials`;
  const entries = [["ledger", "材料台账"], ["qa", qaLabel], ["proposals", proposalLabel]];
  if (["platform_admin", "project_admin", "project_editor"].includes(context.project.role)) entries.push(["release", context.presentation.kind === "campaign" ? "审核与发布" : "审核发布中心"]);
  if (["platform_admin", "project_admin"].includes(context.project.role)) entries.push(["operations", "运维自检"]);
  const tabs = entries.map(([value, label]) => el("a", {
    href: `${base}?view=${value}`, ariaCurrent: view === value ? "page" : null, text: label,
    onClick: event => { event.preventDefault(); context.navigate(`${base}?view=${value}`); }
  }));
  const tablist = el("nav", { className: "materials-tabs", ariaLabel: "材料工作区" }, tabs);
  tablist.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].focus();
  });
  return tablist;
}

function materialErrorMessage(error) {
  const copy = {
    unsupported_type: "不支持此文件类型。请上传 PDF、DOCX、PPTX、XLSX、文本、图片，或使用人工表单。",
    mime_mismatch: "文件内容与扩展名不一致，已停止上传。请确认文件来源后重试。",
    magic_mismatch: "文件内容与扩展名不一致，已停止上传。请确认文件来源后重试。",
    PROJECT_MATERIAL_LIMIT: "项目材料配额已用完，当前无法继续上传。",
    project_capacity: "项目材料配额已用完，当前无法继续上传。",
    DUPLICATE_MATERIAL: "相同内容已归档",
    upload_rate_limited: "上传过于频繁，请稍后重试。",
    upload_concurrent: "已有材料正在上传或预处理，请等待后再试。",
    zip_bomb: "文件展开后超过安全限制，已停止处理。请压缩内容或拆分文件后重试。"
  };
  return copy[error?.code] ?? error?.message ?? "请求失败，请稍后重试";
}

const readinessLabels = Object.freeze({ ready: "关键内容充分", warning: "可生成但需复核", blocked: "关键内容缺失" });
function readinessText(material = {}) {
  const readiness = material.readiness;
  if (!material.updateTemplate) return "未选择模板";
  if (!readiness) return "待诊断";
  return readinessLabels[readiness.status] ?? readiness.status;
}
function readinessNode(material = {}) {
  const readiness = material.readiness;
  if (!readiness) return el("span", { className: "readiness-pill", text: readinessText(material) });
  return el("span", { className: `readiness-pill readiness-${readiness.status}`, title: readiness.suggestion, text: readinessText(material) });
}

function modalSheet({ title, eyebrow, project, returnFocus, className = "material-sheet", closeLabel = "关闭上传面板", titleId = "material-sheet-title", render }) {
  const backdrop = el("div", { className: "sheet-backdrop material-sheet-backdrop" });
  const panel = el("section", { className, role: "dialog", ariaModal: "true", ariaLabelledby: titleId });
  let committing = false;
  const close = () => { if (committing) return; backdrop.remove(); returnFocus?.focus?.(); };
  const closeButton = el("button", { type: "button", className: "dialog-close", ariaLabel: closeLabel, text: "×", onClick: close });
  const body = el("div", { className: "material-sheet-body" });
  panel.append(el("header", { className: "sheet-header" }, [
    el("div", {}, [el("span", { className: "eyebrow", text: eyebrow }), el("h2", { id: titleId, text: title }), el("p", { text: `${project.name} · ${project.id}` })]), closeButton
  ]), body);
  backdrop.append(panel); document.body.append(backdrop);
  const controls = { close, body, setCommitting(value) { committing = value; closeButton.disabled = value; } };
  render(controls);
  backdrop.addEventListener("keydown", event => {
    if (event.key === "Escape" && !committing) { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]")];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  panel.querySelector("input, select, textarea, button")?.focus();
}

function templateSelect(templates, id = "material-update-template") {
  return el("select", { id, name: "updateTemplateId", required: true }, [
    el("option", { value: "", text: "请选择更新模板" }),
    ...(templates ?? []).map(item => el("option", { value: item.id, text: `${item.label} · ${item.version}` }))
  ]);
}

function capability(envelope, ...names) {
  const caps = envelope?.capabilities ?? envelope ?? {};
  return names.some(name => caps[name] === true);
}

function updateTemplateKey(material = {}) {
  const item = material.updateTemplate ?? material.updateTemplateSelection ?? {};
  return item.id ? `${item.id}@${item.version ?? "1.0.0"}` : "";
}

function updateTemplateLabel(material = {}) {
  const item = material.updateTemplate ?? material.updateTemplateSelection ?? {};
  return item.label ? `${item.label} · ${item.version ?? "1.0.0"}` : "更新模板不可用";
}

function generationErrorMessage(error, resetTime = "配额重置") {
  const copy = {
    AI_PROVIDER_DISABLED: "更新生成当前未启用；材料、证据和已有提案仍可查看。",
    GENERATION_PROVIDER_DISABLED: "更新生成当前未启用；材料、证据和已有提案仍可查看。",
    base_version_conflict: "发布版本已变化，请核对新版本后重新创建任务。",
    BASE_VERSION_CONFLICT: "发布版本已变化，请核对新版本后重新创建任务。",
    GENERATION_QUOTA_EXHAUSTED: `本项目更新生成配额已用完，可在 ${resetTime} 后重试。`,
    GENERATION_RATE_LIMITED: "生成请求过于频繁，请稍后重试。",
    GENERATION_CONCURRENCY: "已有生成任务正在占用可用并发，请稍后重试。",
    INVALID_GENERATION_MATERIALS: "所选材料状态已变化，请重新选择。"
  };
  return copy[error?.code] ?? error?.message ?? "无法创建生成任务，请稍后重试。";
}

function openGenerationSheet(context, originatingMaterial, returnFocus) {
  const campaign = context.presentation.kind === "campaign";
  modalSheet({
    title: campaign ? "生成作战更新提案" : "生成项目更新提案",
    eyebrow: campaign ? "STRUCTURED CAMPAIGN UPDATE" : "STRUCTURED PROJECT UPDATE",
    project: context.project,
    returnFocus,
    className: "material-sheet generation-sheet",
    closeLabel: "关闭生成面板",
    titleId: "generation-sheet-title",
    render: controls => {
      const loading = el("section", { className: "generation-sheet-loading", ariaBusy: "true" }, [el("p", { text: "正在读取可用于生成的材料…" })]);
      controls.body.replaceChildren(loading);
      void (async () => {
        try {
          const [capabilityEnvelope, ledger] = await Promise.all([
            context.api(generationPath(context, "/capabilities")),
            context.api(materialPath(context))
          ]);
          const caps = capabilityEnvelope.capabilities ?? {};
          const limits = capabilityEnvelope.limits ?? {};
          const usage = capabilityEnvelope.usage ?? {};
          const providerEnabled = capabilityEnvelope.provider?.enabled ?? capabilityEnvelope.providerEnabled ?? true;
          const canCreate = capability(capabilityEnvelope, "create", "createTask", "createGenerationTask");
          const sourceItems = capabilityEnvelope.eligibleMaterials ?? ledger.items ?? [];
          const eligible = sourceItems.filter(item => item.status === "ready" && updateTemplateKey(item) && item.generation?.enabled !== false && item.generationEnabled !== false && item.readiness?.status !== "blocked");
          const selected = new Set();
          if (originatingMaterial?.id && eligible.some(item => item.id === originatingMaterial.id)) selected.add(originatingMaterial.id);
          const maxMaterials = Math.min(8, Number(limits.maxMaterialsPerTask ?? limits.maxMaterials ?? 8));
          const maxEvidence = Number(limits.maxEvidenceBlocks ?? 48);
          const error = el("p", { className: "form-error", role: "alert" });
          const selection = el("fieldset", { className: "generation-materials" });
          const selectionCount = el("strong", { className: "generation-selection-count" });
          const summary = el("dl", { className: "generation-lock-summary" });
          const create = el("button", { type: "submit", className: "primary-button", text: campaign ? "生成作战更新提案" : "生成项目更新提案" });
          const cancel = el("button", { type: "button", className: "secondary-button", text: "关闭生成面板", onClick: controls.close });
          const selectedItems = () => eligible.filter(item => selected.has(item.id));
          const renderSelection = focusId => {
            const activeTemplate = updateTemplateKey(selectedItems()[0]);
            const rows = eligible.map(item => {
              const inputId = `generation-material-${item.id}`;
              const differentTemplate = Boolean(activeTemplate && !selected.has(item.id) && updateTemplateKey(item) !== activeTemplate);
              const checkbox = el("input", {
                id: inputId, type: "checkbox", checked: selected.has(item.id),
                disabled: differentTemplate || (!selected.has(item.id) && selected.size >= maxMaterials),
                onChange: () => {
                  if (checkbox.checked) selected.add(item.id); else selected.delete(item.id);
                  renderSelection(item.id);
                }
              });
              return el("div", { className: `generation-material-row${differentTemplate ? " ineligible" : ""}`, dataset: { materialId: item.id } }, [
                checkbox,
                el("label", { htmlFor: inputId }, [el("strong", { text: safeText(item.name, item.displayName) }), el("small", { text: `${updateTemplateLabel(item)} · ${Number(item.evidenceCount ?? item.currentEvidenceCount ?? 0)} 个证据块 · ${readinessText(item)}` })]),
                differentTemplate ? el("span", { text: "与已选材料模板不同" }) : null
              ]);
            });
            selection.replaceChildren(el("legend", { text: "选择当前项目材料" }), ...rows);
            const chosen = selectedItems();
            const evidenceCount = chosen.reduce((sum, item) => sum + Number(item.evidenceCount ?? item.currentEvidenceCount ?? 0), 0);
            const template = chosen[0];
            selectionCount.textContent = `已选择 ${chosen.length}/${maxMaterials} 份材料`;
            summary.replaceChildren(...[
              ["发布基准", capabilityEnvelope.baseVersion ?? capabilityEnvelope.publishedVersion ?? context.version],
              ["更新模板", template ? updateTemplateLabel(template) : "选择首份材料后锁定"],
              ["提案 Schema", capabilityEnvelope.schemaVersion ?? "change-proposal-v1@1.0.0"],
              ["证据块", `${Math.min(evidenceCount, maxEvidence)}/${maxEvidence}`],
              ["今日剩余", `${usage.remainingToday ?? usage.generationRemainingToday ?? "—"} 次`],
              ["重置时间", uiDate(usage.resetTime ?? capabilityEnvelope.resetTime)]
            ].flatMap(([term, value]) => [el("dt", { text: term }), el("dd", { text: String(value) })]));
            create.disabled = !canCreate || !providerEnabled || chosen.length < 1 || evidenceCount < 1 || evidenceCount > maxEvidence;
            if (focusId) selection.querySelector(`[data-material-id="${CSS.escape(focusId)}"] input`)?.focus();
          };
          const form = el("form", { className: "material-form generation-form", onSubmit: async event => {
            event.preventDefault();
            const materialIds = [...selected];
            if (!materialIds.length) { error.textContent = "请至少选择一份可用于生成的材料。"; return; }
            error.textContent = ""; controls.setCommitting(true); create.disabled = cancel.disabled = true; create.textContent = "正在创建生成任务…";
            try {
              const response = await context.api(generationPath(context), {
                method: "POST", mutation: true,
                body: { materialIds, idempotencyKey: crypto.randomUUID() }
              });
              const task = response.task ?? response;
              if (!task.id) throw new Error("服务器未返回生成任务标识");
              controls.setCommitting(false); controls.close();
              context.showToast("生成任务已创建");
              context.navigate(materialsUiPath(context, `/generation-tasks/${encodeURIComponent(task.id)}`));
            } catch (requestError) {
              error.textContent = generationErrorMessage(requestError, uiDate(usage.resetTime ?? capabilityEnvelope.resetTime));
              controls.setCommitting(false); cancel.disabled = false; create.textContent = campaign ? "生成作战更新提案" : "生成项目更新提案"; renderSelection();
            }
          } }, [
            el("p", { className: "material-boundary", text: "AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本。" }),
            el("p", { className: "generation-limit-copy", text: `每个任务最多 ${maxMaterials} 份同项目、同模板材料；服务端最多锁定 ${maxEvidence} 个当前证据块。` }),
            ...(providerEnabled ? [] : [el("p", { className: "generation-provider-disabled", role: "status", text: "更新生成当前未启用；材料、证据和已有提案仍可查看。" })]),
            selectionCount, selection, summary, error,
            el("footer", { className: "sheet-actions" }, [cancel, create])
          ]);
          controls.body.replaceChildren(eligible.length ? form : el("section", { className: "module-empty material-empty" }, [
            el("h3", { text: "暂无可用于生成的材料" }),
            el("p", { text: "材料必须证据已就绪、已选择版本化更新模板、关键内容不缺失，并获授权用于生成。" }),
            el("button", { type: "button", className: "secondary-button", text: "关闭生成面板", onClick: controls.close })
          ]));
          if (eligible.length) renderSelection();
        } catch (error) {
          if (error.message === "AUTHENTICATION_REQUIRED") { controls.close(); return; }
          controls.body.replaceChildren(el("section", { className: "error-panel", role: "alert" }, [
            el("h3", { text: "无法加载生成条件" }), el("p", { text: generationErrorMessage(error) }),
            el("button", { type: "button", className: "secondary-button", text: "关闭生成面板", onClick: controls.close })
          ]));
        }
      })();
    }
  });
}

function openManualSheet(context, catalog, refresh, returnFocus) {
  modalSheet({ title: "填写人工材料", eyebrow: context.presentation.kind === "campaign" ? "BATTLE MATERIAL INTAKE" : "PROJECT MATERIAL INTAKE", project: context.project, returnFocus, render: controls => {
    const template = templateSelect(catalog, "manual-update-template");
    const body = el("textarea", { id: "manual-body", name: "body", required: true, rows: 10, maxLength: 20000 });
    const note = el("textarea", { id: "manual-note", name: "note", rows: 3, maxLength: 500 });
    const remaining = el("small", { className: "character-count", text: "还可输入 500 字" });
    note.addEventListener("input", () => { remaining.textContent = `还可输入 ${500 - note.value.length} 字`; });
    const error = el("p", { className: "form-error", role: "alert" });
    const submit = el("button", { type: "submit", className: "primary-button", text: "归档人工材料" });
    const form = el("form", { className: "material-form", onSubmit: async event => {
      event.preventDefault(); error.textContent = ""; controls.setCommitting(true); submit.disabled = true; submit.textContent = "正在归档…";
      const values = Object.fromEntries(new FormData(form));
      try {
        await context.api(materialPath(context, "/manual"), { method: "POST", mutation: true, body: { title: values.title, body: values.body, category: values.category, sourceDate: values.sourceDate, contributor: values.contributor, note: values.note, updateTemplateId: values.updateTemplateId, updateTemplateVersion: "1.0.0" } });
        context.showToast("人工材料已归档，证据已就绪"); controls.setCommitting(false); controls.close(); await refresh();
      } catch (requestError) { error.textContent = materialErrorMessage(requestError); controls.setCommitting(false); submit.disabled = false; submit.textContent = "归档人工材料"; }
    } }, [
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-title", text: "标题" }), el("input", { id: "manual-title", name: "title", required: true, maxLength: 240 })]),
      el("div", { className: "form-grid" }, [
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-category", text: "材料分类" }), el("select", { id: "manual-category", name: "category" }, ["会议纪要", "计划", "汇报", "表格/数据", "成果文件", "图片", "其他"].map(label => el("option", { text: label, value: label })))]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-date", text: "来源 / 发生日期" }), el("input", { id: "manual-date", name: "sourceDate", type: "date" })]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-contributor", text: "贡献人" }), el("input", { id: "manual-contributor", name: "contributor", maxLength: 120 })]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-update-template", text: "更新模板" }), template])
      ]),
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-body", text: "正文（纯文本）" }), body]),
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-note", text: "备注（可选）" }), note, remaining]),
      el("p", { className: "material-boundary", text: "材料归档后可按版本化模板生成带来源的结构化提案；不会直接修改项目草稿或发布版本。" }), error,
      el("footer", { className: "sheet-actions" }, [el("button", { type: "button", className: "secondary-button", text: "关闭", onClick: controls.close }), submit])
    ]);
    controls.body.append(form);
  }});
}

function openUploadSheet(context, ledger, refresh, returnFocus) {
  modalSheet({ title: context.presentation.kind === "campaign" ? "上传作战材料" : "上传项目材料", eyebrow: context.presentation.kind === "campaign" ? "BATTLE MATERIAL INTAKE" : "PROJECT MATERIAL INTAKE", project: context.project, returnFocus, render: controls => {
    const input = el("input", { id: "material-files", name: "files", multiple: true, accept: ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.yaml,.png,.jpg,.jpeg,.webp" });
    input.type = "file";
    const picker = el("button", { type: "button", className: "secondary-button", text: "选择文件", onClick: () => input.click() });
    const drop = el("div", { className: "upload-drop", tabIndex: 0, role: "button", ariaLabel: "选择或拖入材料文件" }, [picker, el("p", { text: "选择或拖入文件到当前项目" }), input]);
    const template = templateSelect(ledger.updateTemplates, "upload-update-template");
    const note = el("textarea", { id: "upload-note", name: "note", rows: 3, maxLength: 500 });
    const remaining = el("small", { className: "character-count", text: "还可输入 500 字" });
    const queue = el("div", { className: "upload-queue", ariaLive: "polite" });
    const error = el("p", { className: "form-error", role: "alert" });
    const submit = el("button", { type: "submit", className: "primary-button", text: "开始上传" });
    const drawQueue = () => queue.replaceChildren(...[...input.files].map(file => el("article", { className: "upload-queue-row" }, [el("strong", { text: file.name }), el("span", { text: bytes(file.size) }), el("span", { className: "status-label", text: "等待上传" })])));
    input.addEventListener("change", drawQueue); note.addEventListener("input", () => { remaining.textContent = `还可输入 ${500 - note.value.length} 字`; });
    for (const eventName of ["dragenter", "dragover"]) drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.add("active"); drop.querySelector("p").textContent = "松开以上传到当前项目"; });
    for (const eventName of ["dragleave", "drop"]) drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.remove("active"); drop.querySelector("p").textContent = "选择或拖入文件到当前项目"; });
    drop.addEventListener("drop", event => { if (event.dataTransfer?.files?.length) { input.files = event.dataTransfer.files; drawQueue(); } });
    drop.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); input.click(); } });
    const form = el("form", { className: "material-form", onSubmit: async event => {
      event.preventDefault(); error.textContent = "";
      const files = [...input.files]; if (!files.length) { error.textContent = "请先选择文件"; return; }
      if (!template.value) { error.textContent = "请选择更新模板"; template.focus(); return; }
      controls.setCommitting(true); submit.disabled = true; submit.textContent = "正在上传…";
      const rows = [...queue.children];
      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index], row = rows[index]; row.querySelector(".status-label").textContent = "上传中";
          row.append(el("progress", { max: 1, value: 0, ariaLabel: `${file.name} 上传进度` }));
          const receipt = await context.api(materialPath(context, "/upload"), { method: "POST", mutation: true, rawBody: file, headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) } });
          row.querySelector("progress").value = 1; row.querySelector(".status-label").textContent = "材料已归档，正在生成可定位证据";
          if (receipt?.material?.id) {
            await context.api(materialPath(context, `/${encodeURIComponent(receipt.material.id)}/update-template`), { method: "PATCH", mutation: true, body: { id: template.value, version: "1.0.0" } });
            row.append(el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials/${encodeURIComponent(receipt.material.id)}`, text: "查看已归档材料" }));
          }
        }
        context.showToast("材料已归档，正在生成可定位证据"); controls.setCommitting(false); await refresh();
      } catch (requestError) { error.textContent = materialErrorMessage(requestError); controls.setCommitting(false); submit.disabled = false; submit.textContent = "开始上传"; }
    } }, [
      el("div", { className: "quota-compact", text: `单文件 ${bytes(ledger.limits.maxFileBytes)} · 项目 ${ledger.usage.materials}/${ledger.limits.maxMaterials} 项 · 并发 ${ledger.limits.maxConcurrentUploads}` }), drop,
      el("div", { className: "form-grid" }, [el("div", { className: "field" }, [el("label", { htmlFor: "upload-category", text: "材料分类" }), el("select", { id: "upload-category", name: "category" }, ["会议纪要", "计划", "汇报", "表格/数据", "成果文件", "图片", "其他"].map(label => el("option", { text: label, value: label })))]), el("div", { className: "field" }, [el("label", { htmlFor: "upload-update-template", text: "更新模板" }), template])]),
      el("div", { className: "field" }, [el("label", { htmlFor: "upload-note", text: "材料备注（可选）" }), note, remaining]),
      el("p", { className: "material-boundary", text: "材料归档后可按版本化模板生成带来源的结构化提案；不会直接修改项目草稿或发布版本。" }), queue, error,
      el("footer", { className: "sheet-actions" }, [el("button", { type: "button", className: "secondary-button", text: "关闭上传面板", onClick: controls.close }), submit])
    ]);
    controls.body.append(form);
  }});
}

function summaryCard(label, value, help) {
  return el("article", { className: "material-summary-card" }, [el("span", { text: label }), el("strong", { text: String(value) }), el("small", { text: help })]);
}

function renderLedger(context, root) {
  const load = async () => {
    root.setAttribute("aria-busy", "true");
    try {
      const ledger = await context.api(materialPath(context));
      const caps = ledger.capabilities ?? {};
      const limits = ledger.limits ?? {}, usage = ledger.usage ?? {}, summary = ledger.summary ?? {};
      const upload = caps.upload ? el("button", { type: "button", className: "primary-button", text: context.presentation.kind === "campaign" ? "上传作战材料" : "上传项目材料", onClick: event => openUploadSheet(context, ledger, load, event.currentTarget) }) : null;
      const manual = caps.manual ? el("button", { type: "button", className: "secondary-button", text: "填写人工材料", onClick: event => openManualSheet(context, ledger.updateTemplates, load, event.currentTarget) }) : null;
      const search = el("input", { type: "search", value: context.query.get("q") ?? "", placeholder: "搜索材料名称或来源", ariaLabel: "搜索材料" });
      const status = el("select", { ariaLabel: "筛选处理状态" }, [el("option", { value: "", text: "全部状态" }), ...Object.entries(materialStatus).map(([value, label]) => el("option", { value, text: label }))]); status.value = context.query.get("status") ?? "";
      const sort = el("select", { ariaLabel: "材料排序" }, [["newest", "最新"], ["oldest", "最早"], ["name", "名称"]].map(([value, label]) => el("option", { value, text: label }))); sort.value = context.query.get("sort") ?? "newest";
      const list = el("div", { className: "material-ledger-list" });
      const updateList = () => {
        let items = [...(ledger.items ?? [])]; const query = search.value.trim().toLocaleLowerCase();
        if (query) items = items.filter(item => `${item.name} ${item.updateTemplate?.label ?? ""}`.toLocaleLowerCase().includes(query));
        if (status.value) items = items.filter(item => item.status === status.value);
        items.sort((a, b) => sort.value === "oldest" ? String(a.createdAt).localeCompare(String(b.createdAt)) : sort.value === "name" ? String(a.name).localeCompare(String(b.name), "zh-CN") : String(b.createdAt).localeCompare(String(a.createdAt)));
        const params = new URLSearchParams(location.search); params.set("view", "ledger");
        for (const [key, value] of [["q", search.value.trim()], ["status", status.value], ["sort", sort.value === "newest" ? "" : sort.value]]) value ? params.set(key, value) : params.delete(key);
        history.replaceState({}, "", `${location.pathname}?${params}`);
        const emptyUpload = caps.upload && !ledger.items?.length ? el("button", { type: "button", className: "primary-button", text: context.presentation.kind === "campaign" ? "上传作战材料" : "上传项目材料", onClick: event => openUploadSheet(context, ledger, load, event.currentTarget) }) : null;
        list.replaceChildren(items.length ? materialTable(context, items, caps, load) : el("section", { className: "module-empty material-empty" }, [el("h2", { text: ledger.items?.length ? "当前筛选下没有材料" : "尚未归档项目材料" }), el("p", { text: context.presentation.kind === "campaign" ? "上传会议纪要、作战计划、汇报、表格、成果或图片，建立可追溯的项目证据。" : "上传会议纪要、项目计划、汇报、表格、交付物或图片，建立可追溯的项目证据。" }), emptyUpload]));
      };
      let timer; search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(updateList, 200); }); status.addEventListener("change", updateList); sort.addEventListener("change", updateList);
      root.replaceChildren(localTabs(context, "ledger"), el("section", { className: "materials-workspace-card" }, [
        el("div", { className: "material-summary-grid" }, [summaryCard("材料总数", summary.count ?? 0, `上限 ${limits.maxMaterials ?? "—"}`), summaryCard("证据已就绪", summary.readyCount ?? 0, "可定位证据"), summaryCard("已授权问答", summary.qaEnabledCount ?? 0, "只读检索范围"), summaryCard("存储用量", bytes(usage.materialBytes ?? 0), `上限 ${bytes(limits.maxProjectBytes)}`)]),
        el("section", { className: "quota-panel", ariaLabel: "材料与问答配额" }, [el("div", { className: "quota-title" }, [el("h2", { text: "项目配额" }), el("span", { text: `剩余问答 ${usage.chatRemainingToday ?? "—"} 次` })]), el("progress", { max: Math.max(1, Number(limits.maxProjectBytes) || 1), value: Math.min(Number(usage.materialBytes) || 0, Number(limits.maxProjectBytes) || 1), ariaLabel: "项目存储用量" }), el("p", { text: `单文件 ${bytes(limits.maxFileBytes)} · 每分钟 ${limits.maxUploadsPerMinute ?? "—"} 次上传 · ${limits.maxConcurrentUploads ?? "—"} 个并发 · Office 展开 ${bytes(limits.maxZipExpandedBytes)} / ${limits.maxZipEntries ?? "—"} 条` })]),
        el("div", { className: "material-toolbar" }, [el("div", { className: "material-actions" }, [upload, manual]), search, status, sort]), list
      ]));
      updateList();
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(localTabs(context, "ledger"), el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: "无法加载材料台账" }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "primary-button", text: "重新加载材料", onClick: load })]));
    } finally { root.setAttribute("aria-busy", "false"); }
  };
  void load();
}

function materialTable(context, items, caps, refresh) {
  const detailLink = item => `/projects/${encodeURIComponent(context.project.id)}/modules/materials/${encodeURIComponent(item.id)}`;
  const tbody = el("tbody", {}, items.map(item => {
    const link = el("a", { href: detailLink(item), text: item.name, onClick: event => { event.preventDefault(); context.navigate(detailLink(item)); } });
    const actions = [el("a", { className: "secondary-button", href: detailLink(item), text: "查看材料", onClick: event => { event.preventDefault(); context.navigate(detailLink(item)); } })];
    if (caps.retry && ["failed", "dependency_missing"].includes(item.status)) actions.push(el("button", { type: "button", className: "ghost-button", text: "重试处理", onClick: async () => { await context.api(materialPath(context, `/${encodeURIComponent(item.id)}/retry`), { method: "POST", mutation: true }); context.showToast("材料已进入重试队列"); await refresh(); } }));
    return el("tr", {}, [el("th", { scope: "row" }, [link, el("small", { text: item.extension || item.sourceKind || "待补充" })]), el("td", { text: item.updateTemplate?.label ?? "未选择更新模板" }), el("td", {}, [readinessNode(item)]), el("td", {}, [el("span", { className: `material-status status-${item.status}`, text: materialStatus[item.status] ?? item.status })]), el("td", {}, item.evidenceCount > 0 ? [el("a", { href: detailLink(item), text: `${item.evidenceCount} 个证据块`, onClick: event => { event.preventDefault(); context.navigate(detailLink(item)); } })] : [el("span", { text: "0 个证据块" })]), el("td", { text: item.qa?.enabled ? "已授权问答" : item.status === "ready" ? "未授权问答" : "不可用于问答" }), el("td", {}, [el("span", { text: safeText(item.uploadedBy) }), el("small", { text: uiDate(item.createdAt) })]), el("td", { text: bytes(item.size) }), el("td", {}, [el("div", { className: "row-actions" }, actions)])]);
  }));
  return el("div", { className: "table-scroll material-table-scroll", tabIndex: 0, role: "region", ariaLabel: "材料台账，可水平滚动" }, [el("table", { className: "module-table material-table" }, [el("caption", { text: "当前项目材料台账" }), el("thead", {}, [el("tr", {}, ["材料", "类型 / 模板", "关键内容", "处理状态", "证据块", "问答授权", "上传者 / 时间", "大小", "操作"].map(label => el("th", { scope: "col", text: label })))]), tbody])]);
}

function detailMetadata(material) {
  return definitionList([["材料类型", material.extension || material.sourceKind], ["处理状态", materialStatus[material.status] ?? material.status], ["更新模板", material.updateTemplate?.label ?? "未选择更新模板"], ["关键内容", readinessText(material)], ["上传者 / 时间", `${safeText(material.uploadedBy)} · ${uiDate(material.createdAt)}`], ["原始大小", bytes(material.size)], ["SHA-256", safeText(material.sha256)], ["证据块", `${material.evidenceCount ?? 0} 个`], ["问答授权", material.qa?.enabled ? "已授权问答" : "未授权问答"], ["生成授权", material.generation?.enabled ? "已授权生成" : "未授权生成"]], "material-detail-meta");
}

function renderMaterialDetail(context, root) {
  const load = async () => {
    root.setAttribute("aria-busy", "true");
    try {
      const id = encodeURIComponent(context.materialId);
      const [response, evidenceResponse, catalog] = await Promise.all([context.api(materialPath(context, `/${id}`)), context.api(materialPath(context, `/${id}/evidence`)), context.api(materialPath(context, "/capabilities"))]);
      const material = response.material, caps = response.capabilities ?? {}, items = evidenceResponse.items ?? [];
      const base = `/projects/${encodeURIComponent(context.project.id)}/modules/materials/${encodeURIComponent(material.id)}`;
      const selectedId = context.query.get("evidence"); const selected = items.find(item => item.id === selectedId) ?? items[0];
      const index = items.length ? el("div", { className: "evidence-index" }, items.map(item => el("a", { href: `${base}?evidence=${encodeURIComponent(item.id)}`, className: selected?.id === item.id ? "selected" : "", ariaCurrent: selected?.id === item.id ? "location" : null, onClick: event => { event.preventDefault(); context.navigate(`${base}?evidence=${encodeURIComponent(item.id)}`); } }, [el("strong", { text: locatorLabel(item) }), el("span", { text: safeText(item.summary, item.text?.slice(0, 100)) }), el("small", { text: item.id })]))) : el("section", { className: "module-empty" }, [el("h2", { text: "该材料尚未形成可定位证据" }), el("p", { text: material.status === "failed" ? "材料处理失败，可在权限允许时重试处理。" : "材料可能仍在预处理，证据就绪后会显示在这里。" })]);
      const select = el("select", { className: "mobile-evidence-select", ariaLabel: "选择证据位置" }, items.map(item => el("option", { value: item.id, text: locatorLabel(item) }))); if (selected) select.value = selected.id; select.addEventListener("change", () => context.navigate(`${base}?evidence=${encodeURIComponent(select.value)}`));
      const preview = selected ? el("article", { className: "evidence-preview", ariaLive: "polite" }, [el("span", { className: "eyebrow", text: "EVIDENCE LOCATOR" }), el("h2", { text: locatorLabel(selected) }), el("p", { className: "evidence-id", text: `证据块 ${selected.id}` }), el("blockquote", { text: safeText(selected.summary, selected.text) }), el("details", {}, [el("summary", { text: "查看提取文本" }), el("pre", { text: safeText(selected.text) })]), el("p", { className: "locator-note", text: locatorLabel(selected) === "未提供精确区域" ? "未提供精确区域" : "定位信息来自预处理结果" })]) : el("div", { className: "evidence-preview empty-preview", text: "选择证据位置后查看可追溯文本。" });
      const controls = [];
      if (caps.selectUpdateTemplate) {
        const template = templateSelect(catalog.updateTemplates, "detail-update-template"); template.value = material.updateTemplate?.id ?? "";
        controls.push(el("form", { className: "metadata-control", onSubmit: async event => { event.preventDefault(); await context.api(materialPath(context, `/${id}/update-template`), { method: "PATCH", mutation: true, body: { id: template.value, version: "1.0.0" } }); context.showToast("更新模板已记录"); await load(); } }, [el("label", { htmlFor: "detail-update-template", text: "材料用途" }), template, el("button", { type: "submit", className: "secondary-button", text: "保存材料用途" })]));
      }
      if (caps.manageQa) controls.push(el("button", { type: "button", className: "secondary-button", text: material.qa?.enabled ? "取消问答授权" : "授权用于问答", onClick: async () => { await context.api(materialPath(context, `/${id}/qa`), { method: "PATCH", mutation: true, body: { enabled: !material.qa?.enabled, audience: "project_members" } }); context.showToast(material.qa?.enabled ? "已取消问答授权" : "已授权用于问答"); await load(); } }));
      if (caps.manageGeneration) controls.push(el("button", { type: "button", className: "secondary-button", text: material.generation?.enabled ? "取消生成授权" : "授权用于生成", onClick: async () => { await context.api(materialPath(context, `/${id}/generation`), { method: "PATCH", mutation: true, body: { enabled: !material.generation?.enabled } }); context.showToast(material.generation?.enabled ? "已取消生成授权" : "已授权用于生成"); await load(); } }));
      if (caps.createGenerationTask && material.status === "ready" && material.updateTemplate && material.generation?.enabled && Number(material.evidenceCount) > 0 && material.readiness?.status !== "blocked") controls.push(el("button", { type: "button", className: "primary-button", text: context.presentation.kind === "campaign" ? "生成作战更新提案" : "生成项目更新提案", onClick: event => openGenerationSheet(context, material, event.currentTarget) }));
      if (caps.retry && ["failed", "dependency_missing"].includes(material.status)) controls.push(el("button", { type: "button", className: "secondary-button", text: "重试处理", onClick: async () => { await context.api(materialPath(context, `/${id}/retry`), { method: "POST", mutation: true }); context.showToast("材料已进入重试队列"); await load(); } }));
      const readiness = material.readiness;
      root.replaceChildren(el("a", { className: "back-link", href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`, text: "← 返回材料台账", onClick: event => { event.preventDefault(); context.navigate(event.currentTarget.getAttribute("href")); } }), el("section", { className: "materials-detail-card" }, [el("header", { className: "material-detail-heading" }, [el("div", {}, [el("span", { className: "eyebrow", text: "MATERIAL EVIDENCE" }), el("h1", { text: material.name })]), el("span", { className: `material-status status-${material.status}`, text: materialStatus[material.status] ?? material.status })]), detailMetadata(material), readiness ? el("section", { className: `readiness-panel readiness-${readiness.status}` }, [el("h2", { text: readinessText(material) }), el("p", { text: readiness.suggestion }), readiness.missing?.length ? el("ul", {}, readiness.missing.map(item => el("li", { text: `缺失：${item.label}` }))) : null, readiness.warnings?.length ? el("ul", {}, readiness.warnings.map(item => el("li", { text: `建议补充：${item.label}` }))) : null]) : null, el("p", { className: "material-boundary", text: "AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本。" }), controls.length ? el("div", { className: "material-detail-controls" }, controls) : null, el("div", { className: "evidence-layout" }, [el("aside", { ariaLabel: "证据位置索引" }, [index]), select, preview]) ]));
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(el("section", { className: "module-error error-panel", role: "alert" }, [el("h1", { text: error.status === 404 ? "材料不存在或你无权访问" : "无法加载材料详情" }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "secondary-button", text: "返回材料台账", onClick: () => context.navigate(`/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`) })]));
    } finally { root.setAttribute("aria-busy", "false"); }
  };
  void load();
}

function renderQa(context, root) {
  const qaLabel = context.presentation.kind === "campaign" ? "战情问答" : "项目问答";
  const assistant = context.presentation.kind === "campaign" ? "作战参谋" : "项目助手";
  const suggestions = context.presentation.kind === "campaign" ? ["当前战役路线进行到哪里？", "哪些行动任务存在风险？", "最近归档了哪些战果依据？"] : ["当前项目里程碑进展如何？", "哪些任务存在风险？", "最近有哪些交付物依据？"];
  const load = async () => {
    root.setAttribute("aria-busy", "true");
    try {
      const [ledger, quota] = await Promise.all([context.api(materialPath(context)), context.api(chatPath(context, "/quota"))]);
      const conversation = el("div", { className: "qa-conversation", ariaLive: "polite" }, [el("article", { className: "qa-message assistant" }, [el("strong", { text: assistant }), el("p", { text: "只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。" })])]);
      const question = el("textarea", { id: "material-question", rows: 4, maxLength: 1000, placeholder: context.presentation.kind === "campaign" ? "询问当前战况、作战单元、节点或行动任务…" : "询问当前项目、团队、里程碑或任务…" });
      const count = el("small", { className: "character-count", text: "还可输入 1000 字" }); question.addEventListener("input", () => { count.textContent = `还可输入 ${1000 - question.value.length} 字`; });
      const error = el("p", { className: "form-error", role: "alert" });
      const send = el("button", { type: "submit", className: "primary-button", text: "发送问题" });
      const submit = async () => {
        const value = question.value.trim(); if (!value) { error.textContent = "请输入问题"; question.focus(); return; }
        error.textContent = ""; send.disabled = true; send.textContent = "正在查找依据…";
        conversation.append(el("article", { className: "qa-message user" }, [el("strong", { text: "你" }), el("p", { text: value })]));
        try {
          const answer = await context.api(chatPath(context), { method: "POST", mutation: true, body: { question: value } });
          const response = el("article", { className: "qa-message assistant" }, [el("strong", { text: assistant }), el("p", { text: answer.answer || "现有资料不足以回答这个问题。" })]);
          if (answer.caveat && answer.caveat !== answer.answer) response.append(el("p", { className: "qa-caveat", text: answer.caveat }));
          if (answer.citations?.length) response.append(el("h3", { text: "引用来源" }), el("ol", { className: "citation-list" }, answer.citations.map((citation, index) => { const href = `/projects/${encodeURIComponent(context.project.id)}/modules/materials/${encodeURIComponent(citation.materialId)}?evidence=${encodeURIComponent(citation.evidenceId)}`; return el("li", {}, [el("a", { href, ariaLabel: `引用 ${index + 1}：${locatorLabel(citation)}`, onClick: event => { event.preventDefault(); context.navigate(href); } }, [el("strong", { text: `[${index + 1}] ${locatorLabel(citation)}` }), el("span", { text: citation.claim })])]); })));
          conversation.append(response); question.value = ""; count.textContent = "还可输入 1000 字";
        } catch (requestError) {
          question.value = value;
          if (requestError.status === 429) { error.textContent = `本项目问答配额已用完，可在 ${quota.resetTime ? uiDate(quota.resetTime) : "配额重置"} 后继续提问。`; send.disabled = true; }
          else if (requestError.code === "AI_PROVIDER_DISABLED") error.textContent = "项目问答当前未启用；材料台账和证据仍可正常使用。";
          else error.textContent = "暂时无法完成项目问答。已保留你的问题，请稍后重试。";
        } finally { if (!error.textContent.includes("配额已用完")) send.disabled = false; send.textContent = "发送问题"; }
      };
      const form = el("form", { className: "qa-form", onSubmit: event => { event.preventDefault(); void submit(); } }, [el("label", { htmlFor: "material-question", text: "问题" }), question, count, error, send]);
      question.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); } });
      const suggestionsNode = el("div", { className: "qa-suggestions", ariaLabel: "建议问题" }, suggestions.map(copy => el("button", { type: "button", className: "secondary-button", text: copy, onClick: () => { question.value = copy; question.dispatchEvent(new Event("input")); question.focus(); } })));
      const remaining = quota.usage?.remainingToday ?? ledger.usage?.chatRemainingToday ?? 0;
      root.replaceChildren(localTabs(context, "qa"), el("section", { className: "qa-boundary", text: "只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。" }), el("div", { className: "qa-layout" }, [el("aside", { className: "qa-context" }, [el("span", { className: "eyebrow", text: "READ-ONLY CONTEXT" }), el("h2", { text: context.project.name }), definitionList([["发布版本", context.version], ["授权材料", `${ledger.summary?.qaEnabledCount ?? 0} 项`], ["今日剩余", `${remaining} 次`], ["重置时间", quota.resetTime ? uiDate(quota.resetTime) : "服务端每日重置"]]), el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`, text: "查看授权来源", onClick: event => { event.preventDefault(); context.navigate(event.currentTarget.getAttribute("href")); } })]), el("section", { className: "qa-panel" }, [el("header", {}, [el("span", { className: "eyebrow", text: "CITED PROJECT Q&A" }), el("h2", { text: qaLabel })]), ledger.summary?.qaEnabledCount ? suggestionsNode : el("p", { className: "empty-source", text: "暂无可用于问答的授权材料" }), conversation, form]) ]));
      if (remaining <= 0) { send.disabled = true; error.textContent = `本项目问答配额已用完，可在 ${quota.resetTime ? uiDate(quota.resetTime) : "配额重置"} 后继续提问。`; }
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(localTabs(context, "qa"), el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: `无法加载${qaLabel}` }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "primary-button", text: "重新加载", onClick: load })]));
    } finally { root.setAttribute("aria-busy", "false"); }
  };
  void load();
}

const generationStateLabels = Object.freeze({ queued: "等待生成资源", retrieving_evidence: "锁定并整理证据", generating: "生成结构化增量", repairing: "修复结构输出", validating: "执行服务端校验", succeeded: "结构化提案已生成", failed_retryable: "生成暂时失败，可重试", failed_terminal: "生成失败，未创建提案", stale: "发布基准已变化" });
const semanticLabels = Object.freeze({ fact: "事实 fact", plan: "计划 plan", suggestion: "建议 suggestion", unknown: "待确认 unknown" });
const operationLabels = Object.freeze({ create: "新增建议", update: "更新建议", delete: "删除建议" });
const proposalStatusLabels = Object.freeze({ pending: "待审核", accepted: "已合并草稿", rejected: "已驳回", superseded: "基准已过期" });
const reviewLabels = Object.freeze({ pending: "待决定", accepted: "已接受", rejected: "已驳回" });

function taskHref(context, id) { return materialsUiPath(context, `/generation-tasks/${encodeURIComponent(id)}`); }
function proposalHref(context, id, changeId = "") { const query = changeId ? `?change=${encodeURIComponent(changeId)}` : ""; return materialsUiPath(context, `/proposals/${encodeURIComponent(id)}${query}`); }
function linkTo(context, href, text, className = "") { return el("a", { href, className, text, onClick: event => { event.preventDefault(); context.navigate(href); } }); }

function generationUsage(task) {
  const attempts = task.attempts ?? []; const input = attempts.reduce((sum,item)=>sum+Number(item.inputTokens??0),0), output = attempts.reduce((sum,item)=>sum+Number(item.outputTokens??0),0);
  const priced = attempts.filter(item=>item.costStatus==="priced"); const cost = priced.reduce((sum,item)=>sum+Number(item.costMicros??0),0);
  return { attempts: attempts.length, tokens: input + output, cost: priced.length ? `${priced[0].currency ?? ""} ${(cost/1_000_000).toFixed(6)}`.trim() : "未配置单价，仅记录 Token" };
}

function renderProposalWorkspace(context, root) {
  const campaign = context.presentation.kind === "campaign";
  const load = async () => { root.setAttribute("aria-busy","true"); try {
    const [proposalResponse, taskResponse, envelope] = await Promise.all([context.api(proposalPath(context)),context.api(generationPath(context)),context.api(generationPath(context,"/capabilities"))]);
    const proposals=proposalResponse.items??[],tasks=taskResponse.items??[],caps=envelope.capabilities??{};
    const create=caps.create?el("button",{type:"button",className:"primary-button",text:campaign?"生成作战更新提案":"生成项目更新提案",onClick:event=>openGenerationSheet(context,null,event.currentTarget)}):null;
    const running=tasks.filter(item=>!["succeeded","failed_retryable","failed_terminal","stale"].includes(item.state)).length;
    const retryable=tasks.filter(item=>item.state==="failed_retryable").length;
    const stale=tasks.filter(item=>item.state==="stale").length;
    const proposalCards=proposals.map(item=>el("article",{className:"proposal-row"},[
      el("div",{},[el("span",{className:"eyebrow",text:"VALIDATED CHANGE PROPOSAL"}),el("h3",{text:`提案 ${item.proposalId}`}),el("p",{text:item.summary})]),
      definitionList([["基准版本",item.baseVersionLabel??item.baseVersionId],["模板",`${item.template?.id??"—"} · ${item.template?.version??"—"}`],["建议变更",`${item.changes?.length??0} 项`],["状态",proposalStatusLabels[item.status]??item.status]]),
      linkTo(context,proposalHref(context,item.proposalId),"查看结构化提案","secondary-button")
    ]));
    const taskCards=tasks.map(item=>{const usage=generationUsage(item);return el("article",{className:"generation-task-row"},[
      el("div",{},[el("strong",{text:`任务 ${item.id}`}),el("span",{className:`generation-state state-${item.state}`,text:generationStateLabels[item.state]??item.state}),el("small",{text:`${item.template?.id??"—"} · ${item.baseVersionLabel??item.baseVersionId} · ${uiDate(item.createdAt)}`})]),
      el("div",{className:"generation-usage",text:`${usage.attempts} 次调用 · ${usage.tokens} Token · ${usage.cost}`}),linkTo(context,taskHref(context,item.id),"查看任务","secondary-button")]);});
    root.replaceChildren(localTabs(context,"proposals"),el("section",{className:"materials-workspace-card proposal-workspace"},[
      el("header",{className:"proposal-workspace-header"},[el("div",{},[el("span",{className:"eyebrow",text:campaign?"BATTLE CHANGE PROPOSALS":"PROJECT CHANGE PROPOSALS"}),el("h2",{text:campaign?"作战更新提案":"项目更新提案"}),el("p",{text:"提案只包含服务端校验后的结构化增量，尚未写入草稿，也未发布。"})]),create]),
      el("div",{className:"material-summary-grid"},[summaryCard("结构化提案",proposals.length,"仅已通过校验"),summaryCard("处理中任务",running,"不会阻塞项目浏览"),summaryCard("可重试失败",retryable,"保留原任务记录"),summaryCard("基准已过期",stale,"不会自动改用新版本")]),
      el("p",{className:"material-boundary",text:"AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本。"}),
      el("section",{className:"proposal-list"},[el("h3",{text:"更新提案"}),...(proposalCards.length?proposalCards:[el("div",{className:"module-empty"},[el("h3",{text:"尚未生成结构化更新提案"}),el("p",{text:campaign?"从已就绪材料生成带来源的作战增量；不会修改草稿或发布状态。":"从已就绪材料生成带来源的项目增量；不会修改草稿或发布状态。"})])])]),
      el("section",{className:"generation-task-list"},[el("h3",{text:"生成任务"}),...(taskCards.length?taskCards:[el("p",{className:"empty-source",text:"尚无生成任务。"})])])
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(localTabs(context,"proposals"),el("section",{className:"module-error error-panel",role:"alert"},[el("h2",{text:"无法加载更新提案"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"primary-button",text:"重新加载提案",onClick:load})]));}finally{root.setAttribute("aria-busy","false");}};void load();
}

function renderGenerationTaskDetail(context, root) {
  const load=async()=>{root.setAttribute("aria-busy","true");try{const response=await context.api(generationPath(context,`/${encodeURIComponent(context.generationTaskId)}`));const task=response.task,usage=generationUsage(task);const steps=["queued","retrieving_evidence","generating","repairing","validating","succeeded"];const reached=steps.indexOf(task.state);const timeline=el("ol",{className:"generation-timeline"},steps.map((state,index)=>el("li",{className:index<=reached?"complete":""},[el("strong",{text:generationStateLabels[state]}),el("span",{text:index<reached||task.state==="succeeded"?"已完成":index===reached?"当前步骤":"等待"})])));
      const attempts=(task.attempts??[]).map(item=>el("tr",{},[el("td",{text:String(item.attemptNumber)}),el("td",{text:item.kind}),el("td",{text:item.outcome}),el("td",{text:`${item.inputTokens+item.outputTokens}`}),el("td",{text:item.costStatus==="priced"?`${item.currency??""} ${(Number(item.costMicros)/1_000_000).toFixed(6)}`:"未配置单价，仅记录 Token"}),el("td",{text:item.resultCode??"—"})]));
      const actions=[];if(task.proposalId)actions.push(linkTo(context,proposalHref(context,task.proposalId),"查看结构化提案","primary-button"));if(response.capabilities?.retry&&["failed_retryable","stale"].includes(task.state))actions.push(el("button",{type:"button",className:"secondary-button",text:task.state==="stale"?"基于当前版本创建新任务":"重试生成",onClick:async()=>{const result=await context.api(generationPath(context,`/${encodeURIComponent(task.id)}/retry`),{method:"POST",mutation:true,body:{idempotencyKey:crypto.randomUUID()}});context.navigate(taskHref(context,result.task.id));}}));
      root.replaceChildren(localTabs(context,"proposals"),linkTo(context,materialsUiPath(context,"?view=proposals"),"← 返回更新提案","back-link"),el("section",{className:"materials-detail-card generation-task-detail"},[
        el("header",{className:"material-detail-heading"},[el("div",{},[el("span",{className:"eyebrow",text:"GENERATION TASK"}),el("h1",{text:`生成任务 ${task.id}`})]),el("span",{className:`generation-state state-${task.state}`,text:generationStateLabels[task.state]??task.state})]),
        el("p",{className:"material-boundary",text:task.state==="stale"?"发布版本已变化；此任务不会自动改用新版本。":"更新生成只创建结构化建议，不会修改项目草稿或发布版本。"}),
        el("div",{className:"generation-detail-layout"},[el("section",{},[el("h2",{text:"任务进程"}),timeline]),el("aside",{className:"generation-context-card"},[el("h2",{text:"锁定上下文"}),definitionList([["项目",task.projectId],["发布基准",`${task.baseVersionLabel} · ${task.baseVersionId}`],["模板",`${task.template.id} · ${task.template.version}`],["Schema",task.schemaVersion],["材料",`${task.materials.length} 份`],["证据",`${task.evidence.length} 块`],["Token",usage.tokens],["成本",usage.cost]])])]),
        task.errorCode?el("p",{className:"form-error",role:"alert",text:task.state==="failed_retryable"?"更新生成暂时失败，未影响项目数据。":"模型输出未通过结构校验，未创建提案。"}):null,
        actions.length?el("div",{className:"material-detail-controls"},actions):null,
        attempts.length?el("div",{className:"table-scroll",tabIndex:0,role:"region",ariaLabel:"生成尝试与用量"},[el("table",{className:"module-table generation-attempt-table"},[el("caption",{text:"生成尝试、Token 与成本"}),el("thead",{},[el("tr",{},["次数","类型","结果","Token","成本","结果码"].map(label=>el("th",{scope:"col",text:label})))]),el("tbody",{},attempts)])]):null
      ]));
    }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h1",{text:error.status===404?"生成任务不存在或你无权访问":"无法加载生成任务"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"secondary-button",text:"返回更新提案",onClick:()=>context.navigate(materialsUiPath(context,"?view=proposals"))})]));}finally{root.setAttribute("aria-busy","false");}};void load();
}

function valueText(value){
  if(value===null||value===undefined||value==="")return "—";
  if(Array.isArray(value))return value.join("、");
  if(typeof value==="object")return Object.entries(value).map(([key,item])=>`${key}: ${valueText(item)}`).join("；");
  if(typeof value==="boolean")return value?"是":"否";
  return String(value);
}

function patchRows(value,prefix=""){
  const rows=[];
  for(const [key,item] of Object.entries(value??{})){
    const path=prefix?`${prefix}.${key}`:key;
    if(item&&typeof item==="object"&&!Array.isArray(item))rows.push(...patchRows(item,path));
    else rows.push([path,item]);
  }
  return rows;
}

function setPatchValue(target,path,value){
  const parts=path.split(".");let cursor=target;
  for(const part of parts.slice(0,-1))cursor=cursor[part]??={};
  cursor[parts.at(-1)]=value;
}

function editorValue(raw,original){
  if(typeof original==="boolean")return Boolean(raw);
  if(typeof original==="number")return Number(raw);
  if(Array.isArray(original))return String(raw).split(",").map(item=>item.trim()).filter(Boolean);
  return String(raw);
}

function openReviewEditor(context,change,onSaved,returnFocus){
  modalSheet({title:"编辑后接受",eyebrow:"FIELD-BOUND REVIEW EDIT",project:context.project,returnFocus,className:"material-sheet review-edit-sheet",closeLabel:"关闭审核编辑",titleId:"review-edit-title",render:controls=>{
    const patch=change.review?.editedPatch??change.patch, inputs=new Map();
    const fields=patchRows(patch).map(([path,value],index)=>{
      const id=`review-field-${index}`;let input;
      if(typeof value==="boolean")input=el("input",{id,type:"checkbox",checked:value});
      else if(typeof value==="number")input=el("input",{id,type:"number",value:String(value),step:"any",required:true});
      else if(String(path).toLowerCase().includes("date"))input=el("input",{id,type:"date",value:String(value??"")});
      else if(String(value??"").length>80)input=el("textarea",{id,rows:3,value:String(value??""),required:true});
      else input=el("input",{id,type:"text",value:Array.isArray(value)?value.join(", "):String(value??""),required:true});
      inputs.set(path,{input,original:value});return el("div",{className:"field"},[el("label",{htmlFor:id,text:path}),input,Array.isArray(value)?el("small",{text:"多个值请用英文逗号分隔"}):null]);
    });
    const note=el("textarea",{id:"review-note",rows:3,maxLength:500,placeholder:"可选：记录修改原因"});
    const error=el("p",{className:"form-error",role:"alert"}),submit=el("button",{type:"submit",className:"primary-button",text:"校验并接受"});
    const form=el("form",{className:"review-edit-form",onSubmit:async event=>{event.preventDefault();error.textContent="";submit.disabled=true;controls.setCommitting(true);try{const edited={};for(const [path,entry] of inputs){setPatchValue(edited,path,editorValue(entry.input.type==="checkbox"?entry.input.checked:entry.input.value,entry.original));}await context.api(proposalPath(context,`/${encodeURIComponent(context.proposalId)}/review/${encodeURIComponent(change.changeId)}`),{method:"PATCH",mutation:true,body:{decision:"accepted",patch:edited,note:note.value}});controls.setCommitting(false);controls.close();await onSaved();context.showToast("编辑已通过服务端校验并接受");}catch(requestError){error.textContent=requestError.message;controls.setCommitting(false);submit.disabled=false;}}},[...fields,el("div",{className:"field"},[el("label",{htmlFor:"review-note",text:"审核说明"}),note]),error,el("footer",{className:"sheet-actions"},[el("button",{type:"button",className:"secondary-button",text:"取消",onClick:controls.close}),submit])]);
    controls.body.replaceChildren(el("p",{className:"material-boundary",text:"这里只编辑当前变更的受控字段；保存前会再次执行 Schema、证据、日期与依赖校验。"}),form);
  }});
}

function renderProposalDetail(context, root) {
  const load=async()=>{root.setAttribute("aria-busy","true");try{
    const [detail,reviewResponse]=await Promise.all([context.api(proposalPath(context,`/${encodeURIComponent(context.proposalId)}`)),context.api(proposalPath(context,`/${encodeURIComponent(context.proposalId)}/review`))]);
    const proposal=reviewResponse.proposal,evidenceByChange=new Map((detail.proposal.changes??[]).map(item=>[item.changeId,item.evidence??[]]));
    const selectedId=context.query.get("change"),selected=proposal.changes.find(item=>item.changeId===selectedId)??proposal.changes[0];
    const index=el("nav",{className:"proposal-change-index",ariaLabel:"建议变更索引"},proposal.changes.map(item=>linkTo(context,proposalHref(context,proposal.proposalId,item.changeId),`${reviewLabels[item.review?.decision??"pending"]} · ${operationLabels[item.operation]} · ${item.targetId}`,item.changeId===selected.changeId?"selected":"")));
    const effectivePatch=selected.review?.editedPatch??selected.patch,originalRows=patchRows(selected.original??{}),suggestedRows=patchRows(effectivePatch),evidence=evidenceByChange.get(selected.changeId)??[];
    const evidenceList=evidence.length?el("ol",{className:"proposal-evidence-list"},evidence.map(item=>{const href=materialsUiPath(context,`/${encodeURIComponent(item.materialId)}?evidence=${encodeURIComponent(item.evidenceId)}`);return el("li",{},[linkTo(context,href,`${item.materialName??item.materialId} · ${locatorLabel(item)}`),el("small",{text:item.claim??item.evidenceId})]);})):el("p",{className:"form-error",text:"该项没有直接证据引用。"});
    const decide=async decision=>{try{await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/review/${encodeURIComponent(selected.changeId)}`),{method:"PATCH",mutation:true,body:{decision}});context.showToast(decision==="accepted"?"该项已接受":"该项已驳回");await load();}catch(error){context.showToast(error.message);}};
    const modules=[...new Set(proposal.changes.map(item=>item.module))],actions=[];
    if(reviewResponse.capabilities.review){actions.push(el("button",{type:"button",className:"primary-button",text:"接受此项",onClick:()=>void decide("accepted")}),el("button",{type:"button",className:"danger-button",text:"驳回此项",onClick:()=>void decide("rejected")}),el("button",{type:"button",className:"secondary-button",text:"编辑后接受",onClick:event=>openReviewEditor(context,selected,load,event.currentTarget)}));}
    const moduleActions=reviewResponse.capabilities.review?el("div",{className:"module-review-actions"},modules.map(module=>el("button",{type:"button",className:"ghost-button",text:`接受 ${module} 模块`,onClick:async()=>{try{await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/review/modules/${encodeURIComponent(module)}`),{method:"POST",mutation:true});context.showToast(`${module} 模块已接受`);await load();}catch(error){context.showToast(error.message);}}}))):null;
    const merge=reviewResponse.capabilities.merge?el("button",{type:"button",className:"primary-button",text:"事务合并到草稿",onClick:async()=>{try{const result=await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/merge`),{method:"POST",mutation:true,body:{}});context.showToast(`已生成独立草稿 ${result.draft.versionLabel}`);await load();}catch(error){context.showToast(error.message);}}}):null;
    const warnings=[...(proposal.warnings??[]),...(selected.warnings??[])];
    root.replaceChildren(localTabs(context,"proposals"),linkTo(context,materialsUiPath(context,"?view=proposals"),"← 返回更新提案","back-link"),el("section",{className:"materials-detail-card proposal-detail review-detail"},[
      el("header",{className:"material-detail-heading"},[el("div",{},[el("span",{className:"eyebrow",text:"HUMAN REVIEW · STRUCTURED DELTA"}),el("h1",{text:`审核提案 ${proposal.proposalId}`})]),el("span",{className:`review-state review-${selected.review?.decision??"pending"}`,text:reviewLabels[selected.review?.decision??"pending"]})]),
      el("p",{className:"material-boundary",text:`基准为发布版本 ${proposal.baseVersionLabel??proposal.baseVersionId}。接受只记录审核决定；只有“事务合并到草稿”才会创建新的草稿版本。`}),
      el("p",{className:"validation-pass",text:"服务端校验结果：Schema、项目归属、证据、日期与依赖检查均已通过；审核编辑会再次校验。"}),
      el("div",{className:"review-summary-grid"},[summaryCard("待决定",reviewResponse.capabilities.pending,"必须逐项完成"),summaryCard("已接受",reviewResponse.capabilities.accepted,"等待事务合并"),summaryCard("已驳回",reviewResponse.capabilities.rejected,"保留审核记录"),summaryCard("草稿合并",reviewResponse.merged?"已完成":"未执行","不会直接发布")]),
      moduleActions,
      el("div",{className:"proposal-detail-layout"},[index,el("article",{className:"proposal-change-card",ariaLive:"polite"},[
        el("header",{},[el("span",{className:"eyebrow",text:selected.module}),el("h2",{text:`${operationLabels[selected.operation]} · ${selected.targetId}`})]),
        definitionList([["changeId",selected.changeId],["语义类型",semanticLabels[selected.semanticType]??selected.semanticType],["置信度",`${selected.confidence>=.8?"高":selected.confidence>=.6?"中":"低"}（${Number(selected.confidence).toFixed(2)}）`],["审核人",selected.review?.reviewedByName??"待审核"]]),
        el("h3",{text:"结构化字段差异"}),
        el("div",{className:"review-diff-grid"},[el("section",{},[el("h3",{text:"原值"}),selected.operation==="create"?el("p",{className:"empty-source",text:"新增项没有原值"}):el("dl",{className:"proposal-patch-fields"},originalRows.flatMap(([key,value])=>[el("dt",{text:key}),el("dd",{text:valueText(value)})]))]),el("section",{},[el("h3",{text:selected.review?.editedPatch?"审核编辑值":"建议值"}),el("dl",{className:"proposal-patch-fields"},suggestedRows.flatMap(([key,value])=>[el("dt",{text:key}),el("dd",{text:valueText(value)})]))])]),
        el("h3",{text:"引用证据"}),evidenceList,
        warnings.length?el("section",{className:"proposal-warnings"},[el("h3",{text:"警告"}),el("ul",{},[...new Set(warnings)].map(code=>el("li",{text:code})))]):el("p",{className:"validation-pass",text:"该项没有额外警告。"}),
        actions.length?el("div",{className:"review-actions"},actions):null
      ])]),
      merge?el("footer",{className:"merge-bar"},[el("div",{},[el("strong",{text:"所有变更已完成审核"}),el("p",{text:"合并会以当前草稿为源创建新草稿；任一校验失败将整体回滚。"})]),merge]):null
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h1",{text:error.status===404?"更新提案不存在或你无权访问":"无法加载更新提案"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"secondary-button",text:"返回更新提案",onClick:()=>context.navigate(materialsUiPath(context,"?view=proposals"))})]));}finally{root.setAttribute("aria-busy","false");}};void load();
}

function renderReleaseCenter(context,root){
  const campaign=context.presentation.kind==="campaign",load=async()=>{root.setAttribute("aria-busy","true");try{
    const [preview,history,members,audit]=await Promise.all([context.api(releasePath(context,"/preview")),context.api(releasePath(context,"/history")),context.api(`/api/projects/${encodeURIComponent(context.project.id)}/members`).catch(()=>({items:[]})),context.api(releasePath(context,"/audit")).catch(()=>({items:[]}))]);
    const publish=preview.capabilities.publish?el("form",{className:"release-form",onSubmit:async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector("button");button.disabled=true;try{const result=await context.api(releasePath(context,"/publish"),{method:"POST",mutation:true,body:{previewToken:preview.previewToken,versionLabel:form.elements.versionLabel.value.trim(),acknowledged:form.elements.acknowledged.checked}});context.showToast(`已发布 ${result.versionLabel}`);context.navigate(materialsUiPath(context,"?view=release"));}catch(error){context.showToast(error.message);button.disabled=false;}}},[el("div",{className:"field"},[el("label",{htmlFor:"release-version-label",text:"发布版本标签"}),el("input",{id:"release-version-label",name:"versionLabel",required:true,pattern:"[A-Za-z0-9][A-Za-z0-9._-]{0,79}",placeholder:"例如：v1.1.0"})]),el("label",{className:"release-ack"},[el("input",{type:"checkbox",name:"acknowledged",required:true}),el("span",{text:"我已核对草稿差异、结构校验和待审核项"})]),el("button",{type:"submit",className:"primary-button",text:campaign?"发布当前作战版本":"发布当前项目版本"})]):el("p",{className:"empty-source",text:preview.changes.count?"当前角色只能预览，发布需要项目管理员权限。":"草稿与发布版本一致，暂无可发布差异。"});
    const rollback=preview.capabilities.rollback?el("button",{type:"button",className:"danger-button",text:"回滚到直接上一发布版本",onClick:async event=>{event.currentTarget.disabled=true;try{await context.api(releasePath(context,"/rollback"),{method:"POST",mutation:true,body:{confirmed:true,targetVersionId:preview.rollbackTarget.versionId}});context.showToast("已回滚并创建新的草稿基线");context.navigate(materialsUiPath(context,"?view=release"));}catch(error){context.showToast(error.message);event.currentTarget.disabled=false;}}}):null;
    const checklist=[["草稿结构校验",preview.checklist.graphValid],["存在待发布差异",preview.checklist.hasChanges],["没有未决定审核项",preview.checklist.unresolvedReviewItems===0],["提案不能直达发布",preview.checklist.proposalToPublishedDirectPath===false]];
    const checklistNode=el("ul",{className:"release-checklist"},checklist.map(([label,passed])=>el("li",{className:passed?"passed":"blocked"},[el("strong",{text:passed?"通过":"阻止"}),el("span",{text:label})])));
    const moduleCounts=preview.changes.count
      ? el("div",{className:"release-module-counts"},Object.entries(preview.changes.byModule).map(([module,count])=>el("span",{className:"count-pill",text:`${module} · ${count}`})))
      : el("p",{className:"empty-source",text:"当前草稿与发布版本一致。"});
    const previewCard=el("section",{className:"release-preview-card"},[
      el("h3",{text:"草稿差异预览"}),moduleCounts,el("h3",{text:"发布检查清单"}),checklistNode,
      preview.validation.valid?el("p",{className:"validation-pass",text:preview.validation.message}):el("p",{className:"form-error",text:preview.validation.message})
    ]);
    const actionCard=el("aside",{className:"release-action-card"},[
      el("h3",{text:"受控发布"}),publish,
      rollback?el("div",{className:"rollback-panel"},[el("h3",{text:"安全回滚"}),el("p",{text:`仅可回滚到直接上一发布版本（版本 ID ${preview.rollbackTarget.versionId}）。`}),rollback]):null
    ]);
    const historyNode=history.items.length
      ? el("ol",{className:"release-history"},history.items.map(item=>el("li",{},[el("strong",{text:`${item.action==="rollback"?"回滚":"发布"} · ${item.versionLabel}`}),el("span",{text:`${item.createdBy} · ${uiDate(item.createdAt)}`})])))
      : el("p",{className:"empty-source",text:"尚无发布事件。"});
    const memberRows=members.items.map(item=>el("tr",{},[el("td",{text:item.displayName}),el("td",{text:item.loginName}),el("td",{text:item.role}),el("td",{text:item.status})]));
    const membersNode=memberRows.length
      ? el("div",{className:"table-scroll"},[el("table",{className:"module-table member-table"},[el("thead",{},[el("tr",{},["成员","账号","角色","状态"].map(label=>el("th",{text:label})))]),el("tbody",{},memberRows)])])
      : el("p",{className:"empty-source",text:"无权查看成员或尚无成员。"});
    const auditNode=audit.items.length?el("details",{className:"audit-log"},[
      el("summary",{text:`审计日志（${audit.items.length}）`}),
      el("ol",{},audit.items.map(item=>el("li",{},[el("strong",{text:item.action}),el("span",{text:`${item.userName??"系统"} · ${uiDate(item.createdAt)}`})])))
    ]):null;
    root.replaceChildren(localTabs(context,"release"),el("section",{className:"materials-workspace-card release-center"},[
      el("header",{className:"proposal-workspace-header"},[el("div",{},[el("span",{className:"eyebrow",text:campaign?"CAMPAIGN REVIEW & RELEASE":"PROJECT REVIEW & RELEASE"}),el("h2",{text:campaign?"审核与发布":"审核发布中心"}),el("p",{text:"固定渲染器提供草稿预览、检查清单、发布和直接前驱回滚；AI 无法执行这些动作。"})])]),
      el("div",{className:"release-version-grid"},[summaryCard("当前发布",preview.published.versionLabel,`${preview.published.tasks} ${context.presentation.task}`),summaryCard("当前草稿",preview.draft.versionLabel,`${preview.draft.tasks} ${context.presentation.task}`),summaryCard("待发布差异",preview.changes.count,"按模块确定性计算"),summaryCard("未决定审核",preview.checklist.unresolvedReviewItems,"发布前必须人工核对")]),
      el("div",{className:"release-layout"},[previewCard,actionCard]),
      el("section",{className:"release-operations-grid"},[el("div",{},[el("h3",{text:"发布历史"}),historyNode]),el("div",{},[el("h3",{text:"项目成员"}),membersNode])]),
      auditNode
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(localTabs(context,"release"),el("section",{className:"module-error error-panel",role:"alert"},[el("h2",{text:"无法加载审核发布中心"}),el("p",{text:error.message}),el("button",{type:"button",className:"primary-button",text:"重新加载",onClick:load})]));}finally{root.setAttribute("aria-busy","false");}};void load();
}

function renderOperationsCenter(context, root) {
  const testPath = `/api/projects/${encodeURIComponent(context.project.id)}/test-runs`;
  const diagnosticsPath = `/api/diagnostics/errors?projectId=${encodeURIComponent(context.project.id)}`;
  const load = async () => {
    root.setAttribute("aria-busy", "true");
    try {
      const [runs, errors] = await Promise.all([
        context.api(testPath).catch(error => ({ error })),
        context.api(diagnosticsPath).catch(error => ({ error, items: [] }))
      ]);
      const runButton = el("button", { type: "button", className: "primary-button", text: "运行核心自检", onClick: async event => {
        event.currentTarget.disabled = true;
        try {
          const result = await context.api(testPath, { method: "POST", mutation: true, body: { suiteId: "core" } });
          context.showToast(`自检完成：${result.run.status}`);
          await load();
        } catch (error) {
          context.showToast(error.message);
          event.currentTarget.disabled = false;
        }
      } });
      const runItems = (runs.items ?? []).map(item => el("article", { className: "diagnostic-row" }, [
        el("div", {}, [el("strong", { text: `${item.suiteId} · ${item.status}` }), el("span", { text: `${item.summary?.passed ?? 0}/${item.summary?.total ?? 0} 通过 · ${uiDate(item.createdAt)}` })]),
        linkTo(context, `${materialsUiPath(context, "?view=operations")}&run=${encodeURIComponent(item.id)}`, "查看记录", "secondary-button")
      ]));
      const errorItems = (errors.items ?? []).map(item => el("article", { className: "diagnostic-row" }, [
        el("div", {}, [el("strong", { text: `${item.code} · ${item.status}` }), el("span", { text: `${item.requestId} · ${uiDate(item.createdAt)}` })]),
        el("button", { type: "button", className: "secondary-button", text: "复制报障信息", onClick: async () => {
          const bundle = await context.api(`/api/diagnostics/errors/${encodeURIComponent(item.id)}/bundle`);
          await navigator.clipboard?.writeText?.(JSON.stringify(bundle.bundle, null, 2));
          context.showToast("诊断包已复制");
        } })
      ]));
      root.replaceChildren(localTabs(context, "operations"), el("section", { className: "materials-workspace-card diagnostics-center" }, [
        el("header", { className: "proposal-workspace-header" }, [el("div", {}, [el("span", { className: "eyebrow", text: "OPERATIONS & TEST CENTER" }), el("h2", { text: "运维自检" }), el("p", { text: "管理员可运行安全自检，并用 requestId 查询脱敏错误堆栈和关联上下文。" })]), runButton]),
        el("div", { className: "release-operations-grid" }, [
          el("section", {}, [el("h3", { text: "产品内测试运行" }), runItems.length ? el("div", { className: "diagnostic-list" }, runItems) : el("p", { className: "empty-source", text: "尚无测试运行记录。" })]),
          el("section", {}, [el("h3", { text: "最近错误事件" }), errorItems.length ? el("div", { className: "diagnostic-list" }, errorItems) : el("p", { className: "empty-source", text: "当前项目暂无记录的 5xx 错误。" })])
        ])
      ]));
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(localTabs(context, "operations"), el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: "无法加载运维自检" }), el("p", { text: error.message }), el("button", { type: "button", className: "primary-button", text: "重新加载", onClick: load })]));
    } finally { root.setAttribute("aria-busy", "false"); }
  };
  void load();
}

export function renderMaterials(context) {
  void phaseThreeMaterialsBoundaryCopy;
  const root = el("div", { className: "materials-module", ariaBusy: "true" }, [el("section", { className: "module-skeleton skeleton-rows", ariaHidden: "true" }, [el("i"), el("i"), el("i")])]);
  if (context.generationTaskId) renderGenerationTaskDetail(context, root);
  else if (context.proposalId) renderProposalDetail(context, root);
  else if (context.materialId) renderMaterialDetail(context, root);
  else if (context.query.get("view") === "qa") renderQa(context, root);
  else if (context.query.get("view") === "proposals") renderProposalWorkspace(context, root);
  else if (context.query.get("view") === "release") renderReleaseCenter(context, root);
  else if (context.query.get("view") === "operations") renderOperationsCenter(context, root);
  else renderLedger(context, root);
  return root;
}
