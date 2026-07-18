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
  const grid = el("div", { className: "unit-grid" }, units.map(unit => el("article", { className: `unit-card${selected?.id === unit.id ? " selected" : ""}` }, [
    el("div", { className: "unit-card-top" }, [
      el("span", { className: "unit-mark", ariaHidden: "true", text: safeText(unit.short, unit.name.slice(0, 1)) }),
      el("span", { className: "count-pill", text: `${taskCounts.get(unit.id) ?? 0} ${context.presentation.task}` })
    ]),
    el("h3", { text: unit.name }),
    el("p", { className: "unit-owner", text: safeText(unit.owner, "负责人待确认") }),
    el("p", { text: safeText(unit.objective, "目标待补充") }),
    definitionList([["当前工作", unit.currentWork], ["预期产出", unit.expectedOutput], ["来源", unit.source]]),
    el("button", { type: "button", className: "secondary-button", text: `查看${context.presentation.unit}详情`, onClick: () => setQuery(context.navigate, { unit: unit.id }) })
  ])));
  return el("section", { className: "module-primary-card" }, [
    cardHeading("UNITS · FIXED REGISTRY", context.module.title, `${units.length} 个${context.presentation.unit}，全部来自当前发布版本。`),
    grid,
    selected ? el("aside", { className: "selection-detail", tabIndex: -1 }, [
      el("h3", { text: selected.name }),
      definitionList([["负责人", selected.owner], ["目标", selected.objective], ["当前工作", selected.currentWork], ["预期产出", selected.expectedOutput], ["来源", selected.source]]),
      el("div", { className: "detail-actions" }, [
        el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/task-network?unit=${encodeURIComponent(selected.id)}`, text: "查看任务网络" }),
        el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/gantt?unit=${encodeURIComponent(selected.id)}`, text: "查看甘特" })
      ])
    ]) : null
  ]);
}

function roadmapSvg(context, stages, closures) {
  const width = Math.max(760, stages.length * 180 + 80);
  const height = context.module.viewVariant === "campaign-network" ? 310 : 230;
  const svg = svgEl("svg", { class: "roadmap-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "roadmap-svg-title roadmap-svg-desc" });
  svg.append(svgEl("title", { id: "roadmap-svg-title" }, []), svgEl("desc", { id: "roadmap-svg-desc" }, []));
  svg.querySelector("title").textContent = `${context.module.title}可视化`;
  svg.querySelector("desc").textContent = `${stages.length} 个顺序阶段；完整文本见图后列表。`;
  if (stages.length > 1) {
    const points = stages.map((_, index) => `${70 + index * ((width - 140) / (stages.length - 1))},${context.module.viewVariant === "campaign-network" ? 135 + (index % 2 ? 30 : -15) : 115}`);
    svg.append(svgEl("polyline", { points: points.join(" "), class: "route-line", fill: "none" }));
  }
  stages.forEach((stage, index) => {
    const x = stages.length === 1 ? width / 2 : 70 + index * ((width - 140) / (stages.length - 1));
    const y = context.module.viewVariant === "campaign-network" ? 135 + (index % 2 ? 30 : -15) : 115;
    const group = svgEl("g", { class: `route-node ${stateClass(stage.state, stage.id === context.data.currentStageId)}`, tabindex: "0", role: "button", "aria-label": `${index + 1}. ${stage.title}，${statusText(stage.state)}，${safeText(stage.dateLabel, "日期待确认")}` });
    group.append(svgEl("circle", { cx: x, cy: y, r: 28 }), svgEl("circle", { cx: x, cy: y, r: 40, class: "route-hit" }));
    const number = svgEl("text", { x, y: y + 5, "text-anchor": "middle", class: "route-number" }); number.textContent = String(index + 1);
    const label = svgEl("text", { x, y: y + 62, "text-anchor": "middle", class: "route-label" }); label.textContent = stage.title;
    const date = svgEl("text", { x, y: y + 82, "text-anchor": "middle", class: "route-date" }); date.textContent = safeText(stage.dateLabel, "待确认");
    group.append(number, label, date);
    svg.append(group);
  });
  closures.forEach((closure, index) => {
    const referenced = closure.between.map(id => stages.findIndex(stage => stage.id === id)).filter(value => value >= 0);
    const stageIndex = referenced.length ? referenced.reduce((sum, value) => sum + value, 0) / referenced.length : index;
    const x = stages.length <= 1 ? width / 2 : 70 + stageIndex * ((width - 140) / (stages.length - 1));
    const marker = svgEl("g", { class: "closure-marker", tabindex: "0", role: "button", "aria-label": `${closure.title}，${statusText(closure.state)}`, "data-closure-id": closure.id });
    marker.append(svgEl("rect", { x: x - 10, y: 28, width: 20, height: 20, rx: 4 }), svgEl("rect", { x: x - 20, y: 18, width: 40, height: 40, class: "route-hit" }));
    svg.append(marker);
  });
  return svg;
}

export function renderRoadmap(context) {
  const stages = Array.isArray(context.data.stages) ? context.data.stages : [];
  const closures = Array.isArray(context.data.closures) ? context.data.closures : [];
  if (!stages.length) return emptyState(context.module.emptyState);
  const selectedId = context.query.get("closure");
  const selected = closures.find(item => item.id === selectedId) ?? closures[0];
  const visual = roadmapSvg(context, stages, closures);
  visual.addEventListener("click", event => {
    const id = event.target.closest?.("[data-closure-id]")?.dataset.closureId;
    if (id) setQuery(context.navigate, { closure: id });
  });
  visual.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const id = event.target.dataset.closureId;
    if (id) { event.preventDefault(); setQuery(context.navigate, { closure: id }); }
  });
  const ordered = el("ol", { className: "stage-alternative", ariaLabel: `${context.module.title}文本列表` }, stages.map((stage, index) => el("li", { className: stateClass(stage.state, stage.id === context.data.currentStageId) }, [
    el("span", { className: "stage-sequence", text: String(index + 1) }),
    el("div", {}, [el("h3", { text: stage.title }), el("p", { text: `${safeText(stage.dateLabel, "日期待确认")} · ${statusText(stage.state)}` }), el("p", { text: safeText(stage.description, "暂无阶段说明") })])
  ])));
  return el("div", {}, [
    el("section", { className: "module-primary-card" }, [
      cardHeading(context.module.viewVariant === "campaign-network" ? "CAMPAIGN ROUTE" : "LINEAR ROADMAP", context.module.title, "路线几何由当前发布数据计算；下方提供完整文本替代。"),
      localScroller(`${context.module.title}路线图，可水平滚动`, visual), ordered
    ]),
    selected ? el("section", { className: "selection-detail outcome-detail" }, [
      el("span", { className: "badge active", text: statusText(selected.state) }), el("h2", { text: selected.title }),
      definitionList([["日期", selected.dateLabel], ["说明", selected.description], ["结果", selected.result], ["来源", selected.source]])
    ]) : null,
    context.data.workstreams?.length ? el("section", { className: "workstream-grid" }, context.data.workstreams.map(stream => el("article", { className: "workstream-card" }, [
      el("span", { className: "eyebrow", text: context.presentation.workstream }), el("h3", { text: stream.title }), el("p", { text: safeText(stream.description) }), el("small", { text: `${stream.taskIds?.length ?? 0} 个关联${context.presentation.task}` })
    ]))) : null
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

export function renderMaterials(context) {
  return el("section", { className: "module-primary-card materials-contract" }, [
    el("div", { className: "materials-illustration", ariaHidden: "true" }, [el("i"), el("i"), el("i")]),
    el("span", { className: "eyebrow", text: "SECURE MATERIAL CONTRACT" }),
    el("h2", { text: "项目材料功能将在下一阶段开放" }),
    el("p", { text: "当前页面不会读取或上传材料。" }),
    context.data.summary?.count === 0 ? el("span", { className: "count-pill", text: "当前已登记 0 项" }) : null
  ]);
}
