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
  if (Number.isInteger(location.page)) return evidence.kind === "slide" ? `第 ${location.page} 张幻灯片` : `第 ${location.page} 页`;
  if (Number.isInteger(location.paragraph)) return `第 ${location.paragraph} 段${location.heading ? ` · ${location.heading}` : ""}`;
  if (location.sheet || location.range) return `${safeText(location.sheet, "工作表")} · ${safeText(location.table, "表 1")} · ${safeText(location.range, "范围待确认")}`;
  if (Number.isInteger(location.image)) return `图 ${location.image}${location.region ? ` · ${location.region}` : ""}`;
  if (Number.isInteger(evidence.ordinal)) return `第 ${evidence.ordinal + 1} 段`;
  return "未提供精确区域";
}

function localTabs(context, view) {
  const qaLabel = context.presentation.kind === "campaign" ? "战情问答" : "项目问答";
  const base = `/projects/${encodeURIComponent(context.project.id)}/modules/materials`;
  const tabs = [["ledger", "材料台账"], ["qa", qaLabel]].map(([value, label]) => el("a", {
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

function modalSheet({ title, eyebrow, project, returnFocus, className = "material-sheet", render }) {
  const backdrop = el("div", { className: "sheet-backdrop material-sheet-backdrop" });
  const panel = el("section", { className, role: "dialog", ariaModal: "true", ariaLabelledby: "material-sheet-title" });
  let committing = false;
  const close = () => { if (committing) return; backdrop.remove(); returnFocus?.focus?.(); };
  const closeButton = el("button", { type: "button", className: "dialog-close", ariaLabel: "关闭上传面板", text: "×", onClick: close });
  const body = el("div", { className: "material-sheet-body" });
  panel.append(el("header", { className: "sheet-header" }, [
    el("div", {}, [el("span", { className: "eyebrow", text: eyebrow }), el("h2", { id: "material-sheet-title", text: title }), el("p", { text: `${project.name} · ${project.id}` })]), closeButton
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
      el("p", { className: "material-boundary", text: "本阶段仅记录更新意图并形成证据；不会生成变更提案，也不会修改项目草稿或发布版本。" }), error,
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
      el("p", { className: "material-boundary", text: "本阶段仅记录更新意图并形成证据；不会生成变更提案，也不会修改项目草稿或发布版本。" }), queue, error,
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
    return el("tr", {}, [el("th", { scope: "row" }, [link, el("small", { text: item.extension || item.sourceKind || "待补充" })]), el("td", { text: item.updateTemplate?.label ?? "未选择更新模板" }), el("td", {}, [el("span", { className: `material-status status-${item.status}`, text: materialStatus[item.status] ?? item.status })]), el("td", {}, item.evidenceCount > 0 ? [el("a", { href: detailLink(item), text: `${item.evidenceCount} 个证据块`, onClick: event => { event.preventDefault(); context.navigate(detailLink(item)); } })] : [el("span", { text: "0 个证据块" })]), el("td", { text: item.qa?.enabled ? "已授权问答" : item.status === "ready" ? "未授权问答" : "不可用于问答" }), el("td", {}, [el("span", { text: safeText(item.uploadedBy) }), el("small", { text: uiDate(item.createdAt) })]), el("td", { text: bytes(item.size) }), el("td", {}, [el("div", { className: "row-actions" }, actions)])]);
  }));
  return el("div", { className: "table-scroll material-table-scroll", tabIndex: 0, role: "region", ariaLabel: "材料台账，可水平滚动" }, [el("table", { className: "module-table material-table" }, [el("caption", { text: "当前项目材料台账" }), el("thead", {}, [el("tr", {}, ["材料", "类型 / 模板", "处理状态", "证据块", "问答授权", "上传者 / 时间", "大小", "操作"].map(label => el("th", { scope: "col", text: label })))]), tbody])]);
}

function detailMetadata(material) {
  return definitionList([["材料类型", material.extension || material.sourceKind], ["处理状态", materialStatus[material.status] ?? material.status], ["更新模板", material.updateTemplate?.label ?? "未选择更新模板"], ["上传者 / 时间", `${safeText(material.uploadedBy)} · ${uiDate(material.createdAt)}`], ["原始大小", bytes(material.size)], ["SHA-256", safeText(material.sha256)], ["证据块", `${material.evidenceCount ?? 0} 个`], ["问答授权", material.qa?.enabled ? "已授权问答" : "未授权问答"]], "material-detail-meta");
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
      const preview = selected ? el("article", { className: "evidence-preview", ariaLive: "polite" }, [el("span", { className: "eyebrow", text: "EVIDENCE LOCATOR" }), el("h2", { text: locatorLabel(selected) }), el("p", { className: "evidence-id", text: `证据块 ${selected.id}` }), el("blockquote", { text: safeText(selected.summary, selected.text) }), el("details", {}, [el("summary", { text: "查看提取文本" }), el("pre", { text: safeText(selected.text) })]), el("p", { className: "locator-note", text: selected.location?.region || selected.location?.range ? "定位信息来自预处理结果" : "未提供精确区域" })]) : el("div", { className: "evidence-preview empty-preview", text: "选择证据位置后查看可追溯文本。" });
      const controls = [];
      if (caps.selectUpdateTemplate) {
        const template = templateSelect(catalog.updateTemplates, "detail-update-template"); template.value = material.updateTemplate?.id ?? "";
        controls.push(el("form", { className: "metadata-control", onSubmit: async event => { event.preventDefault(); await context.api(materialPath(context, `/${id}/update-template`), { method: "PATCH", mutation: true, body: { id: template.value, version: "1.0.0" } }); context.showToast("更新模板已记录"); await load(); } }, [el("label", { htmlFor: "detail-update-template", text: "材料用途" }), template, el("button", { type: "submit", className: "secondary-button", text: "保存材料用途" })]));
      }
      if (caps.manageQa) controls.push(el("button", { type: "button", className: "secondary-button", text: material.qa?.enabled ? "取消问答授权" : "授权用于问答", onClick: async () => { await context.api(materialPath(context, `/${id}/qa`), { method: "PATCH", mutation: true, body: { enabled: !material.qa?.enabled, audience: "project_members" } }); context.showToast(material.qa?.enabled ? "已取消问答授权" : "已授权用于问答"); await load(); } }));
      if (caps.retry && ["failed", "dependency_missing"].includes(material.status)) controls.push(el("button", { type: "button", className: "secondary-button", text: "重试处理", onClick: async () => { await context.api(materialPath(context, `/${id}/retry`), { method: "POST", mutation: true }); context.showToast("材料已进入重试队列"); await load(); } }));
      root.replaceChildren(el("a", { className: "back-link", href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`, text: "← 返回材料台账", onClick: event => { event.preventDefault(); context.navigate(event.currentTarget.getAttribute("href")); } }), el("section", { className: "materials-detail-card" }, [el("header", { className: "material-detail-heading" }, [el("div", {}, [el("span", { className: "eyebrow", text: "MATERIAL EVIDENCE" }), el("h1", { text: material.name })]), el("span", { className: `material-status status-${material.status}`, text: materialStatus[material.status] ?? material.status })]), detailMetadata(material), controls.length ? el("div", { className: "material-detail-controls" }, controls) : null, el("div", { className: "evidence-layout" }, [el("aside", { ariaLabel: "证据位置索引" }, [index]), select, preview]) ]));
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

export function renderMaterials(context) {
  void phaseThreeMaterialsBoundaryCopy;
  const root = el("div", { className: "materials-module", ariaBusy: "true" }, [el("section", { className: "module-skeleton skeleton-rows", ariaHidden: "true" }, [el("i"), el("i"), el("i")])]);
  if (context.materialId) renderMaterialDetail(context, root);
  else if (context.query.get("view") === "qa") renderQa(context, root);
  else renderLedger(context, root);
  return root;
}
