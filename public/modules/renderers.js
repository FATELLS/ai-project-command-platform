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

function taskInlineDetail(context, task, unitName = "") {
  if (!task) return null;
  // 解析数组字段，用于展示交付物/风险/决策/相关方。
  const deliverables = parseArrayField(task.deliverables);
  const taskRisks = parseArrayField(task.risks);
  const decisions = parseArrayField(task.decisions);
  const stakeholders = parseArrayField(task.stakeholders);
  const rows = [
    ["目标", task.objective],
    ["状态", task.state],
    ["健康度", task.health],
    ["负责人", task.owner],
    ["相关方", stakeholders.length ? stakeholders.map(s => typeof s === "string" ? s : s.name || JSON.stringify(s)).join("、") : ""],
    ["开始", task.startDate],
    ["结束", task.endDate],
    ["进度", Number.isFinite(task.progress) ? `${task.progress}%` : ""],
    ["验收标准", task.acceptanceCriteria],
    ["预期产出", task.expectedOutput]
  ];
  // 交付物列表
  if (deliverables.length) {
    rows.push(["交付物", deliverables.map(d => typeof d === "string" ? d : `${d.name || "—"}${d.state ? `(${d.state})` : ""}`).join("； ")]);
  }
  // 任务级风险
  if (taskRisks.length) {
    rows.push(["风险", taskRisks.map(r => typeof r === "string" ? r : `${r.title || "—"}${r.severity ? `[${r.severity}]` : ""}`).join("； ")]);
  }
  // 决策记录
  if (decisions.length) {
    rows.push(["决策", decisions.map(d => typeof d === "string" ? d : `${d.summary || d.decision || "—"}${d.date ? `(${d.date})` : ""}`).join("； ")]);
  }
  rows.push(["来源", task.source]);
  return el("article", { className: "inline-task-detail" }, [
    el("span", { className: "eyebrow", text: `${unitName ? `${unitName} · ` : ""}${context.presentation.task}` }),
    el("h4", { text: task.title }),
    definitionList(rows),
    el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/roadmap?view=network&task=${encodeURIComponent(task.id)}`, text: "在依赖网络中查看" })
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
    el("header", {}, [el("span", { className: "eyebrow", text: "路线详情" }), el("h4", { text: `${unit.name}路线与节点` })]),
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
      el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/roadmap?view=network&unit=${encodeURIComponent(unit.id)}`, text: "查看依赖网络" }),
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
    stages: presentation.stage
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
    (() => {
      const isEmpty = (facts.get("tasks") ?? 0) === 0;
      if (!isEmpty) return null;
      const canEdit = ["platform_admin", "project_admin", "project_editor"].includes(context.project.role);
      const matPath = `/projects/${encodeURIComponent(project.id)}/modules/materials`;
      return el("section", { className: "quick-start-card" }, [
        el("div", { className: "quick-start-icon", ariaHidden: "true" }, [el("b", { text: "1" })]),
        el("div", { className: "quick-start-body" }, [
          el("h2", { text: "开始使用项目" }),
          el("p", { text: canEdit
            ? "上传会议纪要、项目计划或其他文档，系统会自动提取内容，生成任务和路线建议。"
            : "等待项目管理员上传材料并配置项目内容。" }),
          canEdit ? el("a", { href: `${matPath}?view=ledger`, className: "primary-button quick-start-cta", text: "上传项目材料", onClick: event => { event.preventDefault(); context.navigate(`${matPath}?view=ledger`); } }) : null
        ])
      ]);
    })(),
    el("section", { className: "fact-grid", ariaLabel: "项目事实计数" }, ["units", "tasks", "stages"].map(id =>
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

export function renderRoadmap(context) {
  // 项目路线图是主视图；旧 board/timeline 深链与未知 view 均回落到路线图。
  const requestedView = context.query.get("view");
  const activeView = ["units", "network"].includes(requestedView) ? requestedView : "swimlane";
  if (activeView === "units") return renderRoadmapUnits(context);
  if (activeView === "network") return renderRoadmapNetwork(context);
  return renderRoadmapSwimlane(context);
}

// 路线图主视图 + 两个辅助投影。view 与 stage/unit/task 深链正交。
function roadmapViewSwitcher(context) {
  const requestedView = context.query.get("view");
  const current = ["units", "network"].includes(requestedView) ? requestedView : "swimlane";
  const views = [["swimlane", "项目路线图"], ["units", `${context.presentation.unit}进度`], ["network", "依赖网络"]];
  return el("nav", { className: "roadmap-view-switcher", ariaLabel: "路线图视图" }, views.map(([value, label]) => {
    const params = new URLSearchParams(context.query.toString());
    if (value === "swimlane") params.delete("view"); else params.set("view", value);
    const href = `?${params.toString()}`;
    return el("a", { href, className: current === value ? "active" : "", ariaCurrent: current === value ? "page" : null, text: label, onClick: event => { event.preventDefault(); context.navigate(href); } });
  }));
}

// 阶段卡片板：按任务状态泳道排列，卡片可拖拽；拖拽只发起受控提案，不直写 draft/published
// 健康度标记：on-track 绿 / at-risk 橙 / off-track 红。无值默认不显示。
function healthDot(health) {
  const h = String(health ?? "").toLowerCase();
  if (!h || h === "unknown") return null;
  const color = h === "on-track" ? "green" : h === "at-risk" ? "orange" : h === "off-track" ? "red" : null;
  if (!color) return null;
  return el("span", { className: `health-dot health-${color}`, title: health, ariaLabel: `健康度：${health}` });
}

// 解析 JSON 数组字段（deliverables/risks/decisions/stakeholders），容忍字符串或 null。
function parseArrayField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) { try { const p = JSON.parse(value); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

// 作战单元进度视图：以单元为入口，展示覆盖阶段、任务、完成度
function renderRoadmapUnits(context) {
  const units = context.data.units ?? [];
  const tasks = Array.isArray(context.data.tasks) ? context.data.tasks : [];
  const stages = context.data.stages ?? [];
  const selectedUnitId = context.query.get("unit");
  const unitsWithTasks = units.map(unit => {
    const unitTasks = tasks.filter(task => task.unitId === unit.id);
    const done = unitTasks.filter(task => String(task.state ?? "").toLowerCase()).length;
    const progress = unitTasks.length ? Math.round((unitTasks.filter(t => Number(t.progress) >= 100 || ["done", "completed", "完成", "已完成"].includes(String(t.state ?? "").toLowerCase())).length / unitTasks.length) * 100) : null;
    return { ...unit, taskCount: unitTasks.length, progress, tasks: unitTasks };
  });
  const cards = unitsWithTasks.map(unit => {
    const isSelected = unit.id === selectedUnitId;
    const selectUnit = () => setQuery(context.navigate, { unit: unit.id, task: "" });
    return el("article", { className: `unit-progress-card${isSelected ? " selected" : ""}`, dataset: { unitId: unit.id }, tabIndex: 0, role: "button", ariaLabel: `${unit.name}，${unit.taskCount}${context.presentation.task}${unit.progress != null ? `，完成度 ${unit.progress}%` : ""}`, onClick: selectUnit, onKeyDown: event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectUnit(); } } }, [
      el("header", {}, [el("h3", { text: unit.name }), unit.status && unit.status !== "active" ? el("span", { className: `badge archived`, text: unit.status }) : null]),
      definitionList([["目标", unit.objective], ["负责人", unit.owner], [context.presentation.task, String(unit.taskCount)]]),
      unit.progress != null ? el("div", { className: "unit-progress-bar" }, [el("div", { className: "unit-progress-fill", style: `width:${unit.progress}%` }), el("span", { text: `${unit.progress}%` })]) : null,
      isSelected && unit.tasks.length ? el("ul", { className: "unit-task-list" }, unit.tasks.map(task => el("li", { className: `unit-task${task.id === context.query.get("task") ? " selected" : ""}`, onClick: () => setQuery(context.navigate, { unit: unit.id, task: task.id }) }, [el("strong", { text: task.title }), el("small", { text: statusText(task.state) })]))) : null
    ]);
  });
  return el("div", {}, [
    el("section", { className: "module-primary-card roadmap-workbench roadmap-units" }, [
      roadmapViewSwitcher(context),
      cardHeading(`${context.presentation.unit.toUpperCase()} PROGRESS`, context.module.title, `以${context.presentation.unit}为入口，查看覆盖${context.presentation.stage}、${context.presentation.task}与完成度。`),
      cards.length ? el("div", { className: "unit-progress-grid" }, cards) : emptyState(context.module.emptyState)
    ])
  ]);
}

// 依赖网络视图：复用 task-network 数据，作为跨单元跨阶段阻塞关系入口
function renderRoadmapNetwork(context) {
  const tasks = Array.isArray(context.data.tasks) ? context.data.tasks : [];
  const edges = context.data.edges ?? [];
  const units = context.data.units ?? [];
  const selectedTaskId = context.query.get("task");
  const selectedUnit = context.query.get("unit");
  const visible = selectedUnit ? tasks.filter(t => t.unitId === selectedUnit) : tasks;
  const unitSelector = el("select", { ariaLabel: `筛选${context.presentation.unit}` }, [el("option", { value: "", text: `全部${context.presentation.unit}` }), ...units.map(unit => el("option", { value: unit.id, text: unit.name }))]);
  unitSelector.value = selectedUnit;
  unitSelector.addEventListener("change", () => setQuery(context.navigate, { unit: unitSelector.value, task: "" }));
  return el("div", {}, [
    el("section", { className: "module-primary-card roadmap-workbench roadmap-network" }, [
      roadmapViewSwitcher(context),
      cardHeading("DEPENDENCY NETWORK", context.module.title, `跨${context.presentation.unit}、跨${context.presentation.stage}的阻塞关系；点击${context.presentation.task}查看前置与后续。`),
      el("div", { className: "visual-controls" }, [unitSelector]),
      dependencyList(context, visible, selectedTaskId)
    ])
  ]);
}

// 项目泳道（分形生命周期 + 主/副泳道 + 双锚点）：纯渲染投影，不写 draft/published，不调用 LLM。
// 主泳道 = 阶段主脊按真实日期时间轴；副泳道 = 每作战单元一条类甘特条；阶段起点=项目锚点（主→副拆解），
// 战果闭环=收口锚点（副→主合并）；生命周期三带（事前/事中/事后）派生自 stage.state；并行子任务按区间着色。
function lifecycleBandOf(state) {
  if (/完成|closed|done|mitigated/i.test(String(state ?? ""))) return "converged";
  if (/当前|active|current|进行/i.test(String(state ?? ""))) return "active";
  return "prepare";
}
// LIF-05：单元级分形生命周期——从 unit 自己的任务派生同一事前/事中/事后范式，无新数据字段。
function unitLifecycleBandOf(unitTasks) {
  if (!unitTasks.length) return "prepare";
  const isDone = task => Number(task.progress) >= 100 || /done|completed|完成|已完成|mitigated/i.test(String(task.state ?? ""));
  if (unitTasks.every(isDone)) return "converged";
  const isActive = task => Number.isFinite(task.progress) || /进行|in-progress|active|current|当前/i.test(String(task.state ?? ""));
  const hasScheduled = unitTasks.some(task => task.startDate || task.endDate);
  return unitTasks.some(isActive) || hasScheduled ? "active" : "prepare";
}
// 生命周期三带术语来自项目模板（context.presentation.lifecyclePrepare/Active/Converged），默认回退见 renderRoadmapSwimlane。

function isoFromDay(dayNumber) {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

function renderRoadmapSwimlaneLegacy(context) {
  const stages = Array.isArray(context.data.stages) ? context.data.stages : [];
  const units = Array.isArray(context.data.units) ? context.data.units : [];
  const tasks = Array.isArray(context.data.tasks) ? context.data.tasks : [];
  const closures = Array.isArray(context.data.closures) ? context.data.closures : [];
  if (!stages.length) return emptyState(context.module.emptyState);
  const stageTerm = context.presentation.stage;
  const unitTerm = context.presentation.unit;
  // LIF-01：生命周期三带术语随模板配置（作战语言 vs 通用项目管理语言），默认回退保证渲染器独立可用
  const bandLabels = {
    prepare: context.presentation.lifecyclePrepare || "事前 · 待启",
    active: context.presentation.lifecycleActive || "事中 · 当前",
    converged: context.presentation.lifecycleConverged || "事后 · 已交付"
  };
  const selectedStage = context.query.get("stage");
  const selectedUnit = context.query.get("unit");
  const selectedTask = context.query.get("task");
  const selectedAnchor = context.query.get("anchor");
  const spineMode = context.query.get("spine") === "1";
  // 主泳道「打开的卡片」：默认打开当前战役阶段，便于首屏即见涉及的副泳道任务；spine=1 表示用户显式收起回主脊。
  const openStageId = spineMode ? null : (selectedStage || context.data.currentStageId || null);

  const dated = tasks.filter(task => task.startDate && task.endDate);
  const origin = dated.length ? Math.min(...dated.map(task => dayNumber(task.startDate))) : null;
  const horizon = dated.length ? Math.max(...dated.map(task => dayNumber(task.endDate))) : null;
  const span = origin == null ? 1 : Math.max(1, horizon - origin + 1);
  const at = value => value && origin != null ? ((dayNumber(value) - origin) / span) * 100 : null;
  const hasTimeline = origin != null;

  const phaseStages = stages.map(stage => ({ ...stage, window: parseStageWindow(stage.dateLabel), band: lifecycleBandOf(stage.state) }));
  const stagePos = new Map();
  for (const stage of phaseStages) stagePos.set(stage.id, at(stage.window.start || stage.window.end || ""));

  function phaseOf(task) {
    const start = task.startDate;
    if (start) {
      const hit = phaseStages.find(stage => stage.window.start && stage.window.end && start >= stage.window.start && start <= stage.window.end);
      if (hit) return hit.id;
    }
    const overlap = phaseStages.find(stage => overlapsWindow({ startDate: task.startDate || task.endDate, endDate: task.endDate || task.startDate }, stage.window));
    return overlap?.id ?? null;
  }

  const subLanes = units.map(unit => {
    const list = tasks.filter(task => task.unitId === unit.id)
      .sort((a, b) => safeText(a.startDate, "9999").localeCompare(safeText(b.startDate, "9999")) || safeText(a.title).localeCompare(safeText(b.title), "zh-CN"));
    const tracks = [];
    const positioned = list.map(task => {
      const left = at(task.startDate);
      const width = left != null && task.endDate ? Math.max(1.5, ((dayNumber(task.endDate) - dayNumber(task.startDate) + 1) / span) * 100) : null;
      let track = 0;
      if (left != null && task.endDate) {
        const start = dayNumber(task.startDate), end = dayNumber(task.endDate);
        const free = tracks.findIndex(endDay => endDay < start);
        track = free === -1 ? tracks.length : free;
        tracks[track] = end;
      }
      return { task, left, width, track, phaseId: phaseOf(task) };
    });
    return { unit, positioned, trackCount: Math.max(1, tracks.length) };
  });
 const unscheduled = tasks.filter(task => !task.startDate || !task.endDate);

  // Phase 9：同单元 parentId 真实拆解链。选中任务时高亮其拆解链（父链 + 子链），
  // 带 parentId 的子任务条标记 has-parent；方向 A：仅同单元内 parentId。
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const childrenOf = new Map();
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childrenOf.get(task.parentId) ?? [];
      siblings.push(task.id);
      childrenOf.set(task.parentId, siblings);
    }
  }
  function decompositionChain(taskId) {
    if (!taskId) return new Set();
    const chain = new Set([taskId]);
    for (let cur = taskById.get(taskId)?.parentId; cur; cur = taskById.get(cur)?.parentId) chain.add(cur);
    const stack = [...(childrenOf.get(taskId) ?? [])];
    while (stack.length) { const id = stack.pop(); chain.add(id); stack.push(...(childrenOf.get(id) ?? [])); }
    return chain;
  }
  const activeChain = selectedTask ? decompositionChain(selectedTask) : null;

  const guideStages = phaseStages.filter(stage => stagePos.get(stage.id) != null);
  const anchorItems = closures.filter(closure => Array.isArray(closure.between) && closure.between.length).map(closure => {
    // LIF-04：收口锚点支持多源合并——位置取所有 between 阶段的中点均值（多对多收口）
    const positions = closure.between.map(id => stagePos.get(id)).filter(pos => pos != null);
    const pos = positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : at(parseStageWindow(closure.dateLabel).start);
    return { closure, pos };
  }).filter(item => item.pos != null);

  const selectStage = id => setQuery(context.navigate, { stage: id, unit: "", task: "", anchor: "" });
  const selectUnit = id => setQuery(context.navigate, { unit: id, task: "" });
  const selectTask = id => setQuery(context.navigate, { task: id });
  const selectAnchor = id => setQuery(context.navigate, { anchor: id, task: "" });
  const openStage = id => setQuery(context.navigate, { stage: id, unit: "", task: "", anchor: "", spine: "" });
  // 点击主脊阶段卡片为手风琴：再点当前已打开的阶段 → 收起回主脊（显式 spine=1）。
  const toggleStage = id => openStageId === id
    ? setQuery(context.navigate, { stage: "", unit: "", task: "", anchor: "", spine: "1" })
    : openStage(id);
  const closeOverlay = () => setQuery(context.navigate, { task: "" });
  // 反应式副泳道：只有「涉及当前打开主卡片」的作战单元才显示其任务条（有涉及才展示）。
  const involvedUnitIds = new Set();
  if (openStageId) for (const task of tasks) if (phaseOf(task) === openStageId && task.unitId) involvedUnitIds.add(task.unitId);

  function guideSpans() {
    return guideStages.map(stage => el("span", { className: `guide-line${stage.id === selectedStage ? " active" : ""}`, style: `left:${stagePos.get(stage.id)}%`, dataset: { guideStage: stage.id } }));
  }

  const STATION_LANE_PX = 50, ANCHOR_LANE_PX = 28;
  function laneSchedule(items, gapPct) {
    const laneMax = [];
    const laneOf = new Map();
    for (const { id, pos } of [...items].sort((a, b) => (a.pos ?? Infinity) - (b.pos ?? Infinity))) {
      if (pos == null) { laneOf.set(id, 0); continue; }
      let lane = laneMax.findIndex(max => max == null || pos - max >= gapPct);
      if (lane === -1) lane = laneMax.length;
      laneMax[lane] = pos;
      laneOf.set(id, lane);
    }
    return { laneOf, laneCount: Math.max(1, laneMax.length) };
  }
  const stationPlan = laneSchedule(phaseStages.map(stage => ({ id: stage.id, pos: stagePos.get(stage.id) })), 15);
  const anchorPlan = laneSchedule(anchorItems.map(item => ({ id: item.closure.id, pos: item.pos })), 10);
  const anchorBandTop = 14 + stationPlan.laneCount * STATION_LANE_PX;

  const phaseNodes = phaseStages.map(stage => {
    const pos = stagePos.get(stage.id);
    const isSelected = stage.id === selectedStage;
    const lane = stationPlan.laneOf.get(stage.id) ?? 0;
    return el("button", {
       type: "button", className: `phase-station band-${stage.band}${isSelected ? " selected" : ""}${stage.id === openStageId ? " open" : ""}${stage.id === context.data.currentStageId ? " current" : ""}`,
      style: [pos != null ? `left:${pos}%` : null, `top:${12 + lane * STATION_LANE_PX}px`].filter(Boolean).join(";"), dataset: { stageId: stage.id },
      ariaLabel: `${stage.title}，${bandLabels[stage.band]}${stage.state ? "，" + stage.state : ""}`,
      ariaExpanded: stage.id === openStageId ? "true" : "false",
      title: `${stage.title} · ${bandLabels[stage.band]}`, onClick: () => toggleStage(stage.id)
    }, [
      el("span", { className: "phase-anchor-mark", ariaHidden: "true", text: "▾", title: "项目锚点·拆解" }),
      el("span", { className: "phase-station-title", text: stage.title }),
      el("span", { className: "phase-station-meta", text: bandLabels[stage.band] })
    ]);
  });
  const anchorNodes = anchorItems.map(({ closure, pos }) => el("button", {
    type: "button", className: `closure-anchor${closure.id === selectedAnchor ? " selected" : ""}`,
    style: `left:${pos}%;top:${anchorBandTop + (anchorPlan.laneOf.get(closure.id) ?? 0) * ANCHOR_LANE_PX}px`, dataset: { anchor: closure.id }, title: `${closure.title} · 收口锚点`,
    ariaLabel: `${closure.title}，收口锚点`, onClick: () => selectAnchor(closure.id)
  }, [el("span", { ariaHidden: "true", text: "◆" }), el("span", { className: "closure-anchor-label", text: closure.title })]));

  const mainTrackStyle = hasTimeline ? `min-height:${24 + stationPlan.laneCount * STATION_LANE_PX + anchorPlan.laneCount * ANCHOR_LANE_PX + 14}px` : null;
  const mainTrack = el("div", { className: "swimlane-main-track", style: mainTrackStyle }, [...guideSpans(), ...phaseNodes, ...anchorNodes]);

 const subRows = subLanes.map(({ unit, positioned, trackCount }) => {
   const unitBand = unitLifecycleBandOf(tasks.filter(task => task.unitId === unit.id));
   // 反应式：平时副泳道连卡片都不展现；仅当主泳道打开某阶段且该单元涉及该阶段时，才渲染其任务条（有涉及才展示）。
   const isInvolved = Boolean(openStageId) && involvedUnitIds.has(unit.id);
   const bars = (isInvolved ? positioned : []).map(({ task, left, width, track, phaseId }) => {
    if (left == null) return null;
     const inChain = activeChain ? activeChain.has(task.id) : false;
     const dimmed = activeChain ? !inChain : (openStageId && phaseId !== openStageId);
     const hasParent = Boolean(task.parentId);
     // PMBOK 摘要元素——P0 health 色点、P1 交付物/风险计数徽标
     const barDeliverables = parseArrayField(task.deliverables).length;
     const barRisks = parseArrayField(task.risks).length;
     const barHasPmbok = Boolean(healthDot(task.health)) || barDeliverables > 0 || barRisks > 0;
     const barChildren = [
       hasParent ? el("span", { className: "swimlane-bar-decomp", ariaHidden: "true", text: "⇢", title: `拆解自 ${taskById.get(task.parentId)?.title ?? task.parentId}` }) : null,
       healthDot(task.health),
       el("span", { className: "swimlane-bar-title", text: task.title }),
       Number.isFinite(task.progress) ? el("span", { className: "swimlane-bar-progress", text: `${task.progress}%` }) : null,
       barHasPmbok ? el("span", { className: "swimlane-bar-badges" }, [
         barDeliverables ? el("span", { className: "bar-badge bar-badge-deliverable", title: `${barDeliverables} 个交付物`, text: `📦${barDeliverables}` }) : null,
         barRisks ? el("span", { className: "bar-badge bar-badge-risk", title: `${barRisks} 个风险`, text: `⚠${barRisks}` }) : null
       ].filter(Boolean)) : null
     ].filter(Boolean);
     return el("button", {
       type: "button", className: `swimlane-bar${task.id === selectedTask ? " selected" : ""}${dimmed ? " dimmed" : ""}${hasParent ? " has-parent" : ""}${inChain && !dimmed ? " chain" : ""}${barHasPmbok ? " has-pmbok" : ""}`,
       style: `left:${left}%;width:${width}%;--track:${track}`, dataset: { taskId: task.id, phaseId: phaseId ?? "", parent: task.parentId || "" },
       ariaLabel: `${task.title}，${unit.name}，${safeText(task.owner, "待确认")}，${formatDay(task.startDate)} 至 ${formatDay(task.endDate)}，${statusText(task.state)}${hasParent ? `，拆解自 ${taskById.get(task.parentId)?.title ?? task.parentId}` : ""}${barDeliverables ? `，${barDeliverables} 个交付物` : ""}${barRisks ? `，${barRisks} 个风险` : ""}`,
       title: `${task.title} · ${formatDay(task.startDate)}→${formatDay(task.endDate)}${task.health ? ` · ${task.health}` : ""}`, onClick: () => selectTask(task.id)
     }, barChildren);
   }).filter(Boolean);
   return el("div", { className: `swimlane-row${unit.id === selectedUnit ? " selected" : ""}${isInvolved ? "" : " dormant"}`, dataset: { unitId: unit.id } }, [
     el("button", { type: "button", className: `swimlane-rail unit-band-${unitBand}`, title: `${unit.name} · ${bandLabels[unitBand]}`, onClick: () => selectUnit(unit.id) }, [el("span", { className: "unit-band-mark", ariaHidden: "true" }), el("span", { className: "unit-band-name", text: unit.name }), el("span", { className: "unit-band-label", text: bandLabels[unitBand] })]),
     el("div", { className: "swimlane-unit-track", style: `--tracks:${trackCount}`, role: "list" }, [...guideSpans(), ...(bars.length ? bars : [el("span", { className: "swimlane-empty", text: isInvolved ? "本阶段无排期任务" : "未涉及当前阶段·待主泳道展开" })])])
   ]);
 });

  const legend = el("ul", { className: "swimlane-legend", ariaLabel: "图例" }, [
    el("li", { className: "band-prepare" }, [el("i", { className: "dot" }), bandLabels.prepare]),
    el("li", { className: "band-active" }, [el("i", { className: "dot" }), bandLabels.active]),
    el("li", { className: "band-converged" }, [el("i", { className: "dot" }), bandLabels.converged]),
    el("li", {}, [el("span", { className: "anchor-glyph", text: "▾", ariaHidden: "true" }), "拆解锚点"]),
    el("li", {}, [el("span", { className: "anchor-glyph", text: "◆", ariaHidden: "true" }), "收口锚点"]),
    el("li", {}, [el("span", { className: "anchor-glyph decomp-glyph", text: "⇢", ariaHidden: "true" }), "同单元拆解链"])
  ]);
  const chart = el("div", { className: "swimlane-chart", dataset: { timeline: hasTimeline ? "1" : "0" } }, [
    el("div", { className: "swimlane-main", role: "row", ariaLabel: "主泳道" }, [el("span", { className: "swimlane-rail swimlane-rail-main", text: "主泳道" }), mainTrack]),
    el("div", { className: "swimlane-sub", role: "rowgroup", ariaLabel: `${unitTerm}副泳道` }, subRows.length ? subRows : el("p", { className: "swimlane-empty", text: `暂无${unitTerm}副泳道数据。` })),
    hasTimeline ? el("div", { className: "swimlane-axis", ariaHidden: "true" }, [el("span", { text: formatDay(isoFromDay(origin)) }), el("span", { text: formatDay(isoFromDay(horizon)) })]) : null
 ]);

 // 主泳道展开卡片：打开某阶段时展示该阶段主卡片（说明/产出/涉及单元 + PMBOK 聚合），点击收起回主脊。
  const openStageObj = phaseStages.find(stage => stage.id === openStageId) ?? null;
  const involvedUnits = openStageObj ? units.filter(unit => involvedUnitIds.has(unit.id)) : [];
  const involvedTasks = openStageObj ? tasks.filter(task => phaseOf(task) === openStageObj.id) : [];
  const openStageProgress = involvedTasks.length ? Math.round(involvedTasks.filter(task => Number(task.progress) >= 100 || ["done", "completed", "完成", "已完成"].includes(String(task.state ?? "").toLowerCase())).length / involvedTasks.length * 100) : null;
  // PMBOK 聚合：该阶段下所有任务的健康度分布 + 交付物/风险/决策总数
  const stageHealthCounts = { "on-track": 0, "at-risk": 0, "off-track": 0 };
  let stageDeliverables = 0, stageRisks = 0, stageDecisions = 0;
  for (const t of involvedTasks) {
    const h = String(t.health ?? "").toLowerCase();
    if (stageHealthCounts[h] != null) stageHealthCounts[h]++;
    stageDeliverables += parseArrayField(t.deliverables).length;
    stageRisks += parseArrayField(t.risks).length;
    stageDecisions += parseArrayField(t.decisions).length;
  }
  const stageHasAggregation = stageDeliverables > 0 || stageRisks > 0 || stageDecisions > 0 || stageHealthCounts["on-track"] + stageHealthCounts["at-risk"] + stageHealthCounts["off-track"] > 0;
  const mainCard = openStageObj ? el("article", { className: `swimlane-main-card band-${openStageObj.band}` }, [
     el("div", { className: "swimlane-main-card-head" }, [
       el("div", {}, [
         el("span", { className: "eyebrow", text: `主泳道 · 阶段卡片 · ${bandLabels[openStageObj.band]}` }),
         el("h3", { text: openStageObj.title }),
         definitionList([["日期", openStageObj.dateLabel], ["状态", openStageObj.state], ["预期产出", openStageObj.expectedOutput], ["说明", openStageObj.description]])
       ]),
       el("button", { type: "button", className: "secondary-button", onClick: () => toggleStage(openStageObj.id), ariaLabel: "收起阶段卡片，回到主脊", text: "收起 · 回主脊" })
     ]),
     el("div", { className: "swimlane-main-card-body" }, [
       el("p", { className: "module-summary-strip", text: involvedTasks.length ? `涉及 ${involvedUnits.length} 个${unitTerm} · ${involvedTasks.length} 个${context.presentation.task}${openStageProgress != null ? ` · 整体 ${openStageProgress}%` : ""}` : `本${stageTerm}暂无归入${unitTerm}任务` }),
       involvedUnits.length ? el("ul", { className: "swimlane-involved-units" }, involvedUnits.map(unit => el("li", { className: "swimlane-involved-unit" }, [el("span", { className: "unit-band-mark", ariaHidden: "true" }), el("span", { text: unit.name })]))) : null,
       // PMBOK 聚合区：健康度分布色点 + 交付物/风险/决策总计徽标
       stageHasAggregation ? el("div", { className: "stage-pmbok-aggregation" }, [
         el("span", { className: "aggregation-label", text: "PMBOK 元素聚合" }),
         el("div", { className: "aggregation-items" }, [
           stageHealthCounts["on-track"] + stageHealthCounts["at-risk"] + stageHealthCounts["off-track"] > 0
             ? el("span", { className: "aggregation-health" }, [
                 stageHealthCounts["on-track"] ? el("span", { className: "health-dot health-green", title: `${stageHealthCounts["on-track"]} 个 on-track`, text: "" }) : null,
                 stageHealthCounts["at-risk"] ? el("span", { className: "health-dot health-orange", title: `${stageHealthCounts["at-risk"]} 个 at-risk`, text: "" }) : null,
                 stageHealthCounts["off-track"] ? el("span", { className: "health-dot health-red", title: `${stageHealthCounts["off-track"]} 个 off-track`, text: "" }) : null,
                 el("span", { className: "aggregation-count", text: `${stageHealthCounts["on-track"]}/${stageHealthCounts["at-risk"]}/${stageHealthCounts["off-track"]}` })
               ].filter(Boolean))
             : null,
           stageDeliverables ? el("span", { className: "card-badge badge-deliverable", title: `${stageDeliverables} 个交付物`, text: `📦 ${stageDeliverables}` }) : null,
           stageRisks ? el("span", { className: "card-badge badge-risk", title: `${stageRisks} 个风险`, text: `⚠ ${stageRisks}` }) : null,
           stageDecisions ? el("span", { className: "card-badge badge-decision", title: `${stageDecisions} 个决策`, text: `✓ ${stageDecisions}` }) : null
         ].filter(Boolean))
       ]) : null
     ])
  ]) : el("p", { className: "swimlane-spine-hint", text: `主脊已收起：点击上方${stageTerm}即可展开该阶段涉及的${unitTerm}任务（有涉及才展示）。` });
  // 副泳道卡片浮层：点作战单元任务条 → 浮在泳道最上层，可单独打开该单元页面或关闭。
  let unitOverlay = null;
  if (selectedTask) {
    const task = tasks.find(item => item.id === selectedTask) ?? null;
    const unit = units.find(item => item.id === task?.unitId) ?? null;
    if (task) unitOverlay = el("div", { className: "swimlane-overlay", role: "dialog", ariaModal: "true", ariaLabel: `${unit?.name ?? ""}${context.presentation.task}详情` }, [
      el("button", { type: "button", className: "swimlane-overlay-backdrop", ariaLabel: "关闭", onClick: closeOverlay }),
      el("article", { className: "swimlane-overlay-panel" }, [
        el("header", {}, [
          el("div", {}, [el("span", { className: "eyebrow", text: `${unit?.name ?? unitTerm} · 副泳道卡片` }), el("h3", { text: task.title })]),
          el("button", { type: "button", className: "icon-button", ariaLabel: "关闭浮层", text: "✕", onClick: closeOverlay })
        ]),
        taskInlineDetail(context, task, unit?.name ?? ""),
        el("div", { className: "swimlane-overlay-actions" }, [
          el("a", { className: "primary-button", href: `/projects/${encodeURIComponent(context.project.id)}/modules/units?unit=${encodeURIComponent(task.unitId ?? "")}`, text: `单独打开${unitTerm}页面` }),
          el("button", { type: "button", className: "secondary-button", onClick: closeOverlay, text: "关闭" })
        ])
      ])
    ]);
  }
  // 非任务的就地详情（收口锚点 / 作战单元整条路线）放在泳道下方。
  let detail = null;
  if (selectedUnit && !selectedTask) {
    const unit = units.find(item => item.id === selectedUnit);
    detail = unit ? unitRouteDetail(context, unit) : null;
  } else if (selectedAnchor && !selectedTask) {
    const closure = closures.find(item => item.id === selectedAnchor);
    detail = closure ? el("article", { className: "inline-task-detail" }, [
      el("span", { className: "eyebrow", text: "收口锚点 · 战果闭环" }), el("h4", { text: closure.title }),
      definitionList([["状态", closure.state], ["日期", closure.dateLabel], ["关联阶段", (closure.between ?? []).join(" → ")], ["结果", closure.result], ["说明", closure.description], ["来源", closure.source]])
    ]) : null;
  }

  const unscheduledSection = unscheduled.length ? el("section", { className: "unscheduled-lane" }, [
    el("h3", { text: "待排期任务" }),
    el("ul", {}, unscheduled.map(task => el("li", {}, [
      el("button", { type: "button", className: "linkish", onClick: () => selectTask(task.id) }, [el("span", { text: task.title })])
    ])))
  ]) : null;

 return el("div", {}, [
   el("section", { className: "module-primary-card roadmap-workbench roadmap-swimlane" }, [
     roadmapViewSwitcher(context),
     cardHeading("PROJECT SWIMLANE", context.module.title, `主脊按${stageTerm}排列：点击阶段展开主卡片，涉及的${unitTerm}才在副泳道显示任务（有涉及才展示）；再点${unitTerm}任务条浮层可单独打开。`),
     mainCard,
     legend,
     localScroller("项目泳道图，可水平滚动", chart),
     unscheduledSection,
     detail
   ]),
   unitOverlay
 ]);
}

function renderRoadmapSwimlane(context) {
  const stages = Array.isArray(context.data.stages) ? context.data.stages : [];
  const units = Array.isArray(context.data.units) ? context.data.units : [];
  const tasks = Array.isArray(context.data.tasks) ? context.data.tasks : [];
  const closures = Array.isArray(context.data.closures) ? context.data.closures : [];
  if (!stages.length) return emptyState(context.module.emptyState);

  const stageTerm = context.presentation.stage;
  const unitTerm = context.presentation.unit;
  const taskTerm = context.presentation.task;
  const bandLabels = {
    prepare: context.presentation.lifecyclePrepare || "事前 · 待启",
    active: context.presentation.lifecycleActive || "事中 · 当前",
    converged: context.presentation.lifecycleConverged || "事后 · 已交付"
  };
  const phaseStages = stages.map(stage => ({
    ...stage,
    window: parseStageWindow(stage.dateLabel),
    band: lifecycleBandOf(stage.state)
  }));
  const stageById = new Map(phaseStages.map(stage => [stage.id, stage]));
  const stageIndex = new Map(phaseStages.map((stage, index) => [stage.id, index]));
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  const requestedStageId = context.query.get("stage");
  const selectedUnitId = context.query.get("unit");
  const selectedTaskId = context.query.get("task");
  const selectedAnchorId = context.query.get("anchor");
  const selectedTask = taskById.get(selectedTaskId) ?? null;

  function phaseOf(task) {
    const start = task?.startDate;
    if (start) {
      const stage = phaseStages.find(item => item.window.start && item.window.end && start >= item.window.start && start <= item.window.end);
      if (stage) return stage.id;
    }
    return phaseStages.find(item => overlapsWindow({
      startDate: task?.startDate || task?.endDate,
      endDate: task?.endDate || task?.startDate
    }, item.window))?.id ?? null;
  }

  const selectedTaskStageId = selectedTask ? phaseOf(selectedTask) : null;
  const openStageId = stageById.has(requestedStageId)
    ? requestedStageId
    : selectedTaskStageId;
  const openStage = stageById.get(openStageId) ?? null;
  const stageTasks = openStage
    ? tasks.filter(task => phaseOf(task) === openStage.id)
      .sort((left, right) => safeText(left.startDate, "9999").localeCompare(safeText(right.startDate, "9999")) || safeText(left.title).localeCompare(safeText(right.title), "zh-CN"))
    : [];
  const stageTaskIds = new Set(stageTasks.map(task => task.id));
  const involvedUnits = units.filter(unit => stageTasks.some(task => task.unitId === unit.id));

  const childrenOf = new Map();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const childIds = childrenOf.get(task.parentId) ?? [];
    childIds.push(task.id);
    childrenOf.set(task.parentId, childIds);
  }
  function decompositionChain(taskId) {
    if (!taskId) return new Set();
    const chain = new Set([taskId]);
    for (let parentId = taskById.get(taskId)?.parentId; parentId; parentId = taskById.get(parentId)?.parentId) chain.add(parentId);
    const pending = [...(childrenOf.get(taskId) ?? [])];
    while (pending.length) {
      const id = pending.pop();
      chain.add(id);
      pending.push(...(childrenOf.get(id) ?? []));
    }
    return chain;
  }
  const activeChain = selectedTaskId ? decompositionChain(selectedTaskId) : new Set();
  const expansionAlign = index => index <= 0 ? "start" : index >= phaseStages.length - 1 ? "end" : "center";

  const toggleStage = id => {
    if (openStageId === id) {
      setQuery(context.navigate, { stage: "", unit: "", task: "", anchor: "", spine: "" });
      return;
    }
    setQuery(context.navigate, { stage: id, unit: "", task: "", anchor: "", spine: "" });
  };
  const toggleTask = (task, unitId) => {
    if (selectedTaskId === task.id) {
      setQuery(context.navigate, { stage: openStageId, unit: "", task: "" });
      return;
    }
    setQuery(context.navigate, { stage: phaseOf(task), unit: unitId, task: task.id, anchor: "" });
  };
  const selectAnchor = id => setQuery(context.navigate, { anchor: id, task: "" });

  const stageCards = phaseStages.map((stage, index) => {
    const selected = stage.id === openStageId;
    const stageTaskList = tasks.filter(task => phaseOf(task) === stage.id);
    const taskCount = stageTaskList.length;
    // PMBOK 聚合：该阶段下所有任务的健康度分布 + 交付物/风险/决策总数
    const healthCounts = { "on-track": 0, "at-risk": 0, "off-track": 0 };
    let stageDeliverables = 0, stageRisks = 0, stageDecisions = 0;
    for (const t of stageTaskList) {
      const h = String(t.health ?? "").toLowerCase();
      if (healthCounts[h] != null) healthCounts[h]++;
      stageDeliverables += parseArrayField(t.deliverables).length;
      stageRisks += parseArrayField(t.risks).length;
      stageDecisions += parseArrayField(t.decisions).length;
    }
    const hasAggregation = stageDeliverables > 0 || stageRisks > 0 || stageDecisions > 0 || healthCounts["on-track"] + healthCounts["at-risk"] + healthCounts["off-track"] > 0;
    return el("div", {
      className: "swimlane-stage-cell",
      style: `--stage-column:${index + 1}`,
      dataset: { stageId: stage.id, expandAlign: expansionAlign(index) }
    }, [
      el("button", {
        type: "button",
        className: `swimlane-stage-card band-${stage.band}${selected ? " selected" : ""}${stage.id === context.data.currentStageId ? " current" : ""}`,
        ariaExpanded: selected ? "true" : "false",
        ariaLabel: `${stage.title}，${bandLabels[stage.band]}，${safeText(stage.dateLabel, "时间待确认")}${selected ? "，已展开" : "，点击展开"}`,
        title: selected ? "点击收起" : `${safeText(stage.dateLabel, "时间待确认")} · ${bandLabels[stage.band]}`,
        onClick: () => toggleStage(stage.id)
      }, [
        el("strong", { className: "swimlane-stage-title", text: stage.title }),
        selected ? el("span", { className: "swimlane-stage-status", text: `${safeText(stage.dateLabel, "时间待确认")} · ${bandLabels[stage.band]}${taskCount ? ` · ${taskCount} ${taskTerm}` : ""}` }) : null,
        selected ? el("span", { className: "swimlane-stage-description", text: safeText(stage.description, "阶段说明待补充") }) : null,
        selected ? el("span", { className: "swimlane-stage-output", text: `预期产出：${safeText(stage.expectedOutput, "待确认")}` }) : null,
        // PMBOK 聚合区
        selected && hasAggregation ? el("span", { className: "stage-pmbok-mini" }, [
          healthCounts["on-track"] + healthCounts["at-risk"] + healthCounts["off-track"] > 0
            ? el("span", { className: "stage-health-dots" }, [
                healthCounts["on-track"] ? el("span", { className: "health-dot health-green" }) : null,
                healthCounts["at-risk"] ? el("span", { className: "health-dot health-orange" }) : null,
                healthCounts["off-track"] ? el("span", { className: "health-dot health-red" }) : null
              ].filter(Boolean))
            : null,
          stageDeliverables ? el("span", { className: "mini-badge mini-deliverable", text: `📦${stageDeliverables}` }) : null,
          stageRisks ? el("span", { className: "mini-badge mini-risk", text: `⚠${stageRisks}` }) : null,
          stageDecisions ? el("span", { className: "mini-badge mini-decision", text: `✓${stageDecisions}` }) : null
        ].filter(Boolean)) : null
      ])
    ]);
  });

  const closureNodes = closures.map(closure => {
    const related = (closure.between ?? []).map(id => stageIndex.get(id)).filter(Number.isInteger);
    if (!related.length) return null;
    const column = Math.max(0, Math.round(related.reduce((sum, value) => sum + value, 0) / related.length));
    return el("button", {
      type: "button",
      className: `closure-anchor${closure.id === selectedAnchorId ? " selected" : ""}`,
      style: `--stage-column:${column + 1}`,
      dataset: { anchor: closure.id },
      ariaLabel: `${closure.title}，收口锚点`,
      onClick: () => selectAnchor(closure.id)
    }, [
      el("span", { className: "closure-anchor-mark", ariaHidden: "true", text: "◆" }),
      el("span", { className: "closure-anchor-label", text: closure.title })
    ]);
  }).filter(Boolean);

  function taskVisualState(task) {
    if (Number(task.progress) >= 100 || /done|completed|完成|已完成|closed|mitigated/i.test(String(task.state ?? ""))) return "complete";
    const today = new Date().toISOString().slice(0, 10);
    if (task.endDate && task.endDate < today) return "overdue";
    if (/risk|block|风险|阻塞|超时/i.test(String(task.state ?? ""))) return "risk";
    if (task.startDate) return "active";
    return "planned";
  }

  function taskCard(task, unit, colorIndex) {
    const expanded = task.id === selectedTaskId;
    const parent = taskById.get(task.parentId);
    const childCount = (childrenOf.get(task.id) ?? []).length;
    const inChain = activeChain.has(task.id);
    const visualState = taskVisualState(task);
    // PMBOK 摘要：P0 health 色点、P1 交付物/风险计数
    const taskDeliverables = parseArrayField(task.deliverables).length;
    const taskRisks = parseArrayField(task.risks).length;
    return el("article", {
      className: `swimlane-task-card-shell unit-color-${colorIndex}${expanded ? " expanded" : ""}${inChain ? " chain" : ""}`,
      dataset: { taskId: task.id, parent: task.parentId || "" }
    }, [
      el("button", {
        type: "button",
        className: `swimlane-task-card state-${visualState}${task.parentId ? " has-parent" : ""}`,
        ariaExpanded: expanded ? "true" : "false",
        ariaLabel: `${task.title}，${unit.name}，${statusText(task.state)}，起始 ${safeText(task.startDate, "待排期")}${task.parentId ? `，拆解自 ${parent?.title ?? task.parentId}` : ""}${taskDeliverables ? `，${taskDeliverables} 个交付物` : ""}${taskRisks ? `，${taskRisks} 个风险` : ""}`,
        title: expanded ? "点击收起任务详情" : `${unit.name} · ${visualState === "overdue" ? "超时" : statusText(task.state)}`,
        onClick: () => toggleTask(task, unit.id)
      }, [
        el("div", { className: "swimlane-task-card-head" }, [
          el("strong", { className: "swimlane-task-title", text: task.title }),
          healthDot(task.health)
        ]),
        (taskDeliverables > 0 || taskRisks > 0) ? el("div", { className: "swimlane-task-badges" }, [
          taskDeliverables ? el("span", { className: "card-badge badge-deliverable", title: `${taskDeliverables} 个交付物`, text: `📦 ${taskDeliverables}` }) : null,
          taskRisks ? el("span", { className: "card-badge badge-risk", title: `${taskRisks} 个风险`, text: `⚠ ${taskRisks}` }) : null
        ].filter(Boolean)) : null
      ]),
      expanded ? el("div", { className: "swimlane-task-detail" }, [
        parent ? el("p", { className: "swimlane-decomposition-note", text: `拆解自：${parent.title}` }) : null,
        childCount ? el("p", { className: "swimlane-decomposition-note", text: `已拆解出 ${childCount} 个同单元子任务` }) : null,
        taskInlineDetail(context, task, unit.name)
      ]) : null
    ]);
  }

  const unitRows = involvedUnits.map(unit => {
    const colorIndex = Math.max(0, units.findIndex(item => item.id === unit.id)) % 7;
    const unitTasks = stageTasks.filter(task => task.unitId === unit.id);
    const unitBand = unitLifecycleBandOf(tasks.filter(task => task.unitId === unit.id));
    return el("section", {
      className: `swimlane-card-row unit-color-${colorIndex} unit-band-${unitBand}${unit.id === selectedUnitId ? " selected" : ""}`,
      dataset: { unitId: unit.id },
      ariaLabel: `${unit.name}副泳道`
    }, [
      el("header", { className: "swimlane-card-row-label" }, [
        el("span", { className: "swimlane-unit-color", ariaHidden: "true" }),
        el("strong", { text: unit.name }),
        el("small", { text: `${bandLabels[unitBand]} · ${unitTasks.length} ${taskTerm}` })
      ]),
      el("div", {
        className: "swimlane-task-stack swimlane-task-grid",
        role: "list",
        ariaLabel: `${openStage.title} · ${unit.name}${taskTerm}`
      }, unitTasks.map(task => taskCard(task, unit, colorIndex)))
    ]);
  });

  const legend = el("ul", { className: "swimlane-legend", ariaLabel: "图例" }, [
    el("li", { className: "band-prepare" }, [el("i", { className: "dot" }), bandLabels.prepare]),
    el("li", { className: "band-active" }, [el("i", { className: "dot" }), bandLabels.active]),
    el("li", { className: "band-converged" }, [el("i", { className: "dot" }), bandLabels.converged]),
    el("li", {}, [el("span", { className: "anchor-glyph", text: "◆", ariaHidden: "true" }), "收口"]),
    el("li", {}, [el("span", { className: "anchor-glyph decomp-glyph", text: "⇢", ariaHidden: "true" }), "同单元拆解"]),
    el("li", {}, [el("span", { className: "status-glyph overdue", text: "!", ariaHidden: "true" }), "超时"])
  ]);

  const mainLane = el("section", { className: "swimlane-main-row", ariaLabel: "主任务时间线" }, [
    el("header", { className: "swimlane-main-row-label" }, [
      el("span", { className: "eyebrow", text: "主路线" }),
      el("strong", { text: "主任务线" }),
      el("small", { text: `按时间推进 · 点击${stageTerm}展开` })
    ]),
    el("div", { className: "swimlane-main-cards", style: `--stage-count:${phaseStages.length}` }, stageCards)
  ]);
  const closureLane = closureNodes.length ? el("div", { className: "swimlane-closure-row" }, [
    el("span", { className: "swimlane-closure-label", text: "闭环" }),
    el("div", { className: "swimlane-closure-track", style: `--stage-count:${phaseStages.length}` }, closureNodes)
  ]) : null;
  const expansion = openStage
    ? el("div", { className: "swimlane-card-expansion", dataset: { openStage: openStage.id } }, [
      el("div", { className: "swimlane-child-track", style: `--stage-count:${phaseStages.length}` }, [
        el("div", {
          className: "swimlane-child-focus",
          style: `--stage-column:${(stageIndex.get(openStage.id) ?? 0) + 1}`,
          dataset: { expandAlign: expansionAlign(stageIndex.get(openStage.id) ?? 0) }
        }, [
          svgEl("svg", {
            class: "swimlane-child-slope",
            viewBox: "0 0 420 54",
            preserveAspectRatio: "none",
            ariaHidden: "true"
          }, [
            svgEl("path", { d: "M 0 52 C 76 52 118 38 148 3" }),
            svgEl("path", { d: "M 272 3 C 302 38 344 52 420 52" })
          ]),
          el("section", {
            className: "swimlane-child-panel",
            ariaLabel: `${openStage.title}子任务面板`
          }, [
            el("div", { className: "swimlane-expansion-summary" }, [
              el("strong", { text: `${openStage.title} · 副任务卡片` }),
              el("span", { text: stageTasks.length ? `${involvedUnits.length} 个${unitTerm} · ${stageTasks.length} ${taskTerm}` : `暂无归入本${stageTerm}的${taskTerm}` })
            ]),
            unitRows.length
              ? el("div", { className: "swimlane-card-rows", role: "rowgroup" }, unitRows)
              : el("p", { className: "swimlane-card-empty", text: `本${stageTerm}暂无副任务卡片。` })
          ])
        ])
      ])
    ])
    : el("div", { className: "swimlane-card-empty", role: "status" }, [
      el("strong", { text: `选择上方${stageTerm}` }),
      el("span", { text: `未选择时隐藏全部${unitTerm}与副任务；选中后只展开相关卡片。` })
    ]);

  let detail = null;
  if (selectedAnchorId) {
    const closure = closures.find(item => item.id === selectedAnchorId);
    detail = closure ? el("article", { className: "inline-task-detail" }, [
      el("span", { className: "eyebrow", text: "收口锚点 · 战果闭环" }),
      el("h4", { text: closure.title }),
      definitionList([["状态", closure.state], ["日期", closure.dateLabel], ["关联阶段", (closure.between ?? []).join(" → ")], ["结果", closure.result], ["说明", closure.description], ["来源", closure.source]])
    ]) : null;
  }

  const desktopBoardMinWidth = 140 + 18 + 48 + phaseStages.length * 146 + Math.max(0, phaseStages.length - 1) * 14;
  const mobileBoardMinWidth = 124 + 10 + 32 + phaseStages.length * 178 + Math.max(0, phaseStages.length - 1) * 14;
  const board = el("div", {
    className: "swimlane-card-board",
    style: `--swimlane-board-min-width:${desktopBoardMinWidth}px;--swimlane-board-mobile-min-width:${mobileBoardMinWidth}px`,
    dataset: { openStage: openStage?.id ?? "", stageCount: String(phaseStages.length) }
  }, [mainLane, closureLane, expansion]);

  const section = el("section", { className: "module-primary-card roadmap-workbench roadmap-swimlane roadmap-card-swimlane" }, [
    roadmapViewSwitcher(context),
    cardHeading("PROJECT ROADMAP", context.module.title, `主任务组成项目路线；点击${stageTerm}后，相关${unitTerm}以不同颜色的卡片集合展开，副任务不按工期拉长。`),
    legend,
    localScroller("卡片式项目路线图，可水平滚动", board),
    detail
  ]);
  if (openStage) {
    requestAnimationFrame(() => {
      const selectedCard = board.querySelector(".swimlane-task-card-shell.expanded")
        ?? board.querySelector(".swimlane-stage-card.selected");
      const scroller = board.closest(".visual-scroll");
      if (!selectedCard || !scroller) return;
      const cardRect = selectedCard.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const safeInset = 28;
      if (cardRect.left < scrollerRect.left + safeInset || cardRect.right > scrollerRect.right - safeInset) {
        const cardCenter = cardRect.left + cardRect.width / 2;
        const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
        scroller.scrollLeft += cardCenter - scrollerCenter;
      }
    });
  }
  return section;
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
  processing: "预处理中", ready: "已处理完成", dependency_missing: "需人工确认", failed: "处理失败"
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
  if (location.type === "sheet-cell" && location.cell) return `${safeText(location.sheet, "工作表")} · 单元格 ${safeText(location.cell)}`;
  if (location.sheet || location.range) return `${safeText(location.sheet, "工作表")} · ${safeText(location.table, "表 1")} · ${safeText(location.range, "范围待确认")}`;
  if (Number.isInteger(location.image)) return `图 ${location.image}${location.region ? ` · ${location.region}` : ""}`;
  if (Number.isInteger(evidence.ordinal)) return `第 ${evidence.ordinal + 1} 段`;
  return "未提供精确区域";
}

function materialErrorMessage(error) {
  const copy = {
    unsupported_type: "不支持此文件类型。请上传 PDF、DOCX、PPTX、XLSX、文本、图片，或使用人工表单。",
    mime_mismatch: "文件内容与扩展名不一致，已停止上传。请确认文件来源后重试。",
    magic_mismatch: "文件内容与扩展名不一致，已停止上传。请确认文件来源后重试。",
    PROJECT_MATERIAL_LIMIT: "项目材料配额已用完，当前无法继续上传。",
    project_material_limit: "项目材料配额已用完，当前无法继续上传。",
    project_capacity: "项目材料配额已用完，当前无法继续上传。",
    project_capacity_limit: "项目材料配额已用完，当前无法继续上传。",
    DUPLICATE_MATERIAL: "相同内容已归档",
    duplicate_material: "相同内容已归档",
    upload_rate_limited: "上传过于频繁，请稍后重试。",
    upload_concurrent: "已有材料正在上传或预处理，请等待后再试。",
    upload_concurrency_limited: "已有材料正在上传或预处理，请等待后再试。",
    zip_bomb: "文件展开后超过安全限制，已停止处理。请压缩内容或拆分文件后重试。"
  };
  return copy[error?.code] ?? error?.message ?? "请求失败，请稍后重试";
}

const readinessLabels = Object.freeze({ ready: "内容完整", warning: "基本完整", blocked: "缺少必要信息" });
function readinessText(material = {}) {
  const readiness = material.readiness;
  if (!material.updateTemplate) return "未选择模板";
  if (!readiness) return "待分析";
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
    AI_PROVIDER_DISABLED: "更新生成当前未启用；材料和已有建议仍可查看。",
    GENERATION_PROVIDER_DISABLED: "更新生成当前未启用；材料和已有建议仍可查看。",
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
    title: campaign ? "生成作战更新建议" : "生成项目更新建议",
    eyebrow: campaign ? "作战更新" : "项目更新",
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
          const eligible = sourceItems.filter(item => item.status === "ready" && updateTemplateKey(item) && item.readiness?.status !== "blocked");
          const selected = new Set();
          if (originatingMaterial?.id && eligible.some(item => item.id === originatingMaterial.id)) selected.add(originatingMaterial.id);
          const maxMaterials = Math.min(8, Number(limits.maxMaterialsPerTask ?? limits.maxMaterials ?? 8));
          const maxEvidence = Number(limits.maxEvidenceBlocks ?? 48);
          const error = el("p", { className: "form-error", role: "alert" });
          const selection = el("fieldset", { className: "generation-materials" });
          const selectionCount = el("strong", { className: "generation-selection-count" });
          const summary = el("dl", { className: "generation-lock-summary" });
          const create = el("button", { type: "submit", className: "primary-button", text: campaign ? "生成作战更新建议" : "生成项目更新建议" });
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
                el("label", { htmlFor: inputId }, [el("strong", { text: safeText(item.name, item.displayName) }), el("small", { text: `${updateTemplateLabel(item)} · ${Number(item.evidenceCount ?? item.currentEvidenceCount ?? 0)} 个内容片段 · ${readinessText(item)}` })]),
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
              ["内容片段", `${Math.min(evidenceCount, maxEvidence)}/${maxEvidence}`],
              ["今日剩余", `${usage.remainingToday ?? usage.generationRemainingToday ?? "—"} 次`],
              ["重置时间", uiDate(usage.resetTime ?? capabilityEnvelope.resetTime)]
            ].flatMap(([term, value]) => [el("dt", { text: term }), el("dd", { text: String(value) })]));
            // The server safely locks at most maxEvidence blocks. A material may
            // contain more blocks without becoming ineligible for generation.
            create.disabled = !canCreate || !providerEnabled || chosen.length < 1 || evidenceCount < 1;
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
              controls.setCommitting(false); cancel.disabled = false; create.textContent = campaign ? "生成作战更新建议" : "生成项目更新建议"; renderSelection();
            }
          } }, [
            el("p", { className: "material-boundary", text: "AI 只生成带来源的更新建议；不会修改项目草稿或发布版本。" }),
            el("p", { className: "generation-limit-copy", text: `每个任务最多 ${maxMaterials} 份同项目、同类型材料；服务端最多锁定 ${maxEvidence} 个当前内容片段。` }),
            ...(providerEnabled ? [] : [el("p", { className: "generation-provider-disabled", role: "status", text: "更新生成当前未启用；材料和已有建议仍可查看。" })]),
            selectionCount, selection, summary, error,
            el("footer", { className: "sheet-actions" }, [cancel, create])
          ]);
          controls.body.replaceChildren(eligible.length ? form : el("section", { className: "module-empty material-empty" }, [
            el("h3", { text: "暂无可用于生成的材料" }),
            el("p", { text: "材料必须已处理完成、已选择更新类型且内容完整性不缺失。" }),
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

function openBatchSheet(context, returnFocus) {
  const campaign = context.presentation.kind === "campaign";
  modalSheet({
    title: campaign ? "一键全部生成" : "一键全部生成",
    eyebrow: campaign ? "作战更新" : "项目更新",
    project: context.project,
    returnFocus,
    className: "material-sheet batch-generation-sheet",
    closeLabel: "关闭批量生成面板",
    titleId: "batch-sheet-title",
    render: controls => {
      const loading = el("section", { className: "generation-sheet-loading", ariaBusy: "true" }, [el("p", { text: "正在扫描可用于生成的材料…" })]);
      controls.body.replaceChildren(loading);
      void (async () => {
        try {
          const envelope = await context.api(generationPath(context, "/capabilities"));
          const caps = envelope.capabilities ?? {};
          const providerEnabled = envelope.provider?.enabled ?? envelope.providerEnabled ?? true;
          const canCreate = capability(envelope, "create", "createTask", "createGenerationTask");
          const eligible = (envelope.eligibleMaterials ?? []).filter(item =>
            item.status === "ready" && item.updateTemplate?.id && item.generation?.enabled && item.readiness?.status !== "blocked" && Number(item.evidenceCount) > 0
          );
          if (!eligible.length) {
            controls.body.replaceChildren(el("section", { className: "module-empty material-empty" }, [
              el("h3", { text: "当前没有可批量生成的材料" }),
              el("p", { text: "材料必须已处理完成（ready）、已配置更新模板、且内容完整性不缺失。" }),
              el("button", { type: "button", className: "secondary-button", text: "关闭", onClick: controls.close })
            ]));
            return;
          }
          // 按模板分组展示
          const groups = new Map();
          for (const item of eligible) {
            const key = `${item.updateTemplate.id}@${item.updateTemplate.version}`;
            const label = item.updateTemplate.label ?? key;
            if (!groups.has(key)) groups.set(key, { label, items: [] });
            groups.get(key).items.push(item);
          }
          const groupRows = [...groups.entries()].map(([key, group]) => {
            const taskCount = Math.ceil(group.items.length / 8);
            return el("div", { className: "batch-group-row" }, [
              el("strong", { text: group.label }),
              el("span", { text: `${group.items.length} 份材料 → ${taskCount} 个生成任务` }),
              el("ul", {}, group.items.slice(0, 5).map(item => el("li", { text: safeText(item.name, item.displayName) }))),
              group.items.length > 5 ? el("small", { text: `…及其他 ${group.items.length - 5} 份材料` }) : null
            ]);
          });
          const totalTasks = [...groups.values()].reduce((sum, g) => sum + Math.ceil(g.items.length / 8), 0);
          const error = el("p", { className: "form-error", role: "alert" });
          const submit = el("button", { type: "button", className: "primary-button", text: `开始批量生成（${totalTasks} 个任务）`, disabled: !canCreate || !providerEnabled });
          const cancel = el("button", { type: "button", className: "secondary-button", text: "取消", onClick: controls.close });
          if (!providerEnabled) {
            controls.body.replaceChildren(el("section", { className: "error-panel", role: "alert" }, [
              el("h3", { text: "更新生成未启用" }), el("p", { text: "当前环境未配置 AI 提供商，无法执行批量生成。" }),
              el("button", { type: "button", className: "secondary-button", text: "关闭", onClick: controls.close })
            ]));
            return;
          }
          submit.onclick = async () => {
            error.textContent = ""; controls.setCommitting(true); submit.disabled = cancel.disabled = true; submit.textContent = "正在批量生成…";
            try {
              const result = await context.api(generationPath(context, "/batch"), { method: "POST", mutation: true });
              const summary = result.summary ?? {};
              controls.setCommitting(false); controls.close();
              const msg = `批量生成完成：${summary.succeeded ?? 0} 成功 / ${summary.failed ?? 0} 失败 / 共 ${summary.total ?? 0} 个任务`;
              context.showToast(msg);
              context.navigate(materialsUiPath(context, "?view=proposals"));
            } catch (requestError) {
              error.textContent = generationErrorMessage(requestError);
              controls.setCommitting(false); cancel.disabled = false; submit.disabled = false; submit.textContent = `开始批量生成（${totalTasks} 个任务）`;
            }
          };
          controls.body.replaceChildren(el("section", { className: "batch-generation-body" }, [
            el("p", { className: "material-boundary", text: "系统将自动发现所有符合条件的材料，按更新模板分组后批量创建生成任务。每个任务最多处理 8 份材料。" }),
            el("div", { className: "batch-summary" }, [
              el("div", {}, [el("strong", { text: String(eligible.length) }), el("span", { text: "份可生成材料" })]),
              el("div", {}, [el("strong", { text: String(groups.size) }), el("span", { text: "个模板分组" })]),
              el("div", {}, [el("strong", { text: String(totalTasks) }), el("span", { text: "个生成任务" })])
            ]),
            el("div", { className: "batch-groups" }, groupRows),
            error,
            el("footer", { className: "sheet-actions" }, [cancel, submit])
          ]));
        } catch (error) {
          if (error.message === "AUTHENTICATION_REQUIRED") { controls.close(); return; }
          controls.body.replaceChildren(el("section", { className: "error-panel", role: "alert" }, [
            el("h3", { text: "无法加载生成条件" }), el("p", { text: generationErrorMessage(error) }),
            el("button", { type: "button", className: "secondary-button", text: "关闭", onClick: controls.close })
          ]));
        }
      })();
    }
  });
}

const TEMPLATE_GUIDE = {
  "meeting-notes": {
    label: "会议纪要",
    required: [{ label: "行动项", hint: "谁负责做什么，截止何时", keywords: "行动 / 任务 / 待办 / 跟进 / 负责" }],
    optional: [
      { label: "负责人或作战单元", hint: "参会人或执行团队", keywords: "负责人 / 团队 / owner" },
      { label: "会议日期或来源", hint: "开会时间", keywords: "日期 / 时间 / 会议" }
    ],
    good: "会议时间：2026年7月22日\n参会：张总、刘芳\n\n行动项：\n- 刘芳负责跟进农行审批流程，8月5日前完成\n- 张总协调方案团队补充安全设计",
    bad: "今天开会了\n张总讲了很多\n然后就散会了",
    tip: "微信群聊和语音转文字只需在末尾补一句「行动项：xxx负责跟进xxx」即可通过。"
  },
  "progress-report": {
    label: "进度汇报",
    required: [
      { label: "截至日期或汇报周期", hint: "本周/本月/具体日期", keywords: "截至 / 日期 / 周期 / 本周" },
      { label: "状态或进度事实", hint: "百分比、完成状态、具体进展", keywords: "完成 / 进度 / 状态 / %" }
    ],
    optional: [{ label: "下一步行动", hint: "后续计划", keywords: "下一步 / 后续 / 计划" }],
    good: "报告周期：2026年7月第4周\n\n进度：\n- 农行核心系统：进度55%，预计8月签约\n- 中交建项目：暂停\n\n下周计划：\n- 跟进农行内部审批",
    bad: "农行在推进\n中交暂停了\n其他正常",
    tip: "「大概完成了三分之一」不算进度——需要具体的百分比或数字。"
  },
  "metrics-data": {
    label: "指标数据",
    required: [
      { label: "指标名称", hint: "KPI名称", keywords: "指标 / metric / kpi" },
      { label: "指标值", hint: "具体数值", keywords: "数值 / value / % / 率 / 量" },
      { label: "指标日期", hint: "数据周期", keywords: "日期 / 截至 / 周期" }
    ],
    optional: [],
    good: "数据周期：2026年7月\n\n签约金额：2100万元\n目标完成率：42%\n在途商机：18500万元",
    bad: "签约了几个\n农行那个比较大\n大概完成了三分之一\n具体数字我要查一下",
    tip: "指标数据模板要求最高：名称、数值、日期三者缺一就会被拦截。"
  },
  "project-plan": {
    label: "项目计划",
    required: [
      { label: "项目目标", hint: "要达成什么", keywords: "目标 / 愿景 / 范围 / 交付" },
      { label: "团队或作战单元", hint: "谁来做", keywords: "团队 / 作战单元 / 负责人" },
      { label: "任务或里程碑", hint: "关键节点", keywords: "任务 / 里程碑 / 阶段" }
    ],
    optional: [],
    good: "项目目标：实现99.9%可用性，降低运维成本30%\n团队：云基础设施组（5人）\n里程碑：\n- M1（8月）架构设计完成\n- M2（9月）MVP上线",
    bad: "Q4我们要：\n全力冲刺！\n抢占市场！\n具体方案后面再定。",
    tip: "口号不是目标——「全力冲刺」→「Q4营收目标5000万」。"
  }
};

const TEMPLATE_DOWNLOAD_CONTENT = {
  "meeting-notes": `# 会议纪要

> 上传此模板时请选择"更新模板：会议纪要"

## 基本信息
- 会议日期：YYYY-MM-DD
- 参会人员：
- 会议主题：

## 讨论内容
1.
2.

## 行动项（必填——缺失将无法生成更新建议）
- [ ] 负责人：______ 任务：______ 截止：YYYY-MM-DD
- [ ] 负责人：______ 任务：______ 截止：YYYY-MM-DD

## 备注
`,
  "progress-report": `# 进度汇报

> 上传此模板时请选择"更新模板：进度汇报"

## 汇报周期（必填）
截至日期：YYYY-MM-DD

## 进度概览（必填——需要具体数字或状态）
| 事项 | 进度/状态 | 说明 |
|------|----------|------|
|      |          |      |
|      |          |      |

## 本期完成
-

## 下一步计划
-

## 风险与阻塞
-
`,
  "metrics-data": `# 指标数据

> 上传此模板时请选择"更新模板：指标数据"

## 数据周期（必填）
YYYY-MM-DD 或 YYYY年M月

## 指标数据（必填——名称、数值、日期缺一不可）
| 指标名称 | 数值 | 单位 | 备注 |
|----------|------|------|------|
|          |      |      |      |
|          |      |      |      |

## 趋势说明
- 环比变化：
- 同比变化：

## 分析
-
`,
  "project-plan": `# 项目计划

> 上传此模板时请选择"更新模板：项目计划"

## 项目目标（必填）
具体可量化的目标，例如：Q4营收5000万、系统可用性99.9%

## 团队/作战单元（必填）
| 角色 | 姓名 | 职责 |
|------|------|------|
|      |      |      |

## 里程碑与任务（必填）
| 里程碑 | 预计完成 | 状态 | 关键交付物 |
|--------|---------|------|-----------|
| M1     | YYYY-MM-DD | 未启动 |           |
| M2     | YYYY-MM-DD | 未启动 |           |

## 关键依赖
-

## 风险预案
-
`
};

function downloadTemplateFile(templateId) {
  const info = TEMPLATE_GUIDE[templateId];
  const content = TEMPLATE_DOWNLOAD_CONTENT[templateId];
  if (!info || !content) return;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `${templateId}-模板.md` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildInlineGuidePanel() {
  const tabs = el("div", { className: "guide-tabs", role: "tablist" }, Object.entries(TEMPLATE_GUIDE).map(([id, info]) =>
    el("button", { type: "button", role: "tab", className: "guide-tab", text: info.label, dataset: { template: id } })
  ));
  const content = el("div", { className: "guide-tab-content" });
  const showTemplate = (templateId) => {
    const info = TEMPLATE_GUIDE[templateId];
    if (!info) return;
    tabs.querySelectorAll(".guide-tab").forEach(t => t.classList.toggle("active", t.dataset.template === templateId));
    content.replaceChildren(
      el("div", { className: "guide-template-detail" }, [
        el("div", { className: "guide-section" }, [
          el("h4", { text: "必须包含（缺失则无法生成建议）" }),
          el("ul", { className: "guide-field-list" }, info.required.map(f =>
            el("li", {}, [el("strong", { text: f.label }), el("span", { text: " — " + f.hint }), el("small", { text: " 关键词: " + f.keywords })])
          ))
        ]),
        info.optional.length ? el("div", { className: "guide-section" }, [
          el("h4", { text: "加分项（缺失会提示但可生成）" }),
          el("ul", { className: "guide-field-list" }, info.optional.map(f =>
            el("li", {}, [el("strong", { text: f.label }), el("span", { text: " — " + f.hint }), el("small", { text: " 关键词: " + f.keywords })])
          ))
        ]) : null,
        el("div", { className: "guide-section guide-examples" }, [
          el("div", { className: "guide-example" }, [
            el("span", { className: "guide-example-badge badge-good", text: "高质量" }),
            el("pre", { className: "guide-example-text", text: info.good })
          ]),
          el("div", { className: "guide-example" }, [
            el("span", { className: "guide-example-badge badge-bad", text: "低质量" }),
            el("pre", { className: "guide-example-text", text: info.bad })
          ])
        ]),
        el("div", { className: "guide-tip" }, [el("span", { className: "guide-tip-icon", text: "提示" }), el("span", { text: info.tip })])
      ])
    );
  };
  tabs.querySelectorAll(".guide-tab").forEach(tab => tab.addEventListener("click", () => showTemplate(tab.dataset.template)));
  showTemplate(Object.keys(TEMPLATE_GUIDE)[0]);
  return el("div", { className: "guide-inline-panel" }, [
    el("div", { className: "guide-quick-grid" }, Object.entries(TEMPLATE_GUIDE).map(([id, info]) =>
      el("div", { className: "guide-quick-item" }, [
        el("span", { className: "guide-quick-label", text: info.label }),
        el("span", { text: "必须有：" + info.required.map(f => f.label).join("、"), className: "guide-quick-hint" })
      ])
    )),
    tabs,
    content
  ]);
}

function openManualSheet(context, catalog, refresh, returnFocus) {
  modalSheet({ title: "填写人工材料", eyebrow: context.presentation.kind === "campaign" ? "项目材料" : "项目材料", project: context.project, returnFocus, render: controls => {
    const template = templateSelect(catalog, "manual-update-template");
    const body = el("textarea", { id: "manual-body", name: "body", required: true, rows: 10, maxLength: 20000 });
    const note = el("textarea", { id: "manual-note", name: "note", rows: 3, maxLength: 500 });
    const remaining = el("small", { className: "character-count", text: "还可输入 500 字" });
    note.addEventListener("input", () => { remaining.textContent = `还可输入 ${500 - note.value.length} 字`; });
    const error = el("p", { className: "form-error", role: "alert" });
    const submit = el("button", { type: "submit", className: "primary-button", text: "归档人工材料" });
    const templateHint = el("div", { className: "template-field-hint" });
    const updateTemplateHint = () => {
      const info = TEMPLATE_GUIDE[template.value];
      if (!info) { templateHint.replaceChildren(); return; }
      const reqBadges = info.required.map(f => el("span", { className: "field-badge field-required", text: f.label }));
      const optBadges = info.optional.map(f => el("span", { className: "field-badge field-optional", text: f.label }));
      templateHint.replaceChildren(
        el("div", { className: "template-hint-row" }, [
          el("span", { className: "template-hint-label", text: "必须包含：" }),
          ...reqBadges
        ]),
        optBadges.length ? el("div", { className: "template-hint-row" }, [
          el("span", { className: "template-hint-label", text: "加分项：" }),
          ...optBadges
        ]) : null,
        el("div", { className: "template-hint-tip", text: info.tip })
      );
    };
    template.addEventListener("change", updateTemplateHint);
    const form = el("form", { className: "material-form", onSubmit: async event => {
      event.preventDefault(); error.textContent = ""; controls.setCommitting(true); submit.disabled = true; submit.textContent = "正在归档…";
      const values = Object.fromEntries(new FormData(form));
      try {
        await context.api(materialPath(context, "/manual"), { method: "POST", mutation: true, body: { title: values.title, body: values.body, category: values.category, sourceDate: values.sourceDate, contributor: values.contributor, note: values.note, updateTemplateId: values.updateTemplateId, updateTemplateVersion: "1.0.0" } });
        context.showToast("人工材料已归档，已处理完成"); controls.setCommitting(false); controls.close(); await refresh();
      } catch (requestError) { error.textContent = materialErrorMessage(requestError); controls.setCommitting(false); submit.disabled = false; submit.textContent = "归档人工材料"; }
    } }, [
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-title", text: "标题" }), el("input", { id: "manual-title", name: "title", required: true, maxLength: 240 })]),
      el("div", { className: "form-grid" }, [
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-category", text: "材料分类" }), el("select", { id: "manual-category", name: "category" }, ["会议纪要", "计划", "汇报", "表格/数据", "成果文件", "图片", "其他"].map(label => el("option", { text: label, value: label })))]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-date", text: "来源 / 发生日期" }), el("input", { id: "manual-date", name: "sourceDate", type: "date" })]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-contributor", text: "贡献人" }), el("input", { id: "manual-contributor", name: "contributor", maxLength: 120 })]),
        el("div", { className: "field" }, [el("label", { htmlFor: "manual-update-template", text: "更新模板" }), template])
      ]),
      templateHint,
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-body", text: "正文（纯文本）" }), body]),
      el("div", { className: "field" }, [el("label", { htmlFor: "manual-note", text: "备注（可选）" }), note, remaining]),
      el("p", { className: "material-boundary", text: "材料归档后可按更新类型生成带来源的更新建议；不会直接修改项目草稿或发布版本。" }), error,
      el("footer", { className: "sheet-actions" }, [el("button", { type: "button", className: "secondary-button", text: "关闭", onClick: controls.close }), submit])
    ]);
    controls.body.append(form);
  }});
}

function openUploadSheet(context, ledger, refresh, returnFocus) {
  modalSheet({ title: context.presentation.kind === "campaign" ? "上传作战材料" : "上传项目材料", eyebrow: context.presentation.kind === "campaign" ? "项目材料" : "项目材料", project: context.project, returnFocus, render: controls => {
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
          row.querySelector("progress").value = 1; row.querySelector(".status-label").textContent = "材料已归档，正在提取内容";
          if (receipt?.material?.id) {
            await context.api(materialPath(context, `/${encodeURIComponent(receipt.material.id)}/update-template`), { method: "PATCH", mutation: true, body: { id: template.value, version: "1.0.0" } });
            row.append(el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials/${encodeURIComponent(receipt.material.id)}`, text: "查看已归档材料" }));
          }
        }
        context.showToast("材料已归档，正在提取内容"); controls.setCommitting(false); await refresh();
      } catch (requestError) { error.textContent = materialErrorMessage(requestError); controls.setCommitting(false); submit.disabled = false; submit.textContent = "开始上传"; }
    } }, [
      el("div", { className: "quota-compact", text: `单文件 ${bytes(ledger.limits.maxFileBytes)} · 项目 ${ledger.usage.materials}/${ledger.limits.maxMaterials} 项 · 并发 ${ledger.limits.maxConcurrentUploads}` }), drop,
      el("div", { className: "form-grid" }, [el("div", { className: "field" }, [el("label", { htmlFor: "upload-category", text: "材料分类" }), el("select", { id: "upload-category", name: "category" }, ["会议纪要", "计划", "汇报", "表格/数据", "成果文件", "图片", "其他"].map(label => el("option", { text: label, value: label })))]), el("div", { className: "field" }, [el("label", { htmlFor: "upload-update-template", text: "更新模板" }), template])]),
      el("div", { className: "field" }, [el("label", { htmlFor: "upload-note", text: "材料备注（可选）" }), note, remaining]),
      el("p", { className: "material-boundary", text: "材料归档后可按更新类型生成带来源的更新建议；不会直接修改项目草稿或发布版本。" }), queue, error,
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
      // "下载推荐模板"——按类型下载 .md 模板文件
      const dlSelect = el("select", { id: "template-download-select", ariaLabel: "选择模板类型" }, [
        el("option", { value: "", text: "下载推荐模板" }),
        ...Object.entries(TEMPLATE_GUIDE).map(([id, info]) => el("option", { value: id, text: info.label + " 模板" }))
      ]);
      const dlBtn = el("button", { type: "button", className: "secondary-button", text: "下载", onClick: () => {
        if (dlSelect.value) downloadTemplateFile(dlSelect.value);
      } });
      const manual = caps.manual ? el("div", { className: "template-download-group" }, [dlSelect, dlBtn]) : null;
      // "编写指南"——点击就地展开/收起
      const guideToggle = el("button", { type: "button", className: "ghost-button guide-toggle-btn", text: "编写指南 ▸", onClick: event => {
        const isOpen = guidePanel.style.display === "block";
        guidePanel.style.display = isOpen ? "none" : "block";
        guideToggle.textContent = isOpen ? "编写指南 ▸" : "编写指南 ▾";
      } });
      const guidePanel = el("div", { className: "guide-inline-wrapper" });
      guidePanel.style.display = "none";
      guidePanel.append(buildInlineGuidePanel());
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
        const isEmpty = !ledger.items?.length;
        const emptyContent = isEmpty ? el("section", { className: "module-empty material-empty" }, [
          el("h2", { text: "还没有项目材料" }),
          el("p", { text: context.presentation.kind === "campaign" ? "上传材料建立可追溯的项目内容。" : "上传材料建立可追溯的项目内容。" }),
          // 内容要素清单——与提示词 P0/P1/P2 提取规则对称，引导用户上传能填满卡片的材料。
          el("div", { className: "material-element-hint" }, [
            el("p", { className: "element-hint-title", text: "卡片由材料填充，请尽量包含以下要素：" }),
            el("div", { className: "element-hint-row" }, [
              el("span", { className: "element-badge badge-required", text: "必选" }),
              el("span", { className: "element-hint-items", text: "目标/范围 · 时间节点 · 人员" })
            ]),
            el("div", { className: "element-hint-row" }, [
              el("span", { className: "element-badge badge-conditional", text: "有就写" }),
              el("span", { className: "element-hint-items", text: "交付物 · 风险/阻塞" })
            ]),
            el("div", { className: "element-hint-row" }, [
              el("span", { className: "element-badge badge-optional", text: "可选" }),
              el("span", { className: "element-hint-items", text: "验收标准 · 关键决策（后续补充即可）" })
            ])
          ]),
          emptyUpload
        ]) : el("section", { className: "module-empty material-empty" }, [el("h2", { text: "当前筛选下没有材料" })]);
        list.replaceChildren(items.length ? materialTable(context, items, caps, load) : emptyContent);
      };
      let timer; search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(updateList, 200); }); status.addEventListener("change", updateList); sort.addEventListener("change", updateList);
      root.replaceChildren(el("section", { className: "materials-workspace-card" }, [
        el("div", { className: "material-summary-grid" }, [summaryCard("材料总数", summary.count ?? 0, `上限 ${limits.maxMaterials ?? "—"}`), summaryCard("已处理完成", summary.readyCount ?? 0, "可追溯内容"), summaryCard("可生成更新", summary.generationEnabledCount ?? summary.readyCount ?? 0, "满足生成条件"), summaryCard("存储用量", bytes(usage.materialBytes ?? 0), `上限 ${bytes(limits.maxProjectBytes)}`)]),
        el("section", { className: "quota-panel", ariaLabel: "材料与问答配额" }, [el("div", { className: "quota-title" }, [el("h2", { text: "项目配额" }), el("span", { text: `剩余问答 ${usage.chatRemainingToday ?? "—"} 次` })]), el("progress", { max: Math.max(1, Number(limits.maxProjectBytes) || 1), value: Math.min(Number(usage.materialBytes) || 0, Number(limits.maxProjectBytes) || 1), ariaLabel: "项目存储用量" }), el("p", { text: `单文件 ${bytes(limits.maxFileBytes)} · 每分钟 ${limits.maxUploadsPerMinute ?? "—"} 次上传 · ${limits.maxConcurrentUploads ?? "—"} 个并发 · Office 展开 ${bytes(limits.maxZipExpandedBytes)} / ${limits.maxZipEntries ?? "—"} 条` })]),
        el("div", { className: "material-toolbar" }, [el("div", { className: "material-actions" }, [upload, manual, guideToggle]), search, status, sort]),
        guidePanel,
        list
      ]));
      updateList();
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: "无法加载项目材料" }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "primary-button", text: "重新加载材料", onClick: load })]));
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
    let nextHint = null;
    if (item.status === "processing") nextHint = el("span", { className: "next-step-hint processing", text: "提取中…" });
    else if (item.status === "failed" || item.status === "dependency_missing") nextHint = el("span", { className: "next-step-hint failed", text: "需重试" });
    else if (item.status === "ready" && !item.updateTemplate?.id) nextHint = el("span", { className: "next-step-hint", text: "→ 选模板" });
    else if (item.status === "ready" && item.updateTemplate?.id && item.readiness?.status === "blocked") nextHint = el("span", { className: "next-step-hint", text: "→ 需补充内容" });
    else if (item.status === "ready" && item.updateTemplate?.id) nextHint = el("span", { className: "next-step-hint ready", text: "→ 可生成建议" });
    return el("tr", {}, [el("th", { scope: "row" }, [link, el("small", { text: item.extension || item.sourceKind || "待补充" })]), el("td", { text: item.updateTemplate?.label ?? "未选择更新模板" }), el("td", {}, [readinessNode(item)]), el("td", {}, [el("span", { className: `material-status status-${item.status}`, text: materialStatus[item.status] ?? item.status })]), el("td", {}, item.evidenceCount > 0 ? [el("a", { href: detailLink(item), text: `${item.evidenceCount} 个内容片段`, onClick: event => { event.preventDefault(); context.navigate(detailLink(item)); } })] : [el("span", { text: "0 个内容片段" })]), el("td", {}, [el("span", { text: safeText(item.uploadedBy) }), el("small", { text: uiDate(item.createdAt) })]), el("td", { text: bytes(item.size) }), el("td", {}, [nextHint, el("div", { className: "row-actions" }, actions)])]);
  }));
  return el("div", { className: "table-scroll material-table-scroll", tabIndex: 0, role: "region", ariaLabel: "项目材料，可水平滚动" }, [el("table", { className: "module-table material-table" }, [el("caption", { text: "当前项目项目材料" }), el("thead", {}, [el("tr", {}, ["材料", "类型 / 模板", "内容完整性", "处理状态", "内容片段", "上传者 / 时间", "大小", "下一步 / 操作"].map(label => el("th", { scope: "col", text: label })))]), tbody])]);
}

function detailMetadata(material) {
  return definitionList([["材料类型", material.extension || material.sourceKind], ["处理状态", materialStatus[material.status] ?? material.status], ["更新模板", material.updateTemplate?.label ?? "未选择更新模板"], ["内容完整性", readinessText(material)], ["上传者 / 时间", `${safeText(material.uploadedBy)} · ${uiDate(material.createdAt)}`], ["原始大小", bytes(material.size)], ["SHA-256", safeText(material.sha256)], ["内容片段", `${material.evidenceCount ?? 0} 个`]], "material-detail-meta");
}

function materialStepGuide(context, material, caps) {
  const campaign = context.presentation.kind === "campaign";
  const steps = [
    { id: "uploaded", label: "材料归档", detail: "文件已上传并记录 SHA-256" },
    { id: "extracted", label: "内容提取", detail: "证据片段已提取到平台" },
    { id: "template", label: "选择更新模板", detail: "告知平台这份材料的用途" },
    { id: "generated", label: "生成更新建议", detail: "AI 基于材料生成结构化提案" },
    { id: "reviewed", label: "审核发布", detail: "人工审核建议并发布到草稿" }
  ];
  let currentStep = 0;
  if (material.status === "ready" && Number(material.evidenceCount) > 0) currentStep = 1;
  if (material.updateTemplate?.id) currentStep = Math.max(currentStep, 2);
  const guide = el("section", { className: "material-step-guide", ariaLabel: "材料处理进度" });
  const indicator = el("div", { className: "step-guide-track" }, steps.map((step, index) => {
    const done = index < currentStep;
    const active = index === currentStep;
    return el("div", { className: `step-node ${done ? "done" : ""} ${active ? "active" : ""}` }, [
      el("span", { className: "step-number", text: done ? "✓" : String(index + 1) }),
      el("div", { className: "step-content" }, [
        el("strong", { text: step.label }),
        el("small", { text: step.detail })
      ])
    ]);
  }));
  const nextAction = el("div", { className: "step-next-action" });
  if (currentStep === 0) {
    nextAction.append(
      el("span", { className: "step-hint", text: material.status === "processing" ? "⏳ 正在提取内容，请稍候…" : material.status === "failed" ? "❌ 处理失败，请重试" : "" }),
    );
  } else if (currentStep === 1) {
    nextAction.append(el("span", { className: "step-hint", text: "👉 下一步：选择更新模板，告知平台这份材料的用途" }));
  } else if (currentStep === 2) {
    if (material.readiness?.status === "blocked") {
      nextAction.append(el("span", { className: "step-hint", text: "⛔ 内容完整性不足，需补充关键信息后才能生成建议" }));
    } else if (caps.createGenerationTask) {
      const btn = el("button", { type: "button", className: "primary-button step-cta", text: campaign ? "👉 生成作战更新建议" : "👉 生成项目更新建议", onClick: event => openGenerationSheet(context, material, event.currentTarget) });
      nextAction.append(el("span", { className: "step-hint", text: "材料已就绪，可以生成更新建议了" }), btn);
    } else {
      nextAction.append(el("span", { className: "step-hint", text: "✅ 材料已就绪，等待有权限的成员生成更新建议" }));
    }
  } else if (currentStep >= 3) {
    const proposalHref = `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=proposals`;
    nextAction.append(el("a", { className: "primary-button step-cta", href: proposalHref, text: "👉 前往审核与发布", onClick: event => { event.preventDefault(); context.navigate(proposalHref); } }));
  }
  guide.append(
    el("header", { className: "step-guide-header" }, [
      el("span", { className: "eyebrow", text: "处理进度" }),
      el("h2", { text: currentStep >= 3 ? "已生成更新建议" : "当前进度与下一步" })
    ]),
    indicator,
    nextAction
  );
  return guide;
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
      const index = items.length ? el("div", { className: "evidence-index" }, items.map(item => el("a", { href: `${base}?evidence=${encodeURIComponent(item.id)}`, className: selected?.id === item.id ? "selected" : "", ariaCurrent: selected?.id === item.id ? "location" : null, onClick: event => { event.preventDefault(); context.navigate(`${base}?evidence=${encodeURIComponent(item.id)}`); } }, [el("strong", { text: locatorLabel(item) }), el("span", { text: safeText(item.summary, item.text?.slice(0, 100)) }), el("small", { text: item.id })]))) : el("section", { className: "module-empty" }, [el("h2", { text: "该材料尚未形成可追溯内容" }), el("p", { text: material.status === "failed" ? "材料处理失败，可在权限允许时重试处理。" : "材料可能仍在处理中，处理完成后会显示在这里。" })]);
      const select = el("select", { className: "mobile-evidence-select", ariaLabel: "选择内容位置" }, items.map(item => el("option", { value: item.id, text: locatorLabel(item) }))); if (selected) select.value = selected.id; select.addEventListener("change", () => context.navigate(`${base}?evidence=${encodeURIComponent(select.value)}`));
      const preview = selected ? el("article", { className: "evidence-preview", ariaLive: "polite" }, [el("span", { className: "eyebrow", text: "内容预览" }), el("h2", { text: locatorLabel(selected) }), el("p", { className: "evidence-id", text: `内容片段 ${selected.id}` }), el("blockquote", { text: safeText(selected.summary, selected.text) }), el("details", {}, [el("summary", { text: "查看提取文本" }), el("pre", { text: safeText(selected.text) })]), el("p", { className: "locator-note", text: locatorLabel(selected) === "未提供精确区域" ? "未提供精确区域" : "定位信息来自预处理结果" })]) : el("div", { className: "evidence-preview empty-preview", text: "选择内容位置后查看可追溯文本。" });
      const controls = [];
      if (caps.selectUpdateTemplate) {
        const template = templateSelect(catalog.updateTemplates, "detail-update-template"); template.value = material.updateTemplate?.id ?? "";
        controls.push(el("form", { className: "metadata-control", onSubmit: async event => { event.preventDefault(); await context.api(materialPath(context, `/${id}/update-template`), { method: "PATCH", mutation: true, body: { id: template.value, version: "1.0.0" } }); context.showToast("更新模板已记录"); await load(); } }, [el("label", { htmlFor: "detail-update-template", text: "材料用途" }), template, el("button", { type: "submit", className: "secondary-button", text: "保存材料用途" })]));
      }
      if (caps.createGenerationTask && material.status === "ready" && material.updateTemplate && Number(material.evidenceCount) > 0 && material.readiness?.status !== "blocked") controls.push(el("button", { type: "button", className: "primary-button", text: context.presentation.kind === "campaign" ? "生成作战更新建议" : "生成项目更新建议", onClick: event => openGenerationSheet(context, material, event.currentTarget) }));
      if (caps.retry && ["failed", "dependency_missing"].includes(material.status)) controls.push(el("button", { type: "button", className: "secondary-button", text: "重试处理", onClick: async () => { await context.api(materialPath(context, `/${id}/retry`), { method: "POST", mutation: true }); context.showToast("材料已进入重试队列"); await load(); } }));
      const readiness = material.readiness;
      const stepGuide = materialStepGuide(context, material, caps);
      root.replaceChildren(el("a", { className: "back-link", href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`, text: "← 返回项目材料", onClick: event => { event.preventDefault(); context.navigate(event.currentTarget.getAttribute("href")); } }), el("section", { className: "materials-detail-card" }, [el("header", { className: "material-detail-heading" }, [el("div", {}, [el("span", { className: "eyebrow", text: "材料内容" }), el("h1", { text: material.name })]), el("span", { className: `material-status status-${material.status}`, text: materialStatus[material.status] ?? material.status })]), detailMetadata(material), stepGuide, readiness ? el("section", { className: `readiness-panel readiness-${readiness.status}` }, [el("h2", { text: readinessText(material) }), el("p", { text: readiness.suggestion }), readiness.missing?.length ? el("ul", {}, readiness.missing.map(item => el("li", { text: `缺失：${item.label}` }))) : null, readiness.warnings?.length ? el("ul", {}, readiness.warnings.map(item => el("li", { text: `建议补充：${item.label}` }))) : null]) : null, el("p", { className: "material-boundary", text: "AI 只生成带来源的更新建议；不会修改项目草稿或发布版本。" }), controls.length ? el("div", { className: "material-detail-controls" }, controls) : null, el("div", { className: "evidence-layout" }, [el("aside", { ariaLabel: "内容位置索引" }, [index]), select, preview]) ]));
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(el("section", { className: "module-error error-panel", role: "alert" }, [el("h1", { text: error.status === 404 ? "材料不存在或你无权访问" : "无法加载材料详情" }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "secondary-button", text: "返回项目材料", onClick: () => context.navigate(`/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`) })]));
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
          else if (requestError.code === "AI_PROVIDER_DISABLED") error.textContent = "项目问答当前未启用；项目材料仍可正常使用。";
          else error.textContent = "暂时无法完成项目问答。已保留你的问题，请稍后重试。";
        } finally { if (!error.textContent.includes("配额已用完")) send.disabled = false; send.textContent = "发送问题"; }
      };
      const form = el("form", { className: "qa-form", onSubmit: event => { event.preventDefault(); void submit(); } }, [el("label", { htmlFor: "material-question", text: "问题" }), question, count, error, send]);
      question.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); } });
      const suggestionsNode = el("div", { className: "qa-suggestions", ariaLabel: "建议问题" }, suggestions.map(copy => el("button", { type: "button", className: "secondary-button", text: copy, onClick: () => { question.value = copy; question.dispatchEvent(new Event("input")); question.focus(); } })));
      const remaining = quota.usage?.remainingToday ?? ledger.usage?.chatRemainingToday ?? 0;
      root.replaceChildren(el("section", { className: "qa-boundary", text: "只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。" }), el("div", { className: "qa-layout" }, [el("aside", { className: "qa-context" }, [el("span", { className: "eyebrow", text: "READ-ONLY CONTEXT" }), el("h2", { text: context.project.name }), definitionList([["发布版本", context.version], ["授权材料", `${ledger.summary?.qaEnabledCount ?? 0} 项`], ["今日剩余", `${remaining} 次`], ["重置时间", quota.resetTime ? uiDate(quota.resetTime) : "服务端每日重置"]]), el("a", { href: `/projects/${encodeURIComponent(context.project.id)}/modules/materials?view=ledger`, text: "查看授权来源", onClick: event => { event.preventDefault(); context.navigate(event.currentTarget.getAttribute("href")); } })]), el("section", { className: "qa-panel" }, [el("header", {}, [el("span", { className: "eyebrow", text: "CITED PROJECT Q&A" }), el("h2", { text: qaLabel })]), ledger.summary?.qaEnabledCount ? suggestionsNode : el("p", { className: "empty-source", text: "暂无可用于问答的授权材料" }), conversation, form]) ]));
      if (remaining <= 0) { send.disabled = true; error.textContent = `本项目问答配额已用完，可在 ${quota.resetTime ? uiDate(quota.resetTime) : "配额重置"} 后继续提问。`; }
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: `无法加载${qaLabel}` }), el("p", { text: materialErrorMessage(error) }), el("button", { type: "button", className: "primary-button", text: "重新加载", onClick: load })]));
    } finally { root.setAttribute("aria-busy", "false"); }
  };
  void load();
}

const generationStateLabels = Object.freeze({ queued: "等待生成资源", retrieving_evidence: "锁定并整理材料内容", generating: "生成更新内容", repairing: "修复输出格式", validating: "执行服务端校验", succeeded: "更新建议已生成", failed_retryable: "生成暂时失败，可重试", failed_terminal: "生成失败，未创建建议", stale: "发布基准已变化" });
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
    const create=caps.create?el("button",{type:"button",className:"primary-button",text:campaign?"生成作战更新建议":"生成项目更新建议",onClick:event=>openGenerationSheet(context,null,event.currentTarget)}):null;
    // 一键全部生成按钮：当有创建权限时显示
    const batchBtn=caps.create?el("button",{type:"button",className:"secondary-button",text:campaign?"一键全部生成":"一键全部生成",title:"自动发现所有符合条件的材料，按模板分组批量生成",onClick:event=>openBatchSheet(context,event.currentTarget)}):null;
    const running=tasks.filter(item=>!["succeeded","failed_retryable","failed_terminal","stale"].includes(item.state)).length;
    const retryable=tasks.filter(item=>item.state==="failed_retryable").length;
    const stale=tasks.filter(item=>item.state==="stale").length;
    const proposalCards=proposals.map(item=>el("article",{className:"proposal-row"},[
      el("div",{},[el("span",{className:"eyebrow",text:"VALIDATED CHANGE PROPOSAL"}),el("h3",{text:`提案 ${item.proposalId}`}),el("p",{text:item.summary})]),
      definitionList([["基准版本",item.baseVersionLabel??item.baseVersionId],["模板",`${item.template?.id??"—"} · ${item.template?.version??"—"}`],["建议变更",`${item.changes?.length??0} 项`],["状态",proposalStatusLabels[item.status]??item.status]]),
      linkTo(context,proposalHref(context,item.proposalId),"查看更新建议","secondary-button")
    ]));
    const taskCards=tasks.map(item=>{const usage=generationUsage(item);return el("article",{className:"generation-task-row"},[
      el("div",{},[el("strong",{text:`任务 ${item.id}`}),el("span",{className:`generation-state state-${item.state}`,text:generationStateLabels[item.state]??item.state}),el("small",{text:`${item.template?.id??"—"} · ${item.baseVersionLabel??item.baseVersionId} · ${uiDate(item.createdAt)}`})]),
      el("div",{className:"generation-usage",text:`${usage.attempts} 次调用 · ${usage.tokens} Token · ${usage.cost}`}),linkTo(context,taskHref(context,item.id),"查看任务","secondary-button")]);});
    root.replaceChildren(el("section",{className:"materials-workspace-card proposal-workspace"},[
      el("header",{className:"proposal-workspace-header"},[el("div",{},[el("span",{className:"eyebrow",text:campaign?"作战更新建议":"项目更新建议"}),el("h2",{text:campaign?"作战更新建议":"项目更新建议"}),el("p",{text:"这些是经过服务端校验的更新建议，尚未应用到草稿，也未发布。"})]),el("div",{className:"proposal-workspace-actions"},[create,batchBtn])]),
      el("div",{className:"material-summary-grid"},[summaryCard("更新建议",proposals.length,"仅已通过校验"),summaryCard("处理中任务",running,"不会阻塞项目浏览"),summaryCard("可重试失败",retryable,"保留原任务记录"),summaryCard("基准已过期",stale,"不会自动改用新版本")]),
      el("p",{className:"material-boundary",text:"AI 只生成带来源的更新建议；不会修改项目草稿或发布版本。"}),
      el("section",{className:"proposal-list"},[el("h3",{text:"更新建议"}),...(proposalCards.length?proposalCards:[el("div",{className:"module-empty"},[el("h3",{text:"尚未生成结构化更新建议"}),el("p",{text:campaign?"从已就绪材料生成带来源的作战增量；不会修改草稿或发布状态。":"从已就绪材料生成带来源的项目增量；不会修改草稿或发布状态。"})])])]),
      el("section",{className:"generation-task-list"},[el("h3",{text:"生成任务"}),...(taskCards.length?taskCards:[el("p",{className:"empty-source",text:"尚无生成任务。"})])])
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h2",{text:"无法加载更新建议"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"primary-button",text:"重新加载提案",onClick:load})]));}finally{root.setAttribute("aria-busy","false");}};void load();
}

function renderGenerationTaskDetail(context, root) {
  const load=async()=>{root.setAttribute("aria-busy","true");try{const response=await context.api(generationPath(context,`/${encodeURIComponent(context.generationTaskId)}`));const task=response.task,usage=generationUsage(task);const steps=["queued","retrieving_evidence","generating","repairing","validating","succeeded"];const reached=steps.indexOf(task.state);const timeline=el("ol",{className:"generation-timeline"},steps.map((state,index)=>el("li",{className:index<=reached?"complete":""},[el("strong",{text:generationStateLabels[state]}),el("span",{text:index<reached||task.state==="succeeded"?"已完成":index===reached?"当前步骤":"等待"})])));
      const attempts=(task.attempts??[]).map(item=>el("tr",{},[el("td",{text:String(item.attemptNumber)}),el("td",{text:item.kind}),el("td",{text:item.outcome}),el("td",{text:`${item.inputTokens+item.outputTokens}`}),el("td",{text:item.costStatus==="priced"?`${item.currency??""} ${(Number(item.costMicros)/1_000_000).toFixed(6)}`:"未配置单价，仅记录 Token"}),el("td",{text:item.resultCode??"—"})]));
      const actions=[];if(task.proposalId)actions.push(linkTo(context,proposalHref(context,task.proposalId),"查看更新建议","primary-button"));if(response.capabilities?.retry&&["failed_retryable","stale"].includes(task.state))actions.push(el("button",{type:"button",className:"secondary-button",text:task.state==="stale"?"基于当前版本创建新任务":"重试生成",onClick:async()=>{const result=await context.api(generationPath(context,`/${encodeURIComponent(task.id)}/retry`),{method:"POST",mutation:true,body:{idempotencyKey:crypto.randomUUID()}});context.navigate(taskHref(context,result.task.id));}}));if(response.capabilities?.create&&task.state==="failed_terminal")actions.push(el("button",{type:"button",className:"primary-button",text:"重新生成建议",onClick:event=>openGenerationSheet(context,null,event.currentTarget)}));
      root.replaceChildren(linkTo(context,materialsUiPath(context,"?view=proposals"),"← 返回更新建议","back-link"),el("section",{className:"materials-detail-card generation-task-detail"},[
        el("header",{className:"material-detail-heading"},[el("div",{},[el("span",{className:"eyebrow",text:"GENERATION TASK"}),el("h1",{text:`生成任务 ${task.id}`})]),el("span",{className:`generation-state state-${task.state}`,text:generationStateLabels[task.state]??task.state})]),
        el("p",{className:"material-boundary",text:task.state==="stale"?"发布版本已变化；此任务不会自动改用新版本。":"更新生成只创建更新建议，不会修改项目草稿或发布版本。"}),
        el("div",{className:"generation-detail-layout"},[el("section",{},[el("h2",{text:"任务进程"}),timeline]),el("aside",{className:"generation-context-card"},[el("h2",{text:"锁定上下文"}),definitionList([["项目",task.projectId],["发布基准",`${task.baseVersionLabel} · ${task.baseVersionId}`],["模板",`${task.template.id} · ${task.template.version}`],["Schema",task.schemaVersion],["材料",`${task.materials.length} 份`],["证据",`${task.evidence.length} 块`],["Token",usage.tokens],["成本",usage.cost]])])]),
        task.errorCode?el("div",{className:"generation-error-detail"},[el("p",{className:"form-error",role:"alert",text:task.state==="failed_retryable"?"更新生成暂时失败，未影响项目数据。可以重试。":"模型输出未通过结构校验，未创建提案。"}),task.validation?.details?el("p",{className:"validation-detail",text:`具体原因：${task.validation.code}${task.validation.details.changeId?`（变更项 ${task.validation.details.changeId}）`:""}${task.validation.details.field?`，字段 ${task.validation.details.field}`:""}`}):null]):null,
        actions.length?el("div",{className:"material-detail-controls"},actions):null,
        attempts.length?el("div",{className:"table-scroll",tabIndex:0,role:"region",ariaLabel:"生成尝试与用量"},[el("table",{className:"module-table generation-attempt-table"},[el("caption",{text:"生成尝试、Token 与成本"}),el("thead",{},[el("tr",{},["次数","类型","结果","Token","成本","结果码"].map(label=>el("th",{scope:"col",text:label})))]),el("tbody",{},attempts)])]):null
      ]));
    }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h1",{text:error.status===404?"生成任务不存在或你无权访问":"无法加载生成任务"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"secondary-button",text:"返回更新建议",onClick:()=>context.navigate(materialsUiPath(context,"?view=proposals"))})]));}finally{root.setAttribute("aria-busy","false");}};void load();
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
    const acceptAll=reviewResponse.capabilities.review&&reviewResponse.capabilities.pending>0?el("button",{type:"button",className:"primary-button",text:"全部接受",onClick:async()=>{try{for(const module of modules){await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/review/modules/${encodeURIComponent(module)}`),{method:"POST",mutation:true});}context.showToast("全部变更项已接受");await load();}catch(error){context.showToast(error.message);}}}):null;
    const moduleActions=reviewResponse.capabilities.review?el("div",{className:"module-review-actions"},[acceptAll,...modules.map(module=>el("button",{type:"button",className:"ghost-button",text:`接受 ${module} 模块`,onClick:async()=>{try{await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/review/modules/${encodeURIComponent(module)}`),{method:"POST",mutation:true});context.showToast(`${module} 模块已接受`);await load();}catch(error){context.showToast(error.message);}}}))]):null;
    const merge=reviewResponse.capabilities.merge?el("button",{type:"button",className:"primary-button",text:"应用到草稿",onClick:async()=>{try{const result=await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/merge`),{method:"POST",mutation:true,body:{}});context.showToast(`已生成独立草稿 ${result.draft.versionLabel}`);await load();}catch(error){context.showToast(error.message);}}}):null;
    const warnings=[...(proposal.warnings??[]),...(selected.warnings??[])];
    // 路线图预览区：可折叠
    const previewToggle=el("button",{type:"button",className:"secondary-button roadmap-preview-toggle",text:"查看路线图预览 ▸",onClick:async event=>{
      const btn=event.currentTarget,container=btn.nextElementSibling;
      if(container.children.length){container.replaceChildren();btn.textContent="查看路线图预览 ▸";return;}
      btn.textContent="加载中…";btn.disabled=true;
      try{
        const previewData=await context.api(proposalPath(context,`/${encodeURIComponent(proposal.proposalId)}/preview/modules/roadmap`));
        const cm=previewData.changeMarkers??{},data=previewData.data??{};
        const tasks=data.tasks??[],stages=data.stages??[],units=data.units??[];
        const addedSet=new Set(cm.added??[]),modifiedSet=new Set(cm.modified??[]),removedSet=new Set(cm.removed??[]);
        const taskMarkers=new Map();
        for(const id of addedSet)taskMarkers.set(id,"added");
        for(const id of modifiedSet)taskMarkers.set(id,"modified");
        // 渲染预览卡片（简化版路线图）
        const stageColumns=stages.map(stage=>{
          const stageTasks=tasks.filter(t=>t.unitId&&units.some(u=>u.id===t.unitId)).filter(t=>true); // 暂用全部任务
          return el("div",{className:"roadmap-preview-column"},[
            el("h4",{text:stage.title||stage.id}),
            el("small",{text:stage.dateLabel||""}),
            el("div",{className:"roadmap-preview-tasks"},tasks.filter(t=>true).slice(0,20).map(t=>{
              const marker=taskMarkers.get(t.id);
              return el("div",{className:`roadmap-preview-task${marker?" marker-"+marker:""}`},[
                el("strong",{text:t.title||t.id}),
                el("small",{text:`${t.owner?t.owner+" · ":""}${t.state||""} ${t.progress!=null?Math.round(t.progress)+"%":""}`}),
                marker==="added"?el("span",{className:"task-marker marker-added",text:"新增"}):null,
                marker==="modified"?el("span",{className:"task-marker marker-modified",text:"变更"}):null
              ]);
            }))
          ]);
        });
        const summary=el("div",{className:"roadmap-preview-summary"},[
          el("span",{text:`预览版本：${previewData.version||""}`}),
          el("span",{text:`${cm.added?.length||0} 新增 · ${cm.modified?.length||0} 变更 · ${cm.removed?.length||0} 删除`}),
          previewData.pendingCount>0?el("span",{className:"roadmap-preview-notice",text:`（${previewData.pendingCount} 项待审核，预览包含全部建议）`}):null
        ]);
        container.replaceChildren(el("section",{className:"roadmap-preview-container"},[
          el("h4",{text:"路线图预览（投影后效果）"}),
          summary,
          el("div",{className:"roadmap-preview-legend"},[
            el("span",{className:"task-marker marker-added",text:"新增"}),
            el("span",{className:"task-marker marker-modified",text:"变更"})
          ]),
          el("div",{className:"roadmap-preview-board"},stageColumns.length?stageColumns:[el("p",{text:"暂无阶段数据"})])
        ]));
        btn.textContent="收起路线图预览 ▾";btn.disabled=false;
      }catch(error){btn.textContent="查看路线图预览 ▸";btn.disabled=false;container.replaceChildren(el("p",{className:"form-error",text:`无法加载预览：${error.message}`}));
      }
    }});
    const previewContainer=el("div",{className:"roadmap-preview-wrapper"});
    root.replaceChildren(linkTo(context,materialsUiPath(context,"?view=proposals"),"← 返回更新建议","back-link"),el("section",{className:"materials-detail-card proposal-detail review-detail"},[
      el("header",{className:"material-detail-heading"},[el("div",{},[el("span",{className:"eyebrow",text:"人工审核 · 变更建议"}),el("h1",{text:`审核提案 ${proposal.proposalId}`})]),el("span",{className:`review-state review-${selected.review?.decision??"pending"}`,text:reviewLabels[selected.review?.decision??"pending"]})]),
      el("p",{className:"material-boundary",text:`基准为发布版本 ${proposal.baseVersionLabel??proposal.baseVersionId}。接受只记录审核决定；只有“事务合并到草稿”才会创建新的草稿版本。`}),
      el("p",{className:"validation-pass",text:"服务端校验结果：Schema、项目归属、证据、日期与依赖检查均已通过；审核编辑会再次校验。"}),
      el("div",{className:"review-summary-grid"},[summaryCard("待决定",reviewResponse.capabilities.pending,"必须逐项完成"),summaryCard("已接受",reviewResponse.capabilities.accepted,"等待事务合并"),summaryCard("已驳回",reviewResponse.capabilities.rejected,"保留审核记录"),summaryCard("应用到草稿",reviewResponse.merged?"已完成":"未执行","不会直接发布")]),
      moduleActions,
      previewToggle,previewContainer,
      el("div",{className:"proposal-detail-layout"},[index,el("article",{className:"proposal-change-card",ariaLive:"polite"},[
        el("header",{},[el("span",{className:"eyebrow",text:selected.module}),el("h2",{text:`${operationLabels[selected.operation]} · ${selected.targetId}`})]),
        definitionList([["changeId",selected.changeId],["语义类型",semanticLabels[selected.semanticType]??selected.semanticType],["置信度",`${selected.confidence>=.8?"高":selected.confidence>=.6?"中":"低"}（${Number(selected.confidence).toFixed(2)}）`],["审核人",selected.review?.reviewedByName??"待审核"]]),
        el("h3",{text:"变更字段差异"}),
        el("div",{className:"review-diff-grid"},[el("section",{},[el("h3",{text:"原值"}),selected.operation==="create"?el("p",{className:"empty-source",text:"新增项没有原值"}):el("dl",{className:"proposal-patch-fields"},originalRows.flatMap(([key,value])=>[el("dt",{text:key}),el("dd",{text:valueText(value)})]))]),el("section",{},[el("h3",{text:selected.review?.editedPatch?"审核编辑值":"建议值"}),el("dl",{className:"proposal-patch-fields"},suggestedRows.flatMap(([key,value])=>[el("dt",{text:key}),el("dd",{text:valueText(value)})]))])]),
        el("h3",{text:"引用内容"}),evidenceList,
        warnings.length?el("section",{className:"proposal-warnings"},[el("h3",{text:"警告"}),el("ul",{},[...new Set(warnings)].map(code=>el("li",{text:code})))]):el("p",{className:"validation-pass",text:"该项没有额外警告。"}),
        actions.length?el("div",{className:"review-actions"},actions):null
      ])]),
      merge?el("footer",{className:"merge-bar"},[el("div",{},[el("strong",{text:"所有变更已完成审核"}),el("p",{text:"合并会以当前草稿为源创建新草稿；任一校验失败将整体回滚。"})]),merge]):null
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h1",{text:error.status===404?"更新建议不存在或你无权访问":"无法加载更新建议"}),el("p",{text:generationErrorMessage(error)}),el("button",{type:"button",className:"secondary-button",text:"返回更新建议",onClick:()=>context.navigate(materialsUiPath(context,"?view=proposals"))})]));}finally{root.setAttribute("aria-busy","false");}};void load();
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
    root.replaceChildren(el("section",{className:"materials-workspace-card release-center"},[
      el("header",{className:"proposal-workspace-header"},[el("div",{},[el("span",{className:"eyebrow",text:campaign?"审核与发布中心":"审核与发布中心"}),el("h2",{text:campaign?"审核与发布":"审核发布中心"}),el("p",{text:"固定渲染器提供草稿预览、检查清单、发布和直接前驱回滚；AI 无法执行这些动作。"})])]),
      el("div",{className:"release-version-grid"},[summaryCard("当前发布",preview.published.versionLabel,`${preview.published.tasks} ${context.presentation.task}`),summaryCard("当前草稿",preview.draft.versionLabel,`${preview.draft.tasks} ${context.presentation.task}`),summaryCard("待发布差异",preview.changes.count,"按模块确定性计算"),summaryCard("未决定审核",preview.checklist.unresolvedReviewItems,"发布前必须人工核对")]),
      el("div",{className:"release-layout"},[previewCard,actionCard]),
      el("section",{className:"release-operations-grid"},[el("div",{},[el("h3",{text:"发布历史"}),historyNode]),el("div",{},[el("h3",{text:"项目成员"}),membersNode])]),
      auditNode
    ]));
  }catch(error){if(error.message==="AUTHENTICATION_REQUIRED")return;root.replaceChildren(el("section",{className:"module-error error-panel",role:"alert"},[el("h2",{text:"无法加载审核发布中心"}),el("p",{text:error.message}),el("button",{type:"button",className:"primary-button",text:"重新加载",onClick:load})]));}finally{root.setAttribute("aria-busy","false");}};void load();
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
      root.replaceChildren(el("section", { className: "materials-workspace-card diagnostics-center" }, [
        el("header", { className: "proposal-workspace-header" }, [el("div", {}, [el("span", { className: "eyebrow", text: "OPERATIONS & TEST CENTER" }), el("h2", { text: "运维自检" }), el("p", { text: "管理员可运行安全自检，并用 requestId 查询脱敏错误堆栈和关联上下文。" })]), runButton]),
        el("div", { className: "release-operations-grid" }, [
          el("section", {}, [el("h3", { text: "产品内测试运行" }), runItems.length ? el("div", { className: "diagnostic-list" }, runItems) : el("p", { className: "empty-source", text: "尚无测试运行记录。" })]),
          el("section", {}, [el("h3", { text: "最近错误事件" }), errorItems.length ? el("div", { className: "diagnostic-list" }, errorItems) : el("p", { className: "empty-source", text: "当前项目暂无记录的 5xx 错误。" })])
        ])
      ]));
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      root.replaceChildren(el("section", { className: "module-error error-panel", role: "alert" }, [el("h2", { text: "无法加载运维自检" }), el("p", { text: error.message }), el("button", { type: "button", className: "primary-button", text: "重新加载", onClick: load })]));
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
  else if (context.query.get("view") === "proposals") renderProposalWorkspace(context, root);
  else if (context.query.get("view") === "release") renderReleaseCenter(context, root);
  else if (context.query.get("view") === "operations") renderOperationsCenter(context, root);
  else renderLedger(context, root);
  return root;
}
