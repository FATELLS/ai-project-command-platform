import { canonicalModulePath, getClientModule, moduleTypes } from "/modules/registry.js";
import { moduleError, moduleSkeleton, unsupportedState, validateEnvelope, validateManifest } from "/modules/shared.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  session: null,
  intendedPath: null,
  expiryMessage: "",
  projects: [],
  recent: [],
  searchTimer: null,
  dialogReturnFocus: null,
  routeRequest: 0
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
    lifecyclePrepare: terms.lifecyclePrepare || "事前 · 待启",
    lifecycleActive: terms.lifecycleActive || "事中 · 当前",
    lifecycleConverged: terms.lifecycleConverged || "事后 · 已交付"
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
    lifecyclePrepare: terms.lifecyclePrepare || "规划 · 待启动",
    lifecycleActive: terms.lifecycleActive || "执行 · 进行中",
    lifecycleConverged: terms.lifecycleConverged || "交付 · 已完成"
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
  return /^\/projects(?:\/[a-z0-9][a-z0-9._-]{2,63}(?:\/modules\/(?:overview|roadmap|units|task-network|gantt|outcomes|risks|metrics|materials)(?:\/(?:[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}|(?:generation-tasks|proposals)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}))?)?)?$/.test(pathname) ? `${pathname}${location.search}` : "/projects";
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
  if (options.body !== undefined && options.rawBody === undefined) headers["content-type"] = "application/json";
  if (options.mutation && state.session?.csrfToken) headers["x-csrf-token"] = state.session.csrfToken;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers,
    body: options.rawBody !== undefined ? options.rawBody : options.body === undefined ? undefined : JSON.stringify(options.body)
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
    ...(options.projectMode ? [element("a", { className: "active", href: location.pathname, text: options.moduleTitle ?? presentation.overviewLabel })] : [])
  ]);
  const actions = element("div", { className: "header-actions" }, [
    ...(options.switcher ? [element("div", { className: "header-switcher" }, [element("span", { text: "当前项目" }), options.switcher])] : []),
    ...(options.projectActions ?? []),
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

function moduleDisplayTitle(module) {
  if (module.type === "roadmap") return "项目路线图";
  if (module.type === "gantt") return "排期甘特";
  if (module.type === "materials") return "项目资料";
  return module.title;
}

function moduleNavigation(project, manifest, activeType) {
  const scrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const modules = new Map(manifest.modules.map(module => [module.type, module]));
  const groups = [
    { types: ["overview"], title: modules.get("overview")?.title },
    { types: ["roadmap", "task-network"], title: "项目路线图" },
    { types: ["units"], title: modules.get("units")?.title },
    { types: ["gantt"], title: "排期甘特" },
    { types: ["risks", "metrics"], title: "项目健康" },
    { types: ["outcomes", "materials"], title: "项目资料" }
  ].map(group => ({ ...group, target: group.types.map(type => modules.get(type)).find(Boolean) })).filter(group => group.target);
  const list = element("ul", {}, groups.map(group => {
    const path = canonicalModulePath(project.id, group.target.type);
    const active = group.types.includes(activeType);
    return element("li", {}, [element("a", {
      href: path,
      className: active ? "active" : "",
      ariaCurrent: active ? "page" : undefined,
      text: group.title,
      onClick: event => { event.preventDefault(); navigate(path); },
      onFocus: event => event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" })
    })]);
  }));
  list.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const links = [...list.querySelectorAll("a")];
    const current = links.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    links[(current + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length].focus();
  });
  return element("nav", { className: "project-nav section-card", ariaLabel: "项目模块" }, [
    element("button", { type: "button", className: "module-scroll-button previous", ariaLabel: "向前滚动模块", text: "‹", onClick: () => list.scrollBy({ left: -280, behavior: scrollBehavior }) }),
    list,
    element("button", { type: "button", className: "module-scroll-button next", ariaLabel: "向后滚动模块", text: "›", onClick: () => list.scrollBy({ left: 280, behavior: scrollBehavior }) })
  ]);
}

function moduleSectionNavigation(project, manifest, activeType) {
  const modules = new Map(manifest.modules.map(module => [module.type, module]));
  const query = new URLSearchParams(location.search);
  const materialPath = `/projects/${encodeURIComponent(project.id)}/modules/materials`;
  let label = "";
  let entries = [];
  if (["risks", "metrics"].includes(activeType)) {
    label = "项目健康";
    entries = [
      modules.has("risks") ? { key: "risks", label: modules.get("risks").title, href: canonicalModulePath(project.id, "risks"), active: activeType === "risks" } : null,
      modules.has("metrics") ? { key: "metrics", label: modules.get("metrics").title, href: canonicalModulePath(project.id, "metrics"), active: activeType === "metrics" } : null
    ].filter(Boolean);
  } else if (["outcomes", "materials"].includes(activeType)) {
    const proposalView = activeType === "materials" && (
      query.get("view") === "proposals" ||
      location.pathname.includes("/materials/proposals/") ||
      location.pathname.includes("/materials/generation-tasks/")
    );
    label = "项目资料";
    entries = [
      modules.has("outcomes") ? { key: "outcomes", label: modules.get("outcomes").title, href: canonicalModulePath(project.id, "outcomes"), active: activeType === "outcomes" } : null,
      modules.has("materials") ? { key: "materials", label: "材料台账", href: `${materialPath}?view=ledger`, active: activeType === "materials" && !proposalView } : null,
      modules.has("materials") ? { key: "proposals", label: "更新提案", href: `${materialPath}?view=proposals`, active: proposalView } : null
    ].filter(Boolean);
  }
  if (entries.length < 2) return null;
  const links = entries.map(entry => element("a", {
    href: entry.href,
    className: entry.active ? "active" : "",
    ariaCurrent: entry.active ? "page" : undefined,
    text: entry.label,
    onClick: event => { event.preventDefault(); navigate(entry.href); }
  }));
  const section = element("nav", { className: "module-section-nav", ariaLabel: `${label}分区` }, links);
  section.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    links[(index + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length].focus();
  });
  return section;
}

function canConfigureModules(project) {
  return ["platform_admin", "project_admin", "project_editor"].includes(project.role);
}

function compactModuleHeading(project, module, presentation, version) {
  const materials = module.type === "materials";
  return element("header", { className: "module-page-heading" }, [
    element("div", {}, [
      element("span", { className: "eyebrow", text: materials ? (presentation.kind === "campaign" ? "BATTLE MATERIAL INTAKE" : "PROJECT MATERIAL INTAKE") : (presentation.kind === "campaign" ? "PUBLISHED CAMPAIGN MODULE" : "PUBLISHED PROJECT MODULE") }),
      element("h1", { text: module.title }),
      element("p", { text: materials ? `归档 ${project.name} 的材料，形成可定位证据并进行只读项目问答。` : `查看 ${project.name} 当前已发布的${module.title}事实。` })
    ]),
    element("div", { className: "module-heading-meta" }, [element("span", { className: "badge version", text: version }), element("span", { text: `更新于 ${formatDate(project.updatedAt)}` })])
  ]);
}

function projectNotFound(projectId) {
  const panel = element("div", { className: "error-panel" }, [
    element("h1", { text: "项目或模块不存在，或你无权访问" }),
    element("p", { text: "请检查地址，或返回项目总览查看当前已启用模块。" }),
    element("button", { type: "button", className: "secondary-button", text: "返回项目总览", onClick: () => navigate(`/projects/${encodeURIComponent(projectId)}`) })
  ]);
  app.replaceChildren(appFrame(panel));
}

async function renderProject(projectId, requestedType = "overview", materialId = "", materialRoute = {}) {
  const definition = getClientModule(requestedType);
  if (!definition) { projectNotFound(projectId); return; }
  const requestId = ++state.routeRequest;
  document.title = "正在加载模块 · AI 项目作战管理平台";
  const initial = element("div", { className: "route-loading", ariaBusy: "true" }, [element("h1", { text: "正在加载项目模块" }), moduleSkeleton(requestedType)]);
  app.replaceChildren(appFrame(initial));
  try {
    const [detail, list, manifest] = await Promise.all([
      api(`/api/projects/${encodeURIComponent(projectId)}/public`),
      api("/api/projects?status=active&sort=recent"),
      api(`/api/projects/${encodeURIComponent(projectId)}/public/modules`)
    ]);
    if (requestId !== state.routeRequest) return;
    const { project, snapshot } = detail;
    const expectedManifest = { projectId, version: project.publishedVersion, templateId: project.templateId, templateVersion: project.templateVersion };
    if (!validateManifest(manifest, expectedManifest, moduleTypes)) {
      app.replaceChildren(appFrame(unsupportedState(() => renderProject(projectId, requestedType)), { projectMode: true, project }));
      return;
    }
    const module = manifest.modules.find(candidate => candidate.type === requestedType);
    if (!module) { projectNotFound(projectId); return; }
    const presentation = projectPresentation(project);
    const displayModule = { ...module, title: moduleDisplayTitle(module) };
    state.projects = list.projects;
    const slot = element("section", { className: "module-content", ariaLive: "polite", ariaBusy: "true" }, [moduleSkeleton(requestedType)]);
    const breadcrumb = element("nav", { className: "breadcrumb", ariaLabel: "面包屑" }, [
      element("a", { href: "/projects", text: "Projects", onClick: event => { event.preventDefault(); navigate("/projects"); } }),
      element("span", { ariaHidden: "true", text: "/" }), element("span", { text: project.name }),
      ...(requestedType === "overview" ? [] : [element("span", { ariaHidden: "true", text: "/" }), element("span", { text: displayModule.title })])
    ]);
    const sectionNavigation = moduleSectionNavigation(project, manifest, requestedType);
    const projectPage = element("div", { className: "project-route" }, [
      breadcrumb,
      ...(requestedType === "overview" || materialId ? [] : [compactModuleHeading(project, displayModule, presentation, manifest.version)]),
      moduleNavigation(project, manifest, requestedType), sectionNavigation, slot
    ]);
    const configAction = canConfigureModules(project) ? [element("button", { type: "button", className: "admin-entry module-config-entry", text: "模块配置", onClick: event => openModuleConfiguration(project, presentation, event.currentTarget) })] : [];
    app.replaceChildren(appFrame(projectPage, { projectMode: true, project, presentation, moduleTitle: module.title, switcher: projectSwitcher(list.projects, project.id), projectActions: configAction }));
    let slowTimer = setTimeout(() => {
      if (requestId === state.routeRequest && slot.getAttribute("aria-busy") === "true") slot.append(element("p", { className: "slow-loading", text: "加载时间较长，请稍候…" }));
    }, 10_000);
    try {
      const envelope = await api(`/api/projects/${encodeURIComponent(projectId)}/public/modules/${requestedType}`);
      if (requestId !== state.routeRequest) return;
      const valid = validateEnvelope(envelope, { ...expectedManifest, type: requestedType, allowedViews: definition.allowedViews });
      if (!valid) slot.replaceChildren(unsupportedState(() => renderProject(projectId, requestedType)));
      else {
        const rendered = definition.render({
          data: envelope.data, module: { ...envelope.module, title: moduleDisplayTitle(envelope.module) }, project, presentation, snapshot,
          query: new URLSearchParams(location.search), navigate, version: manifest.version,
          updatedAt: formatDate(snapshot.updatedAt || project.updatedAt), roleLabel: roleLabels[project.role] ?? project.role,
          templateLabel: templateLabels[project.templateId] ?? project.templateId,
          materialId, generationTaskId: materialRoute.generationTaskId ?? "", proposalId: materialRoute.proposalId ?? "",
          api, showToast, session: state.session
        });
        slot.replaceChildren(rendered);
        document.title = `${project.name} · ${displayModule.title}`;
      }
    } catch (error) {
      if (error.message === "AUTHENTICATION_REQUIRED" || requestId !== state.routeRequest) return;
      if (error.status === 404) { projectNotFound(projectId); return; }
      slot.replaceChildren(moduleError(`无法加载${displayModule.title}`, error.message, () => renderProject(projectId, requestedType)));
    } finally {
      clearTimeout(slowTimer);
      slot.setAttribute("aria-busy", "false");
    }
  } catch (error) {
    if (error.message === "AUTHENTICATION_REQUIRED" || requestId !== state.routeRequest) return;
    if (error.status === 404) { projectNotFound(projectId); return; }
    const panel = moduleError("项目模块加载失败", error.message, () => renderProject(projectId, requestedType));
    app.replaceChildren(appFrame(panel));
  }
}

async function openModuleConfiguration(project, presentation, returnFocus) {
  const backdrop = element("div", { className: "sheet-backdrop" });
  const sheet = element("section", { className: "module-config-sheet", role: "dialog", ariaModal: "true", ariaLabelledby: "module-config-title", ariaBusy: "true" });
  backdrop.append(sheet);
  document.body.append(backdrop);
  let dirty = false;
  let saving = false;
  let modules = [];

  const remove = () => { backdrop.remove(); returnFocus?.focus(); };
  const confirmDiscard = () => {
    if (!dirty) { remove(); return; }
    const confirmationBackdrop = element("div", { className: "dialog-backdrop nested-confirmation" });
    const continueEditing = element("button", { type: "button", className: "secondary-button", text: "继续编辑", onClick: () => { confirmationBackdrop.remove(); sheet.focus(); } });
    const discard = element("button", { type: "button", className: "danger-button", text: "放弃修改", onClick: () => { confirmationBackdrop.remove(); remove(); } });
    const confirmation = element("section", { className: "dialog discard-dialog", role: "alertdialog", ariaModal: "true", ariaLabelledby: "discard-title" }, [
      element("h2", { id: "discard-title", text: "放弃未保存的模块配置？" }),
      element("p", { text: "本次启停和排序调整不会保存。" }),
      element("div", { className: "dialog-actions" }, [continueEditing, discard])
    ]);
    confirmationBackdrop.append(confirmation);
    document.body.append(confirmationBackdrop);
    continueEditing.focus();
  };
  const closeButton = iconButton("关闭模块配置", "×", confirmDiscard, "dialog-close");
  sheet.replaceChildren(element("header", { className: "sheet-header" }, [
    element("div", {}, [element("span", { className: "eyebrow", text: "DRAFT CONFIGURATION" }), element("h2", { id: "module-config-title", text: "模块配置" })]), closeButton
  ]), element("p", { className: "draft-banner", text: "正在配置草稿模块；当前发布页面不会立即变化。" }), moduleSkeleton("units"));
  closeButton.focus();

  const onSheetKeydown = event => {
    if (event.key === "Escape" && !saving) { event.preventDefault(); confirmDiscard(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...sheet.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  backdrop.addEventListener("keydown", onSheetKeydown);

  try {
    const manifest = await api(`/api/projects/${encodeURIComponent(project.id)}/draft/modules`);
    modules = manifest.modules.map(module => ({ ...module }));
    const error = element("p", { className: "form-error sheet-error", role: "alert" });
    const list = element("ol", { className: "module-config-list" });
    const save = element("button", { type: "button", className: "primary-button", text: "保存草稿配置" });
    const cancel = element("button", { type: "button", className: "secondary-button", text: "放弃本次修改", onClick: confirmDiscard });
    const names = new Map(modules.map(module => [module.type, module.title]));
    const renderRows = focusType => {
      list.replaceChildren(...modules.map((module, index) => {
        const toggleId = `module-enabled-${module.type}`;
        const toggle = element("input", { id: toggleId, type: "checkbox", checked: module.enabled, disabled: module.required, ariaLabel: `${module.title}启用状态`, onChange: () => { module.enabled = toggle.checked; dirty = true; } });
        const row = element("li", { className: "module-config-row", dataset: { moduleType: module.type } }, [
          element("span", { className: "order-number", text: String(index + 1) }),
          element("div", { className: "module-config-name" }, [
            element("label", { htmlFor: toggleId, text: names.get(module.type) ?? module.type }),
            element("small", { text: `固定视图：${module.viewVariant}` }),
            ...(module.required ? [element("span", { className: "badge required", text: "必填模块" })] : [])
          ]),
          toggle,
          element("div", { className: "order-actions" }, [
            element("button", { type: "button", className: "ghost-button", text: "上移", disabled: index === 0, onClick: () => { [modules[index - 1], modules[index]] = [modules[index], modules[index - 1]]; dirty = true; renderRows(module.type); } }),
            element("button", { type: "button", className: "ghost-button", text: "下移", disabled: index === modules.length - 1, onClick: () => { [modules[index + 1], modules[index]] = [modules[index], modules[index + 1]]; dirty = true; renderRows(module.type); } })
          ])
        ]);
        return row;
      }));
      if (focusType) list.querySelector(`[data-module-type="${CSS.escape(focusType)}"] .order-actions button:not(:disabled)`)?.focus();
    };
    save.addEventListener("click", async () => {
      error.textContent = "";
      saving = true;
      save.disabled = cancel.disabled = closeButton.disabled = true;
      save.textContent = "正在保存…";
      try {
        await api(`/api/projects/${encodeURIComponent(project.id)}/draft/modules`, {
          method: "PATCH", mutation: true,
          body: { modules: modules.map((module, position) => ({ type: module.type, schemaVersion: module.schemaVersion, position, enabled: module.enabled, viewVariant: module.viewVariant })) }
        });
        dirty = false;
        remove();
        showToast("草稿模块配置已保存");
      } catch (requestError) {
        if (requestError.message !== "AUTHENTICATION_REQUIRED") error.textContent = "未能保存模块配置，请检查后重试";
      } finally {
        saving = false;
        save.disabled = cancel.disabled = closeButton.disabled = false;
        save.textContent = "保存草稿配置";
      }
    });
    renderRows();
    sheet.setAttribute("aria-busy", "false");
    sheet.replaceChildren(
      element("header", { className: "sheet-header" }, [element("div", {}, [element("span", { className: "eyebrow", text: "DRAFT CONFIGURATION" }), element("h2", { id: "module-config-title", text: "模块配置" })]), closeButton]),
      element("p", { className: "draft-banner", text: "正在配置草稿模块；当前发布页面不会立即变化。" }),
      element("p", { className: "sheet-copy", text: `配置 ${project.name} 的九个固定模块。禁用不会删除${presentation.task}或其他事实。` }),
      list, error, element("footer", { className: "sheet-actions" }, [cancel, save])
    );
    closeButton.focus();
  } catch (error) {
    if (error.message === "AUTHENTICATION_REQUIRED") { remove(); return; }
    sheet.setAttribute("aria-busy", "false");
    sheet.append(element("div", { className: "error-panel" }, [element("h3", { text: "无法加载草稿模块配置" }), element("p", { text: error.message }), element("button", { type: "button", className: "secondary-button", text: "关闭", onClick: remove })]));
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
  state.routeRequest += 1;
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
    await renderProject(match[1], "overview");
    return;
  }
  const moduleMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/modules\/([a-z0-9][a-z0-9-]{1,63})$/);
  if (moduleMatch) {
    if (moduleMatch[2] === "overview") {
      navigate(`/projects/${encodeURIComponent(moduleMatch[1])}${location.search}`, { replace: true });
      return;
    }
    if (!getClientModule(moduleMatch[2])) { projectNotFound(moduleMatch[1]); return; }
    await renderProject(moduleMatch[1], moduleMatch[2]);
    return;
  }
  const materialMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/modules\/materials\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (materialMatch) {
    await renderProject(materialMatch[1], "materials", materialMatch[2]);
    return;
  }
  const generationTaskMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/modules\/materials\/generation-tasks\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (generationTaskMatch) {
    await renderProject(generationTaskMatch[1], "materials", "", { generationTaskId: generationTaskMatch[2] });
    return;
  }
  const proposalMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/modules\/materials\/proposals\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (proposalMatch) {
    await renderProject(proposalMatch[1], "materials", "", { proposalId: proposalMatch[2] });
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
