const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  session: null,
  intendedPath: null,
  expiryMessage: "",
  projects: [],
  recent: [],
  searchTimer: null,
  dialogReturnFocus: null
};

const roleLabels = Object.freeze({
  platform_admin: "平台管理员",
  project_admin: "项目管理员",
  project_editor: "项目编辑者",
  viewer: "查看者"
});

const templateLabels = Object.freeze({
  "campaign-map-v1": "作战地图模板",
  "standard-project-v1": "标准项目模板"
});

function projectPresentation(project = {}) {
  const terminologyPreset = project.terminology?.preset;
  const campaign = terminologyPreset ? terminologyPreset === "campaign" : project.templateId === "campaign-map-v1";
  const terms = project.terminology ?? {};
  return campaign ? {
    kind: "campaign",
    symbol: project.id === "xugu-agentic-group" ? "虚" : (project.name?.trim()?.[0] || "战"),
    scheduleTitle: project.id === "xugu-agentic-group" ? "XUGU AGENTIC GROUP SCHEDULE" : "AGENTIC GROUP SCHEDULE",
    homeLabel: "项目作战台",
    overviewLabel: "作战总览",
    heroKicker: "OVERALL MISSION · 总作战目标",
    currentKicker: "CURRENT CAMPAIGN",
    unit: terms.unit || "作战单元",
    task: terms.task || "行动任务",
    stage: terms.stage || "战役节点",
    outcome: terms.outcome || "战果闭环",
    workstream: "公司级战线",
    modules: ["作战总览", "作战单元", "战役路线", "任务网络", "作战甘特", "战果档案", "风险", "指标", "材料"]
  } : {
    kind: "standard",
    symbol: project.name?.trim()?.[0] || "项",
    scheduleTitle: "STANDARD PROJECT SCHEDULE",
    homeLabel: "项目中心",
    overviewLabel: "项目总览",
    heroKicker: "PROJECT OVERVIEW · 项目目标",
    currentKicker: "CURRENT STATUS",
    unit: terms.unit || "团队",
    task: terms.task || "任务",
    stage: terms.stage || "里程碑",
    outcome: terms.outcome || "交付物",
    workstream: "工作流",
    modules: ["项目总览", "团队", "里程碑", "任务网络", "甘特", "交付物", "风险", "指标", "材料"]
  };
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  let deferredValue;
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "value" && tag === "select") deferredValue = value;
    else if (key in node && !key.startsWith("aria")) node[key] = value;
    else if (key.startsWith("aria") && key.length > 4) node.setAttribute(`aria-${key.slice(4).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, "")}`, String(value));
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  if (deferredValue !== undefined) node.value = deferredValue;
  return node;
}

function iconButton(label, text, onClick, className = "ghost-button") {
  return element("button", { type: "button", className, ariaLabel: label, text, onClick });
}

function safeIntendedPath(pathname = location.pathname) {
  return /^\/projects(?:\/[a-z0-9][a-z0-9._-]{2,63})?$/.test(pathname) ? pathname : "/projects";
}

function formatDate(value) {
  if (!value) return "暂无更新时间";
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(instant);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  void renderRoute();
}

function clearSensitiveView() {
  state.projects = [];
  state.recent = [];
  app.replaceChildren();
}

function handleExpired() {
  if (location.pathname !== "/login") state.intendedPath = safeIntendedPath();
  state.session = null;
  state.expiryMessage = "会话已过期，请重新登录";
  clearSensitiveView();
  history.replaceState({}, "", "/login");
  renderLogin();
}

async function api(path, options = {}) {
  const headers = { accept: "application/json", ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.mutation && state.session?.csrfToken) headers["x-csrf-token"] = state.session.csrfToken;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({ error: "服务器返回了无法识别的响应" }));
  if (response.status === 401 && !options.allowUnauthorized) {
    handleExpired();
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  if (!response.ok) {
    const error = new Error(payload.error ?? "请求失败，请稍后重试");
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function renderLogin() {
  document.title = "登录 · AI 项目作战管理平台";
  const loginName = element("input", { id: "login-name", name: "loginName", autocomplete: "username", required: true, placeholder: "例如：admin" });
  const password = element("input", { id: "login-password", name: "password", type: "password", autocomplete: "current-password", required: true });
  const error = element("p", { className: "form-error", role: "alert", text: state.expiryMessage });
  const submit = element("button", { type: "submit", className: "primary-button login-submit", text: "登录平台" });
  const form = element("form", {
    ariaLabel: "平台登录",
    onSubmit: async event => {
      event.preventDefault();
      error.textContent = "";
      submit.disabled = true;
      submit.textContent = "正在登录…";
      try {
        state.session = await api("/api/login", {
          method: "POST",
          body: { loginName: loginName.value.trim(), password: password.value },
          allowUnauthorized: true
        });
        password.value = "";
        state.expiryMessage = "";
        const target = state.intendedPath ?? "/projects";
        state.intendedPath = null;
        navigate(target, { replace: true });
      } catch (requestError) {
        password.value = "";
        error.textContent = requestError.message === "AUTHENTICATION_REQUIRED" ? "账号或密码不正确" : requestError.message;
        password.focus();
      } finally {
        submit.disabled = false;
        submit.textContent = "登录平台";
      }
    }
  }, [
    element("div", { className: "field" }, [element("label", { htmlFor: "login-name", text: "账号" }), loginName]),
    element("div", { className: "field" }, [element("label", { htmlFor: "login-password", text: "密码" }), password]),
    error,
    submit
  ]);
  const trust = element("ul", { className: "trust-list" }, [
    element("li", { text: "项目级数据与权限隔离" }),
    element("li", { text: "变更依据与来源可追踪" }),
    element("li", { text: "发布始终由人审核控制" })
  ]);
  app.replaceChildren(element("main", { className: "login-screen" }, [
    element("section", { className: "login-brand", ariaLabel: "产品介绍" }, [
      element("div", { className: "product-lockup" }, [element("div", { className: "brand-mark", ariaHidden: "true", text: "AI" }), element("span", { text: "PROJECT COMMAND" })]),
      element("div", { className: "brand-copy" }, [
        element("span", { className: "eyebrow", text: "ONE PLATFORM · MANY MISSIONS" }),
        element("h2", { text: "让每个项目都有清晰的作战现场" }),
        element("p", { text: "统一组织项目、团队与事实数据，让 AI 辅助更新始终可审计、可审核、可回退。" }),
        trust
      ]),
      element("div", { className: "brand-foot", text: "内部项目环境 · 请使用管理员分配的账号" })
    ]),
    element("section", { className: "login-form-panel" }, [
      element("div", { className: "login-form-wrap" }, [
        element("span", { className: "eyebrow", text: "WELCOME BACK" }),
        element("h1", { text: "登录项目作战平台" }),
        element("p", { text: "进入你获授权的项目空间。" }),
        form,
        element("p", { className: "form-note", text: "首次部署请由运维人员在服务端配置启动管理员密码；浏览器不会生成或展示该密码。" })
      ])
    ])
  ]));
  loginName.focus();
}

function appFrame(mainContent, options = {}) {
  const user = state.session.user;
  const project = options.project;
  const presentation = options.presentation ?? projectPresentation(project);
  const logout = async () => {
      try { await api("/api/logout", { method: "POST", mutation: true }); } catch (error) { if (error.message === "AUTHENTICATION_REQUIRED") return; }
      state.session = null;
      state.intendedPath = null;
      state.expiryMessage = "";
      clearSensitiveView();
      history.replaceState({}, "", "/login");
      renderLogin();
    };
  const brandDestination = project ? `/projects/${encodeURIComponent(project.id)}` : "/projects";
  const brandLink = element("a", { className: "public-brand", href: brandDestination, onClick: event => { event.preventDefault(); navigate(brandDestination); } }, [
    element("span", { className: "brand-symbol", ariaHidden: "true", text: project ? presentation.symbol : "AI" }),
    element("span", { className: "brand-title" }, [
      element("strong", { text: project?.name ?? "AI 项目作战管理平台" }),
      element("small", { text: project ? presentation.scheduleTitle : "AI PROJECT COMMAND PLATFORM" })
    ])
  ]);
  const navigation = element("nav", { className: "public-nav", ariaLabel: "全局导航" }, [
    element("a", { className: options.projectMode ? "" : "active", href: "/projects", text: "项目作战台", onClick: event => { event.preventDefault(); navigate("/projects"); } }),
    ...(options.projectMode ? [element("a", { className: "active", href: location.pathname, text: presentation.overviewLabel })] : []),
    element("span", { className: "nav-future", text: "模块中心 · 即将开放" })
  ]);
  const actions = element("div", { className: "header-actions" }, [
    ...(options.switcher ? [element("div", { className: "header-switcher" }, [element("span", { text: "当前项目" }), options.switcher])] : []),
    element("span", { className: "update-time" }, [element("i", { ariaHidden: "true" }), element("span", { text: user.displayName })]),
    iconButton("退出登录", "退出", logout, "admin-entry")
  ]);
  return element("div", { className: "public-app app-shell" }, [
    element("header", { className: "public-header" }, [brandLink, navigation, actions]),
    element("main", { className: "public-main content" }, [mainContent])
  ]);
}

function statusControls(current, onSelect) {
  const choices = state.session.user.isPlatformAdmin
    ? [["active", "进行中"], ["archived", "已归档"], ["all", "全部"]]
    : [["active", "进行中"]];
  return element("div", { className: "segmented", role: "group", ariaLabel: "项目状态" }, choices.map(([value, label]) => element("button", {
    type: "button",
    className: current === value ? "active" : "",
    ariaPressed: current === value ? "true" : "false",
    text: label,
    onClick: () => onSelect(value)
  })));
}

function projectCard(project, { recent = false, refresh } = {}) {
  const isArchived = project.status === "archived";
  const presentation = projectPresentation(project);
  const title = element("h3");
  if (isArchived) title.textContent = project.name;
  else title.append(element("a", {
    href: `/projects/${encodeURIComponent(project.id)}`,
    text: project.name,
    onClick: event => { event.preventDefault(); navigate(`/projects/${encodeURIComponent(project.id)}`); }
  }));
  const card = element("article", { className: `project-card${isArchived ? " archived" : ""}${recent ? " recent-card" : ""}` }, [
    element("div", { className: "card-top" }, [
      element("span", { className: "template-label", text: templateLabels[project.templateId] ?? project.templateId }),
      element("span", { className: `badge ${isArchived ? "archived" : "active"}`, text: isArchived ? "已归档" : "进行中" })
    ]),
    title,
    element("div", { className: "project-id", text: project.id }),
    element("p", { className: "card-summary", text: project.summary || "暂无正式项目摘要" }),
    element("div", { className: "card-meta" }, [
      element("span", { text: project.publishedVersion || "未发布" }),
      element("span", { text: `更新于 ${formatDate(project.updatedAt)}` })
    ]),
    element("footer", { className: "card-footer" }, [
      element("span", { text: `${project.unitCount} ${presentation.unit}` }),
      element("span", { text: `${project.taskCount} ${presentation.task}` }),
      element("span", { text: `${project.stageCount} ${presentation.stage}` }),
      element("span", { className: "badge role", text: roleLabels[project.role] ?? project.role })
    ])
  ]);
  if (state.session.user.isPlatformAdmin && !recent) {
    const actions = element("div", { className: "card-actions" });
    if (isArchived) actions.append(iconButton(`恢复 ${project.name}`, "恢复项目", () => openRestoreDialog(project, refresh)));
    else {
      actions.append(iconButton(`编辑 ${project.name}`, "编辑", () => openEditDialog(project, refresh)));
      actions.append(iconButton(`归档 ${project.name}`, "归档", () => openArchiveDialog(project, refresh)));
    }
    card.append(actions);
  }
  return card;
}

function queryFilters() {
  const params = new URLSearchParams(location.search);
  const status = ["active", "archived", "all"].includes(params.get("status")) ? params.get("status") : "active";
  return {
    q: params.get("q") ?? "",
    status: state.session.user.isPlatformAdmin ? status : "active",
    sort: ["recent", "name", "updated"].includes(params.get("sort")) ? params.get("sort") : "recent"
  };
}

function writeFilters(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "active") params.set("status", filters.status);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  const query = params.toString();
  history.replaceState({}, "", `/projects${query ? `?${query}` : ""}`);
}

async function renderProjects() {
  document.title = "项目作战台 · AI 项目作战管理平台";
  let filters = queryFilters();
  const results = element("div", { className: "project-grid", ariaLive: "polite", ariaBusy: "true" }, Array.from({ length: 6 }, () => element("div", { className: "project-card skeleton", ariaHidden: "true" })));
  const recentSection = element("section", { hidden: true });
  const search = element("input", { id: "project-search", type: "search", value: filters.q, placeholder: "搜索项目名称或稳定 ID" });
  const clear = iconButton("清除搜索条件", "×", () => {
    search.value = "";
    clear.hidden = true;
    filters.q = "";
    writeFilters(filters);
    void load();
    search.focus();
  }, "clear-search");
  clear.hidden = !filters.q;
  search.addEventListener("input", () => {
    clear.hidden = !search.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      filters.q = search.value.trim();
      writeFilters(filters);
      void load();
    }, 220);
  });
  const statusSlot = element("div");
  const renderStatus = () => statusSlot.replaceChildren(statusControls(filters.status, value => {
    filters.status = value;
    writeFilters(filters);
    renderStatus();
    void load();
  }));
  renderStatus();
  const sort = element("select", { id: "project-sort", value: filters.sort, onChange: () => {
    filters.sort = sort.value;
    writeFilters(filters);
    void load();
  } }, [
    element("option", { value: "recent", text: "最近访问" }),
    element("option", { value: "name", text: "按名称" }),
    element("option", { value: "updated", text: "最近更新" })
  ]);
  const filterBar = element("section", { className: "filter-bar", ariaLabel: "项目筛选" }, [
    element("div", { className: "field" }, [element("label", { htmlFor: "project-search", text: "搜索项目" }), element("div", { className: "search-wrap" }, [search, clear])]),
    statusSlot,
    element("div", { className: "field" }, [element("label", { htmlFor: "project-sort", text: "排序方式" }), sort])
  ]);
  const refresh = () => load();
  const page = element("div", {}, [
    element("header", { className: "page-head command-center-hero" }, [
      element("div", {}, [
        element("span", { className: "eyebrow", text: "PROJECT COMMAND CENTER" }),
        element("h1", { text: "项目作战台" }),
        element("p", { text: "查看获授权的项目，快速切换作战现场，并管理平台级项目生命周期。" })
      ]),
      element("div", { className: "head-actions" }, [
        element("div", { className: "command-orbit", ariaHidden: "true" }, [element("i"), element("b", { text: "PLAN" })]),
        element("div", { className: "command-status" }, [
          element("small", { text: "MULTI-PROJECT COMMAND" }),
          element("strong", { text: "统一项目作战现场" }),
          element("span", { className: "count-pill", id: "active-project-count", text: "正在载入项目" })
        ]),
        ...(state.session.user.isPlatformAdmin ? [element("button", { type: "button", className: "primary-button", text: "新建项目", onClick: () => openCreateDialog(refresh) })] : [])
      ])
    ]),
    filterBar,
    recentSection,
    element("section", {}, [
      element("div", { className: "section-head" }, [element("h2", { text: "全部项目" }), element("p", { id: "result-summary", text: "正在加载授权项目" })]),
      results
    ])
  ]);
  app.replaceChildren(appFrame(page));

  async function load() {
    results.setAttribute("aria-busy", "true");
    try {
      const params = new URLSearchParams(filters);
      const payload = await api(`/api/projects?${params.toString()}`);
      state.projects = payload.projects;
      state.recent = payload.recent;
      results.replaceChildren();
      document.querySelector("#active-project-count").textContent = `${payload.activeCount} 个进行中项目`;
      document.querySelector("#result-summary").textContent = `找到 ${payload.projects.length} 个项目`;
      if (payload.projects.length === 0) {
        const hasSearch = Boolean(filters.q);
        results.append(element("div", { className: "empty-panel" }, [
          element("h2", { text: hasSearch ? "没有找到匹配项目" : "暂时没有获授权的项目" }),
          element("p", { text: hasSearch ? "尝试其他名称或稳定 ID。" : "请联系平台管理员或项目管理员授予项目访问权限。" }),
          ...(hasSearch ? [element("button", { type: "button", className: "secondary-button", text: "清除搜索条件", onClick: () => clear.click() })] : [])
        ]));
      } else {
        payload.projects.forEach(project => results.append(projectCard(project, { refresh })));
      }
      if (payload.recent.length > 0 && filters.status === "active" && !filters.q) {
        recentSection.hidden = false;
        recentSection.replaceChildren(
          element("div", { className: "section-head" }, [element("h2", { text: "最近访问" }), element("p", { text: "最多显示四个项目" })]),
          element("div", { className: "project-grid recent" }, payload.recent.map(project => projectCard(project, { recent: true })))
        );
      } else {
        recentSection.hidden = true;
        recentSection.replaceChildren();
      }
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED") return;
      results.replaceChildren(element("div", { className: "error-panel" }, [
        element("h2", { text: "项目加载失败" }),
        element("p", { text: error.message }),
        element("button", { type: "button", className: "secondary-button", text: "重新加载项目", onClick: () => load() })
      ]));
    } finally {
      results.setAttribute("aria-busy", "false");
    }
  }
  await load();
}

function projectSwitcher(projects, currentId) {
  const select = element("select", { ariaLabel: "切换项目", value: currentId, onChange: () => navigate(`/projects/${encodeURIComponent(select.value)}`) }, projects
    .filter(project => project.status === "active")
    .map(project => element("option", { value: project.id, text: project.name })));
  return select;
}

async function renderProject(projectId) {
  document.title = "项目概览 · AI 项目作战管理平台";
  const loading = element("div", { className: "empty-panel" }, [element("h1", { text: "正在加载项目" }), element("p", { text: "正在读取已发布项目事实…" })]);
  app.replaceChildren(appFrame(loading));
  try {
    const [detail, list] = await Promise.all([
      api(`/api/projects/${encodeURIComponent(projectId)}/public`),
      api("/api/projects?status=active&sort=recent")
    ]);
    const { project, snapshot } = detail;
    const presentation = projectPresentation(project);
    const currentStageLabel = snapshot.currentStage != null && !/^\d+$/.test(String(snapshot.currentStage))
      ? String(snapshot.currentStage)
      : snapshot.statusLabel || "待配置";
    state.projects = list.projects;
    document.title = `${project.name} · ${presentation.overviewLabel}`;
    const counts = [
      [snapshot.groups?.length ?? 0, presentation.unit],
      [snapshot.tasks?.length ?? 0, presentation.task],
      [snapshot.stages?.length ?? 0, presentation.stage],
      [snapshot.companyWorkstreams?.length ?? 0, presentation.workstream]
    ];
    const navigation = presentation.modules.map((label, index) => [label, index !== 0]);
    const projectNav = element("nav", { className: "project-nav section-card", ariaLabel: "项目模块" }, [
      element("h2", { text: "项目模块" }),
      element("ul", {}, navigation.map(([label, future]) => element("li", { className: future ? "" : "active", ariaCurrent: future ? undefined : "page" }, [
        element("span", { text: label }),
        ...(future ? [element("small", { text: "即将开放" })] : [])
      ])))
    ]);
    const overview = element("div", {}, [
      element("nav", { className: "breadcrumb", ariaLabel: "面包屑" }, [
        element("a", { href: "/projects", text: "Projects", onClick: event => { event.preventDefault(); navigate("/projects"); } }),
        element("span", { ariaHidden: "true", text: "/" }),
        element("span", { text: project.name })
      ]),
      element("section", { className: "project-hero goal-hero" }, [
        element("div", { className: "hero-copy goal-copy" }, [
          element("span", { className: "single-goal", text: presentation.heroKicker }),
          element("h1", { text: project.name }),
          element("div", { className: "project-id", text: project.id }),
          element("p", { text: snapshot.summary || snapshot.goal || "暂无正式项目摘要" }),
          element("div", { className: "hero-badges goal-tags" }, [
            element("span", { className: "badge active", text: "进行中" }),
            element("span", { className: "badge role", text: roleLabels[project.role] ?? project.role }),
            element("span", { className: "badge version", text: project.publishedVersion }),
            element("span", { className: "badge archived", text: templateLabels[project.templateId] ?? project.templateId })
          ])
        ]),
        element("aside", { className: "overall-card campaign-status-card" }, [
          element("div", { className: "planning-orbit", ariaHidden: "true" }, [element("i"), element("b", { text: "PLAN" })]),
          element("div", { className: "overall-copy" }, [
            element("small", { text: presentation.currentKicker }),
            element("b", { text: currentStageLabel }),
            element("span", { text: snapshot.statusLabel || "依据已发布项目事实推进当前行动" }),
            element("div", { className: "planning-badge", text: snapshot.overallProgress == null ? "当前按正式材料推进 · 不虚构完成比例" : `正式完成率 ${snapshot.overallProgress}%` })
          ]),
          element("img", { src: "/assets/transformation-group-transparent-v2.png", alt: `${project.name}${presentation.unit}示意` })
        ])
      ]),
      element("section", { className: "fact-grid", ariaLabel: "项目事实计数" }, counts.map(([value, label]) => element("article", { className: "fact-card" }, [element("strong", { text: String(value) }), element("span", { text: label })]))),
      element("div", { className: "detail-grid" }, [
        element("section", { className: "detail-panel" }, [
          element("h2", { text: "当前状态" }),
          element("dl", { className: "detail-list" }, [
            element("dt", { text: "状态说明" }), element("dd", { text: snapshot.statusLabel || "暂无状态说明" }),
            element("dt", { text: "当前阶段" }), element("dd", { text: currentStageLabel }),
            element("dt", { text: "正式完成率" }), element("dd", { text: snapshot.overallProgress == null ? "暂无正式完成率" : `${snapshot.overallProgress}%` }),
            element("dt", { text: "更新时间" }), element("dd", { text: formatDate(snapshot.updatedAt || project.updatedAt) }),
            element("dt", { text: "发布版本" }), element("dd", { text: project.publishedVersion })
          ])
        ]),
        element("section", { className: "detail-panel" }, [
          element("h2", { text: "项目边界" }),
          element("p", { className: "boundary-note", text: "当前页面只读取已发布数据。草稿编辑、审核与发布属于后续受控工作流，本阶段不会直接修改 published。" })
        ])
      ])
    ]);
    const content = element("div", { className: "project-layout" }, [projectNav, overview]);
    app.replaceChildren(appFrame(content, { projectMode: true, project, presentation, switcher: projectSwitcher(list.projects, project.id) }));
  } catch (error) {
    if (error.message === "AUTHENTICATION_REQUIRED") return;
    const notFound = error.status === 404;
    const panel = element("div", { className: "error-panel" }, [
      element("h1", { text: notFound ? "项目不存在或你无权访问" : "项目加载失败" }),
      element("p", { text: notFound ? "请检查地址或返回项目列表。" : error.message }),
      element("button", { type: "button", className: "secondary-button", text: notFound ? "返回项目列表" : "重新加载项目", onClick: () => notFound ? navigate("/projects") : renderProject(projectId) })
    ]);
    app.replaceChildren(appFrame(panel));
  }
}

function openDialog({ title, copy, fields = [], submitLabel, destructive = false, onSubmit }) {
  state.dialogReturnFocus = document.activeElement;
  const error = element("p", { className: "form-error", role: "alert" });
  const close = () => {
    backdrop.remove();
    state.dialogReturnFocus?.focus?.();
  };
  const closeButton = iconButton("关闭对话框", "×", close, "dialog-close");
  const cancel = element("button", { type: "button", className: "secondary-button", text: "取消", onClick: close });
  const submit = element("button", { type: "submit", className: destructive ? "danger-button" : "primary-button", text: submitLabel });
  const form = element("form", { onSubmit: async event => {
    event.preventDefault();
    error.textContent = "";
    submit.disabled = true;
    cancel.disabled = true;
    closeButton.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      close();
    } catch (requestError) {
      if (requestError.message !== "AUTHENTICATION_REQUIRED") error.textContent = requestError.message;
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
      closeButton.disabled = false;
    }
  } }, [
    ...fields,
    error,
    element("div", { className: "dialog-actions" }, [cancel, submit])
  ]);
  const dialog = element("section", { className: "dialog", role: "dialog", ariaModal: "true", ariaLabelledby: "dialog-title" }, [
    element("header", {}, [element("h2", { id: "dialog-title", text: title }), closeButton]),
    element("p", { className: "dialog-copy", text: copy }),
    form
  ]);
  const backdrop = element("div", { className: "dialog-backdrop" }, [dialog]);
  backdrop.addEventListener("keydown", event => {
    if (event.key === "Escape" && !submit.disabled) close();
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.body.append(backdrop);
  const initial = dialog.querySelector("input, select, button");
  initial?.focus();
}

function fieldControl({ id, name, label, value = "", help = "", type = "text", required = true, options = [] }) {
  const control = options.length
    ? element("select", { id, name, required, value }, options.map(option => element("option", { value: option.value, text: option.label })))
    : element("input", { id, name, value, type, required });
  return element("div", { className: "field" }, [element("label", { htmlFor: id, text: label }), control, ...(help ? [element("small", { text: help })] : [])]);
}

function openCreateDialog(refresh) {
  openDialog({
    title: "新建项目",
    copy: "创建独立的发布版与草稿版，并将你设为项目管理员。",
    submitLabel: "创建并进入项目",
    fields: [
      fieldControl({ id: "new-project-id", name: "id", label: "稳定项目 ID", help: "仅小写字母、数字、点、下划线或连字符；创建后不可修改。" }),
      fieldControl({ id: "new-project-name", name: "name", label: "项目名称" }),
      fieldControl({ id: "new-project-template", name: "templateId", label: "项目模板", value: "standard-project-v1", options: [
        { value: "standard-project-v1", label: "标准项目" }, { value: "campaign-map-v1", label: "作战地图" }
      ] })
    ],
    onSubmit: async values => {
      const payload = await api("/api/projects", { method: "POST", mutation: true, body: values });
      showToast("项目创建成功");
      await refresh?.();
      navigate(`/projects/${encodeURIComponent(payload.project.id)}`);
    }
  });
}

function openEditDialog(project, refresh) {
  openDialog({
    title: "编辑项目设置",
    copy: `稳定 ID ${project.id} 保持不变；此处只使用经过验证的主题与术语预设。`,
    submitLabel: "保存项目设置",
    fields: [
      fieldControl({ id: "edit-project-name", name: "name", label: "项目名称", value: project.name }),
      fieldControl({ id: "edit-theme", name: "themePreset", label: "主题风格", value: "xugu-blue", options: [
        { value: "xugu-blue", label: "虚谷蓝" }, { value: "deep-navy", label: "深海军蓝" }, { value: "neutral-blue", label: "中性灰蓝" }
      ] }),
      fieldControl({ id: "edit-terminology", name: "terminologyPreset", label: "术语体系", value: project.templateId === "campaign-map-v1" ? "campaign" : "standard", options: [
        { value: "campaign", label: "作战项目" }, { value: "standard", label: "标准项目" }
      ] })
    ],
    onSubmit: async values => {
      await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: "PATCH", mutation: true, body: values });
      showToast("项目设置已更新");
      await refresh?.();
    }
  });
}

function openArchiveDialog(project, refresh) {
  const confirmation = fieldControl({ id: "archive-confirm", name: "confirmation", label: `输入项目名称“${project.name}”确认`, help: "归档保留全部版本和审计记录，不会删除数据。" });
  openDialog({
    title: "归档项目",
    copy: "归档后项目将离开进行中列表，项目页面暂时不可访问。",
    submitLabel: "归档项目",
    destructive: true,
    fields: [confirmation],
    onSubmit: async values => {
      if (values.confirmation !== project.name) throw new Error("输入的项目名称不匹配");
      await api(`/api/projects/${encodeURIComponent(project.id)}/archive`, { method: "POST", mutation: true });
      showToast("项目已归档，数据仍被保留");
      await refresh?.();
    }
  });
}

function openRestoreDialog(project, refresh) {
  openDialog({
    title: "恢复项目",
    copy: `恢复“${project.name}”后，获授权成员可再次访问其已发布页面。`,
    submitLabel: "恢复项目",
    fields: [],
    onSubmit: async () => {
      await api(`/api/projects/${encodeURIComponent(project.id)}/restore`, { method: "POST", mutation: true });
      showToast("项目已恢复");
      await refresh?.();
    }
  });
}

async function renderRoute() {
  if (!state.session) {
    if (location.pathname !== "/login") state.intendedPath = safeIntendedPath();
    history.replaceState({}, "", "/login");
    renderLogin();
    return;
  }
  if (location.pathname === "/login" || location.pathname === "/") {
    navigate("/projects", { replace: true });
    return;
  }
  if (location.pathname === "/projects") {
    await renderProjects();
    return;
  }
  const match = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})$/);
  if (match) {
    await renderProject(match[1]);
    return;
  }
  navigate("/projects", { replace: true });
}

async function bootstrap() {
  const initialPath = safeIntendedPath();
  try {
    state.session = await api("/api/session", { allowUnauthorized: true });
    if (location.pathname === "/login" || location.pathname === "/") history.replaceState({}, "", "/projects");
  } catch (error) {
    state.session = null;
    if (location.pathname !== "/login" && location.pathname !== "/") state.intendedPath = initialPath;
    history.replaceState({}, "", "/login");
  }
  await renderRoute();
}

window.addEventListener("popstate", () => void renderRoute());
window.addEventListener("pageshow", event => {
  if (!event.persisted || !state.session) return;
  clearSensitiveView();
  api("/api/session").then(session => { state.session = session; return renderRoute(); }).catch(() => {});
});

void bootstrap();
