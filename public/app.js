import { canonicalModulePath, getClientModule, moduleTypes } from "/modules/registry.js";
import { icon, moduleError, moduleSkeleton, unsupportedState, validateEnvelope, validateManifest } from "/modules/shared.js";
import { downloadMaterialTemplate } from "/material-template-downloads.js";

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

function iconButton(label, iconName, onClick, className = "icon-button") {
  return element("button", { type: "button", className, ariaLabel: label, title: label, onClick }, [icon(iconName)]);
}

function safeIntendedPath(pathname = location.pathname) {
  const project = "[a-z0-9][a-z0-9._-]{2,63}";
  const object = "[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}";
  const projectRoute = new RegExp(`^/projects(?:/${project})?$`);
  const moduleRoute = new RegExp(`^/projects/${project}/modules/(?:overview|roadmap|units|gantt|outcomes|risks|metrics|materials)(?:/(?:${object}|(?:generation-tasks|proposals)/${object}))?$`);
  const updateRoute = new RegExp(`^/projects/${project}/updates(?:/release|/(?:preview|proposals|generation-tasks)/${object})?$`);
  return [projectRoute, moduleRoute, updateRoute].some(pattern => pattern.test(pathname)) ? `${pathname}${location.search}` : "/projects";
}

function formatDate(value) {
  if (!value) return "暂无更新时间";
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(instant);
}

function bytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "—";
  if (number < 1024) return `${number} B`;
  if (number < 1024 ** 2) return `${(number / 1024).toFixed(1)} KiB`;
  return `${(number / 1024 ** 2).toFixed(1)} MiB`;
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

// 带 XHR 上传进度的请求函数
function uploadWithProgress(path, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? "POST", path);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    const headers = { accept: "application/json", ...(options.headers ?? {}) };
    if (options.mutation && state.session?.csrfToken) headers["x-csrf-token"] = state.session.csrfToken;
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    if (options.onProgress) xhr.upload.addEventListener("progress", event => {
      if (event.lengthComputable) options.onProgress(event.loaded / event.total);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 401) { handleExpired(); reject(new Error("AUTHENTICATION_REQUIRED")); return; }
      const payload = xhr.response ?? { error: "服务器返回了无法识别的响应" };
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else { const error = new Error(payload.error ?? "上传失败"); error.status = xhr.status; error.code = payload.code; reject(error); }
    });
    xhr.addEventListener("error", () => reject(new Error("网络错误，上传失败")));
    xhr.addEventListener("abort", () => reject(new Error("上传已取消")));
    xhr.send(options.rawBody);
  });
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
        element("span", { className: "eyebrow", text: "多项目统一管理" }),
        element("h2", { text: "让每个项目都有清晰的作战现场" }),
        element("p", { text: "统一组织项目、团队与事实数据，让 AI 辅助更新始终可审计、可审核、可回退。" }),
        trust
      ]),
      element("div", { className: "brand-foot", text: "内部项目环境 · 请使用管理员分配的账号" })
    ]),
    element("section", { className: "login-form-panel" }, [
      element("div", { className: "login-form-wrap" }, [
        element("span", { className: "eyebrow", text: "欢迎回来" }),
        element("h1", { text: "登录项目作战平台" }),
        element("p", { text: "进入你获授权的项目空间。" }),
        form,
        element("p", { className: "form-note", text: "默认账号 admin / admin123，首次登录后需修改密码。" })
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
  const chatWidget = options.projectMode ? createHeaderChat(options.project, options.presentation) : null;
  const actions = element("div", { className: "header-actions" }, [
    ...(options.switcher ? [element("div", { className: "header-switcher" }, [element("span", { text: "当前项目" }), options.switcher])] : []),
    ...(options.projectActions ?? []),
    ...(chatWidget ? [chatWidget.toggleButton] : []),
    ...(user.isPlatformAdmin ? [iconButton("平台设置", "sliders-horizontal", () => navigate("/settings"), "admin-entry header-icon-button")] : []),
    element("span", { className: "update-time" }, [element("i", { ariaHidden: "true" }), element("span", { text: user.displayName })]),
    iconButton("退出登录", "log-out", logout, "admin-entry header-icon-button")
  ]);
  return element("div", { className: "public-app app-shell" }, [
    element("header", { className: "public-header" }, [brandLink, navigation, actions]),
    element("main", { className: "public-main content" }, [mainContent]),
    ...(chatWidget ? [chatWidget.container] : [])
  ]);
}

function createHeaderChat(project, presentation) {
  const qaLabel = presentation.kind === "campaign" ? "战情问答" : "项目问答";
  const assistant = presentation.kind === "campaign" ? "作战参谋" : "项目助手";
  const suggestions = presentation.kind === "campaign"
    ? ["当前战役路线进行到哪里？", "哪些行动任务存在风险？", "最近归档了哪些战果依据？"]
    : ["当前项目里程碑进展如何？", "哪些任务存在风险？", "最近有哪些交付物依据？"];

  const toggleButton = element("button", { type: "button", className: "chat-header-btn", ariaLabel: qaLabel, ariaExpanded: "false" }, [
    icon("message-circle", { size: 16 }),
    element("span", { text: qaLabel })
  ]);

  const overlay = element("div", { className: "chat-dropdown-overlay", hidden: true });
  const panel = element("section", { className: "chat-dropdown-panel", role: "dialog", ariaModal: "false", ariaLabel: qaLabel });
  const conversation = element("div", { className: "qa-conversation", ariaLive: "polite" }, [
    element("article", { className: "qa-message assistant" }, [
      element("strong", { text: assistant }),
      element("p", { text: "只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。" })
    ])
  ]);
  const questionInput = element("textarea", { className: "chat-dropdown-input", rows: 3, maxLength: 1000, placeholder: presentation.kind === "campaign" ? "询问当前战况、作战单元、节点或行动任务…" : "询问当前项目、团队、里程碑或任务…" });
  const sendBtn = element("button", { type: "submit", className: "primary-button chat-dropdown-send", text: "发送" });
  const errorMsg = element("p", { className: "form-error", role: "alert" });
  const closeButton = iconButton("关闭问答", "x", () => closePanel(), "chat-dropdown-close");

  const form = element("form", { className: "chat-dropdown-form", onSubmit: async event => {
    event.preventDefault();
    const value = questionInput.value.trim();
    if (!value) { errorMsg.textContent = "请输入问题"; return; }
    errorMsg.textContent = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "查找中…";
    conversation.append(element("article", { className: "qa-message user" }, [element("strong", { text: "你" }), element("p", { text: value })]));
    questionInput.value = "";
    try {
      const answer = await api(`/api/projects/${encodeURIComponent(project.id)}/chat`, { method: "POST", mutation: true, body: { question: value } });
      const msg = element("article", { className: "qa-message assistant" }, [
        element("strong", { text: assistant }),
        element("p", { text: answer.answer || "现有资料不足以回答这个问题。" })
      ]);
      if (answer.caveat && answer.caveat !== answer.answer) msg.append(element("p", { className: "qa-caveat", text: answer.caveat }));
      if (answer.citations?.length) {
        msg.append(element("h4", { text: "引用来源" }));
        msg.append(element("ol", { className: "citation-list" }, answer.citations.map((citation, index) => {
          const href = `/projects/${encodeURIComponent(project.id)}/modules/materials/${encodeURIComponent(citation.materialId)}?evidence=${encodeURIComponent(citation.evidenceId)}`;
          return element("li", {}, [element("a", { href, onClick: event => { event.preventDefault(); closePanel(); navigate(href); } }, [element("strong", { text: `[${index + 1}]` }), element("span", { text: citation.claim })])]);
        })));
      }
      conversation.append(msg);
      conversation.scrollTop = conversation.scrollHeight;
    } catch (err) {
      questionInput.value = value;
      if (err.status === 429) errorMsg.textContent = "项目问答配额已用完，请稍后再试。";
      else if (err.code === "AI_PROVIDER_DISABLED") errorMsg.textContent = "项目问答当前未启用。";
      else errorMsg.textContent = "暂时无法完成问答，请稍后重试。";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
    }
  } }, [questionInput, errorMsg, sendBtn]);

  const suggestionsNode = element("div", { className: "chat-dropdown-suggestions" }, suggestions.map(s => element("button", { type: "button", className: "secondary-button chat-dropdown-suggestion", text: s, onClick: () => { questionInput.value = s; questionInput.focus(); } })));

  panel.append(
    element("header", { className: "chat-dropdown-header" }, [element("div", {}, [element("span", { className: "eyebrow", text: "READ-ONLY" }), element("h3", { text: qaLabel })]), closeButton]),
    suggestionsNode,
    conversation,
    form
  );
  overlay.append(panel);

  function openPanel() {
    overlay.hidden = false;
    toggleButton.setAttribute("aria-expanded", "true");
    toggleButton.classList.add("active");
    questionInput.focus();
  }
  function closePanel() {
    overlay.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.classList.remove("active");
  }

  toggleButton.addEventListener("click", () => { overlay.hidden ? openPanel() : closePanel(); });
  overlay.addEventListener("click", event => { if (event.target === overlay) closePanel(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) closePanel(); });

  return { toggleButton, container: element("div", { className: "chat-header-container" }, [overlay]) };
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
    ]),
    ...(project.role === "viewer" ? [] : [element("details", { className: "technical-details project-technical-details" }, [
      element("summary", { text: "技术信息" }),
      element("div", { className: "project-id", text: project.id })
    ])])
  ]);
  if (state.session.user.isPlatformAdmin && !recent) {
    const actions = element("div", { className: "card-actions" });
    if (isArchived) actions.append(iconButton(`恢复 ${project.name}`, "refresh-cw", () => openRestoreDialog(project, refresh)));
    else {
      actions.append(iconButton(`编辑 ${project.name}`, "pencil", () => openEditDialog(project, refresh)));
      actions.append(iconButton(`归档 ${project.name}`, "archive", () => openArchiveDialog(project, refresh)));
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
  const clear = iconButton("清除搜索条件", "x", () => {
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
  const page = element("div", { className: "projects-workbench" }, [
    element("header", { className: "page-head operational-page-head" }, [
      element("div", {}, [
        element("span", { className: "eyebrow", text: "项目工作台" }),
        element("h1", { text: "项目作战台" }),
        element("p", { text: "查找并进入获授权的项目。" })
      ]),
      element("div", { className: "head-actions" }, [
        element("span", { className: "count-pill", id: "active-project-count", text: "正在载入项目" }),
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
  if (module.type === "materials") return "项目材料";
  return module.title;
}

function moduleNavigation(project, manifest, activeType, activeWorkspace = "") {
  const scrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const modules = new Map(manifest.modules.map(module => [module.type, module]));
  const groups = [
    { types: ["overview"], title: modules.get("overview")?.title },
    { types: ["roadmap"], title: "项目路线图" },
    { types: ["units"], title: modules.get("units")?.title },
    { types: ["gantt"], title: "排期甘特" },
    { types: ["risks", "metrics"], title: "项目健康" },
    { types: ["outcomes", "materials"], title: "项目资料" }
  ].map(group => ({ ...group, target: group.types.map(type => modules.get(type)).find(Boolean) })).filter(group => group.target);
  const list = element("ul", {}, groups.map(group => {
    let path = canonicalModulePath(project.id, group.target.type);
    let active;
    if (activeWorkspace) {
      active = false;
    } else if (group.types.includes("outcomes") && activeType === "outcomes") {
      active = true;
    } else if (group.types.includes("materials")) {
      active = activeType === "materials";
    } else {
      active = group.types.includes(activeType);
    }
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
    element("button", { type: "button", className: "module-scroll-button previous", ariaLabel: "向前滚动模块", title: "向前滚动模块", onClick: () => list.scrollBy({ left: -280, behavior: scrollBehavior }) }, [icon("chevron-left")]),
    list,
    element("button", { type: "button", className: "module-scroll-button next", ariaLabel: "向后滚动模块", title: "向后滚动模块", onClick: () => list.scrollBy({ left: 280, behavior: scrollBehavior }) }, [icon("chevron-right")])
  ]);
}

function moduleSectionNavigation(project, manifest, activeType, activeWorkspace = "") {
  if (activeWorkspace === "update") return null;
  const modules = new Map(manifest.modules.map(module => [module.type, module]));
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
    label = "项目资料";
    entries = [
      modules.has("outcomes") ? { key: "outcomes", label: modules.get("outcomes").title, href: canonicalModulePath(project.id, "outcomes"), active: activeType === "outcomes" } : null,
      { key: "materials", label: "项目材料", href: `${materialPath}?view=ledger`, active: activeType === "materials" }
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

function compactModuleHeading(project, module, presentation, version, activeWorkspace = "") {
  if (activeWorkspace === "update") {
    const updateCopy = location.pathname.includes("/updates/preview/")
      ? "核对本次材料生成的节点变化及其在主路线图中的位置。"
      : location.pathname.endsWith("/updates/release")
        ? "检查草稿差异和发布条件，由项目管理员完成最终发布。"
        : "上传或选择本次更新材料，依次完成生成、模拟路线图、人工审核和发布。";
    return element("header", { className: "module-page-heading" }, [
      element("div", {}, [
        element("span", { className: "eyebrow", text: "PROJECT UPDATE" }),
        element("h1", { text: "项目更新" }),
        element("p", { text: updateCopy })
      ]),
      element("div", { className: "module-heading-meta" }, [element("span", { className: "badge version", text: version }), element("span", { text: `更新于 ${formatDate(project.updatedAt)}` })])
    ]);
  }
  const materials = module.type === "materials";
  const materialView = new URLSearchParams(location.search).get("view");
  const proposalView = materials && (materialView === "proposals" || location.pathname.includes("/materials/proposals/") || location.pathname.includes("/materials/generation-tasks/"));
  const releaseView = materials && materialView === "release";
  const headingTitle = proposalView ? "AI 生成项目节点预览" : releaseView ? "审核与发布" : module.title;
  const headingCopy = proposalView
    ? "查看 AI 基于项目材料生成的节点卡片，并在路线图中核对位置与展示效果。"
    : releaseView
      ? "核对已接受的节点变化，完成草稿合并、发布检查与人工发布。"
      : materials
        ? `归档 ${project.name} 的材料，形成可追溯内容并进行只读项目问答。`
        : `查看 ${project.name} 当前已发布的${module.title}事实。`;
  return element("header", { className: "module-page-heading" }, [
    element("div", {}, [
      element("span", { className: "eyebrow", text: materials ? (presentation.kind === "campaign" ? "项目材料" : "项目材料") : (presentation.kind === "campaign" ? "作战模块" : "项目模块") }),
      element("h1", { text: headingTitle }),
      element("p", { text: headingCopy })
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
    const activeWorkspace = materialRoute.workspace ?? "";
    const requestedMaterialView = new URLSearchParams(location.search).get("view");
    const restrictedViewerRoute = project.role === "viewer" && requestedType === "materials" && (
      ["proposals", "release", "operations"].includes(requestedMaterialView) ||
      Boolean(materialRoute.proposalId || materialRoute.previewProposalId || materialRoute.generationTaskId || activeWorkspace === "update")
    );
    if (restrictedViewerRoute) {
      navigate(`/projects/${encodeURIComponent(project.id)}/modules/materials?view=ledger`, { replace: true });
      return;
    }
    const expectedManifest = { projectId, version: project.publishedVersion, templateId: project.templateId, templateVersion: project.templateVersion };
    if (!validateManifest(manifest, expectedManifest, moduleTypes)) {
      app.replaceChildren(appFrame(unsupportedState(() => renderProject(projectId, requestedType)), { projectMode: true, project }));
      return;
    }
    const module = manifest.modules.find(candidate => candidate.type === requestedType);
    if (!module) { projectNotFound(projectId); return; }
    const presentation = projectPresentation(project);
    const displayModule = { ...module, title: activeWorkspace === "update" ? "项目更新" : moduleDisplayTitle(module) };
    state.projects = list.projects;
    const slot = element("section", { className: "module-content", ariaLive: "polite", ariaBusy: "true" }, [moduleSkeleton(requestedType)]);
    const breadcrumb = element("nav", { className: "breadcrumb", ariaLabel: "面包屑" }, [
      element("a", { href: "/projects", text: "项目", onClick: event => { event.preventDefault(); navigate("/projects"); } }),
      element("span", { ariaHidden: "true", text: "/" }), element("span", { text: project.name }),
      ...(requestedType === "overview" ? [] : [element("span", { ariaHidden: "true", text: "/" }), element("span", { text: displayModule.title })])
    ]);
    const sectionNavigation = moduleSectionNavigation(project, manifest, requestedType, activeWorkspace);
    const rendererOwnsHeading = Boolean(materialId || materialRoute.proposalId || materialRoute.generationTaskId);
    const projectPage = element("div", { className: "project-route" }, [
      breadcrumb,
      moduleNavigation(project, manifest, requestedType, activeWorkspace), sectionNavigation,
      ...(requestedType === "overview" || rendererOwnsHeading ? [] : [compactModuleHeading(project, displayModule, presentation, manifest.version, activeWorkspace)]),
      slot
    ]);
    const configAction = canConfigureModules(project) ? [iconButton("模块配置", "panel-top", event => openModuleConfiguration(project, presentation, event.currentTarget), "admin-entry header-icon-button module-config-entry")] : [];
    app.replaceChildren(appFrame(projectPage, { projectMode: true, project, presentation, moduleTitle: displayModule.title, switcher: projectSwitcher(list.projects, project.id), projectActions: configAction }));
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
          previewProposalId: materialRoute.previewProposalId ?? "",
          updateWorkspace: activeWorkspace === "update", updateView: materialRoute.updateView ?? "",
          api, uploadWithProgress, showToast, session: state.session
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
  const closeButton = iconButton("关闭模块配置", "x", confirmDiscard, "dialog-close");
  sheet.replaceChildren(element("header", { className: "sheet-header" }, [
    element("div", {}, [element("span", { className: "eyebrow", text: "草稿配置" }), element("h2", { id: "module-config-title", text: "模块配置" })]), closeButton
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
      element("header", { className: "sheet-header" }, [element("div", {}, [element("span", { className: "eyebrow", text: "草稿配置" }), element("h2", { id: "module-config-title", text: "模块配置" })]), closeButton]),
      element("p", { className: "draft-banner", text: "正在配置草稿模块；当前发布页面不会立即变化。" }),
      element("p", { className: "sheet-copy", text: `配置 ${project.name} 的八个固定模块。禁用不会删除${presentation.task}或其他事实。` }),
      list, error, element("footer", { className: "sheet-actions" }, [cancel, save])
    );
    closeButton.focus();
  } catch (error) {
    if (error.message === "AUTHENTICATION_REQUIRED") { remove(); return; }
    sheet.setAttribute("aria-busy", "false");
    sheet.append(element("div", { className: "error-panel" }, [element("h3", { text: "无法加载草稿模块配置" }), element("p", { text: error.message }), element("button", { type: "button", className: "secondary-button", text: "关闭", onClick: remove })]));
  }
}

function openDialog({ title, copy, fields = [], submitLabel, destructive = false, onSubmit, returnFocus = document.activeElement }) {
  state.dialogReturnFocus = returnFocus;
  const error = element("p", { className: "form-error", role: "alert" });
  const close = () => {
    backdrop.remove();
    state.dialogReturnFocus?.focus?.();
  };
  const closeButton = iconButton("关闭对话框", "x", close, "dialog-close");
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
    const focusable = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.body.append(backdrop);
  const initial = dialog.querySelector("input, textarea, select, button");
  initial?.focus();
}

function fieldControl({ id, name, label, value = "", help = "", type = "text", required = true, options = [] }) {
  const control = options.length
    ? element("select", { id, name, required, value }, options.map(option => element("option", { value: option.value, text: option.label })))
    : element("input", { id, name, value, type, required });
  return element("div", { className: "field" }, [element("label", { htmlFor: id, text: label }), control, ...(help ? [element("small", { text: help })] : [])]);
}

function installDialogBehavior(backdrop, dialog, close, initialFocus) {
  backdrop.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hidden && node.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.body.append(backdrop);
  (initialFocus ?? dialog.querySelector("input, textarea, select, button"))?.focus();
}

function openCreateDialog(refresh) {
  const backdrop = element("div", { className: "dialog-backdrop" });
  const dialog = element("section", { className: "dialog create-dialog", role: "dialog", ariaModal: "true", ariaLabelledby: "create-dialog-title" });
  state.dialogReturnFocus = document.activeElement;
  const returnFocus = state.dialogReturnFocus;
  const close = () => { backdrop.remove(); returnFocus?.focus?.(); };
  const closeButton = iconButton("关闭对话框", "x", close, "dialog-close");

  const startForm = () => {
    backdrop.remove();
    openCreateFormDialog(refresh, returnFocus);
  };
  const startMaterial = () => {
    backdrop.remove();
    openCreateFromMaterialDialog(refresh, returnFocus);
  };
  const startConversational = () => {
    backdrop.remove();
    openCreateConversationalDialog(refresh, returnFocus);
  };

  const choices = [
    { iconName: "upload", title: "上传材料创建", desc: "上传项目启动会纪要、计划等文档，系统自动提取项目信息并生成骨架。", onClick: startMaterial, badge: "推荐" },
    { iconName: "message-square", title: "对话式创建", desc: "通过 AI 引导的对话逐步描述项目目标、团队和里程碑，自动生成项目结构。", onClick: startConversational, badge: "AI 引导" },
    { iconName: "square-pen", title: "手动填写创建", desc: "直接填写项目 ID、名称和模板，适合已规划好的项目。", onClick: startForm }
  ];

  dialog.append(
    element("header", {}, [element("h2", { id: "create-dialog-title", text: "新建项目" }), closeButton]),
    element("p", { className: "dialog-copy", text: "选择适合的创建方式。三种方式最终都生成标准项目实体和模板配置。" }),
    element("div", { className: "creation-template-action" }, [
      element("span", { text: "准备项目材料？先按标准结构填写。" }),
      element("button", { type: "button", className: "secondary-button", text: "下载项目创建模板", onClick: () => downloadMaterialTemplate("new-project-material") })
    ]),
    element("div", { className: "create-choice-grid" }, choices.map(choice => {
      const card = element("button", { type: "button", className: "create-choice-card", onClick: choice.onClick }, [
        element("span", { className: "create-choice-icon", ariaHidden: "true" }, [icon(choice.iconName, { size: 22 })]),
        element("div", { className: "create-choice-content" }, [
          element("strong", { text: choice.title }),
          element("p", { text: choice.desc })
        ]),
        ...(choice.badge ? [element("span", { className: "create-choice-badge", text: choice.badge })] : [])
      ]);
      return card;
    }))
  );
  backdrop.append(dialog);
  installDialogBehavior(backdrop, dialog, close, dialog.querySelector(".create-choice-card"));
}

function openCreateFormDialog(refresh, returnFocus) {
  openDialog({
    title: "手动填写创建",
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
      setTimeout(() => openConfirmProjectDialog(refresh, {
        ...values,
        summary: "",
        sourceHint: "请检查项目骨架，确认后再创建项目。"
      }, returnFocus), 0);
    },
    returnFocus
  });
}

function openCreateFromMaterialDialog(refresh, returnFocus = document.activeElement) {
  const backdrop = element("div", { className: "dialog-backdrop" });
  const dialog = element("section", { className: "dialog create-material-dialog", role: "dialog", ariaModal: "true", ariaLabelledby: "create-material-title" });
  state.dialogReturnFocus = returnFocus;
  const close = () => { backdrop.remove(); returnFocus?.focus?.(); };
  const closeButton = iconButton("关闭", "x", close, "dialog-close");

  const input = element("input", { type: "file", accept: ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json", multiple: false });
  const drop = element("div", { className: "upload-drop create-material-drop", tabIndex: 0, role: "button", ariaLabel: "选择或拖入文件" }, [
    element("button", { type: "button", className: "secondary-button", text: "选择文件", onClick: () => input.click() }),
    element("p", { text: "上传项目启动会纪要、计划或概要文档" }),
    input
  ]);
  for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("active"); });
  for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("active"); });
  drop.addEventListener("drop", e => { if (e.dataTransfer?.files?.length) { input.files = e.dataTransfer.files; updateFileList(); } });
  drop.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); input.click(); } });

  const fileList = element("div", { className: "upload-queue", ariaLive: "polite" });
  const updateFileList = () => {
    fileList.replaceChildren(...[...input.files].map(f => element("article", { className: "upload-queue-row" }, [element("strong", { text: f.name }), element("span", { text: bytes(f.size) })])));
  };
  input.addEventListener("change", updateFileList);

  const error = element("p", { className: "form-error", role: "alert" });
  const analyzeBtn = element("button", { type: "submit", className: "primary-button", text: "分析并创建项目" });
  const cancelBtn = element("button", { type: "button", className: "secondary-button", text: "取消", onClick: close });

  const form = element("form", { onSubmit: async event => {
    event.preventDefault();
    error.textContent = "";
    const file = input.files?.[0];
    if (!file) { error.textContent = "请先选择一份项目文档"; return; }
    analyzeBtn.disabled = true; analyzeBtn.textContent = "正在分析文档…";

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/projects/from-material", { method: "POST", headers: { "x-csrf-token": state.session.csrfToken }, credentials: "same-origin", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "分析失败");
      backdrop.remove();
      openConfirmProjectDialog(refresh, {
        id: payload.suggestedId ?? "",
        name: payload.suggestedName ?? "",
        templateId: payload.suggestedTemplate ?? "standard-project-v1",
        summary: payload.summary ?? "",
        sourceHint: `基于上传的「${file.name}」自动提取`
      }, returnFocus);
    } catch (err) {
      error.textContent = err.message;
      analyzeBtn.disabled = false; analyzeBtn.textContent = "分析并创建项目";
    }
  } }, [drop, fileList, error, element("footer", { className: "sheet-actions" }, [cancelBtn, analyzeBtn])]);

  // 内容要素清单——与提示词的 P0/P1/P2 提取规则对称。提取端要什么，输入端就提示什么。
  const elementGuide = element("section", { className: "element-guide" }, [
    element("p", { className: "element-guide-title", text: "项目卡片由你的材料填充。材料越完整，卡片越准确。请尽量包含以下要素：" }),
    element("div", { className: "element-guide-level" }, [
      element("span", { className: "element-badge badge-required", text: "必选" }),
      element("ul", {}, [
        element("li", {}, [element("strong", { text: "目标/范围" }), " — 这个项目/任务要达成什么（一句话目的）"]),
        element("li", {}, [element("strong", { text: "时间节点" }), " — 关键截止日期、里程碑时间（格式：2026-08-15）"]),
        element("li", {}, [element("strong", { text: "人员" }), " — 谁负责、谁参与、谁是相关方"])
      ])
    ]),
    element("div", { className: "element-guide-level" }, [
      element("span", { className: "element-badge badge-conditional", text: "有就写" }),
      element("ul", {}, [
        element("li", {}, [element("strong", { text: "交付物" }), " — 要产出的具体东西（如：需求文档、原型、合同）"]),
        element("li", {}, [element("strong", { text: "风险/阻塞" }), " — 遇到的问题、卡点"])
      ])
    ]),
    element("div", { className: "element-guide-level" }, [
      element("span", { className: "element-badge badge-optional", text: "可选" }),
      element("ul", {}, [
        element("li", {}, [element("strong", { text: "验收标准、关键决策" }), " — 后续材料逐步补充即可"])
      ])
    ])
  ]);

  dialog.append(
    element("header", {}, [element("h2", { id: "create-material-title", text: "上传材料创建项目" }), closeButton]),
    element("p", { className: "dialog-copy", text: "上传项目文档，系统会自动提取项目名称、目标和关键信息，生成项目骨架供你确认。" }),
    element("div", { className: "creation-template-action" }, [
      element("span", { text: "缺少现成文档时，可先填写标准模板。" }),
      element("button", { type: "button", className: "secondary-button", text: "下载项目创建模板", onClick: () => downloadMaterialTemplate("new-project-material") })
    ]),
    elementGuide,
    form
  );
  backdrop.append(dialog);
  installDialogBehavior(backdrop, dialog, close, drop);
}

function openConfirmProjectDialog(refresh, suggested, returnFocus = document.activeElement) {
  const idField = fieldControl({ id: "confirm-project-id", name: "id", label: "稳定项目 ID", value: suggested.id, help: "仅小写字母、数字、点、下划线或连字符。" });
  const nameField = fieldControl({ id: "confirm-project-name", name: "name", label: "项目名称", value: suggested.name });
  const templateField = fieldControl({ id: "confirm-project-template", name: "templateId", label: "项目模板", value: suggested.templateId, options: [
    { value: "standard-project-v1", label: "标准项目" }, { value: "campaign-map-v1", label: "作战地图" }
  ] });
  openDialog({
    title: "确认项目骨架",
    copy: suggested.sourceHint ?? "请确认项目骨架后再创建。",
    submitLabel: "创建项目",
    fields: [idField, nameField, templateField, fieldControl({ id: "confirm-project-summary", name: "summary", label: "项目摘要（可选）", value: suggested.summary ?? "", type: "text", required: false })],
    onSubmit: async values => {
      const payload = await api("/api/projects", { method: "POST", mutation: true, body: values });
      showToast("项目创建成功");
      await refresh?.();
      navigate(`/projects/${encodeURIComponent(payload.project.id)}`);
    },
    returnFocus
  });
}

function openCreateConversationalDialog(refresh, returnFocus = document.activeElement) {
  const backdrop = element("div", { className: "dialog-backdrop create-convo-backdrop" });
  const dialog = element("section", { className: "dialog create-convo-dialog", role: "dialog", ariaModal: "true", ariaLabelledby: "create-convo-title" });
  state.dialogReturnFocus = returnFocus;
  const close = () => { backdrop.remove(); returnFocus?.focus?.(); };
  const closeButton = iconButton("关闭", "x", close, "dialog-close");

  const conversation = element("div", { className: "qa-conversation", ariaLive: "polite" }, [
    element("article", { className: "qa-message assistant" }, [
      element("strong", { text: "项目创建助手" }),
      element("p", { text: "你好！我来帮你创建项目。请告诉我：你的项目叫什么？主要目标是什么？" })
    ])
  ]);
  const input = element("textarea", { className: "chat-fab-input", rows: 3, maxLength: 1000, placeholder: "描述你的项目…" });
  const error = element("p", { className: "form-error", role: "alert" });
  const sendBtn = element("button", { type: "submit", className: "primary-button", text: "发送" });

  let collectedInfo = { name: "", goal: "", team: "", milestones: "" };
  let step = 0;
  const progress = element("p", { className: "convo-progress", ariaLive: "polite", text: "第 1 步，共 4 步" });
  const steps = [
    "项目叫什么名称？",
    "项目的主要目标是什么？",
    "项目涉及哪些团队或角色？（可选）",
    "有关键里程碑或时间节点吗？（可选）"
  ];

  const send = async () => {
    const value = input.value.trim();
    if (!value) return;
    error.textContent = "";
    conversation.append(element("article", { className: "qa-message user" }, [element("strong", { text: "你" }), element("p", { text: value })]));
    input.value = "";

    if (step === 0) collectedInfo.name = value;
    else if (step === 1) collectedInfo.goal = value;
    else if (step === 2) collectedInfo.team = value;
    else if (step === 3) collectedInfo.milestones = value;

    step++;
    progress.textContent = `第 ${Math.min(step + 1, steps.length)} 步，共 ${steps.length} 步`;
    sendBtn.disabled = true; sendBtn.textContent = "思考中…";

    try {
      if (step < steps.length) {
        conversation.append(element("article", { className: "qa-message assistant" }, [element("strong", { text: "项目创建助手" }), element("p", { text: steps[step] })]));
      } else {
        const suggestion = await api("/api/projects/suggest", {
          method: "POST", mutation: true, body: { conversation: collectedInfo }
        });
        const suggested = suggestion.suggestion ?? {};
        conversation.append(element("article", { className: "qa-message assistant" }, [
          element("strong", { text: "项目创建助手" }),
          element("p", { text: `好的！根据你提供的信息，我建议创建以下项目：` }),
          element("p", { text: `名称：${suggested.name ?? collectedInfo.name}` }),
          element("p", { text: `模板：${suggested.templateId === "campaign-map-v1" ? "作战地图" : "标准项目"}` }),
          ...(suggested.summary ? [element("p", { text: `摘要：${suggested.summary}` })] : [])
        ]));
        const confirmBtn = element("button", { type: "button", className: "primary-button", text: "确认创建", onClick: () => {
          backdrop.remove();
          openConfirmProjectDialog(refresh, {
            id: suggested.id ?? "",
            name: suggested.name ?? collectedInfo.name,
            templateId: suggested.templateId ?? "standard-project-v1",
            summary: suggested.summary ?? collectedInfo.goal,
            sourceHint: "基于对话引导自动生成"
          }, returnFocus);
        } });
        const cancelBtn = element("button", { type: "button", className: "secondary-button", text: "重新对话", onClick: () => {
          step = 0;
          progress.textContent = `第 1 步，共 ${steps.length} 步`;
          collectedInfo = { name: "", goal: "", team: "", milestones: "" };
          conversation.append(element("article", { className: "qa-message assistant" }, [element("strong", { text: "项目创建助手" }), element("p", { text: "好的，让我们重新开始。你的项目叫什么？" })]));
        } });
        conversation.append(element("div", { className: "convo-actions" }, [confirmBtn, cancelBtn]));
      }
      conversation.scrollTop = conversation.scrollHeight;
    } catch (err) {
      error.textContent = err.message;
    } finally {
      sendBtn.disabled = false; sendBtn.textContent = "发送";
    }
  };

  const form = element("form", { onSubmit: e => { e.preventDefault(); void send(); } }, [input, error, sendBtn]);

  dialog.append(
    element("header", {}, [element("h2", { id: "create-convo-title", text: "对话式创建项目" }), closeButton]),
    element("p", { className: "dialog-copy", text: "通过对话描述你的项目，AI 会引导你完成信息收集并生成项目结构。" }),
    progress,
    conversation,
    form
  );
  backdrop.append(dialog);
  installDialogBehavior(backdrop, dialog, close, input);
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


async function renderSettings() {
  if (!state.session.user.isPlatformAdmin) {
    showToast("仅平台管理员可访问设置");
    navigate("/projects", { replace: true });
    return;
  }
  const appContent = element("div", { className: "route-loading", ariaBusy: "true" }, [element("h1", { text: "平台设置" })]);
  app.replaceChildren(appFrame(appContent, { projectMode: false }));

  let settings;
  try {
    settings = await api("/api/settings");
  } catch (error) {
    appContent.replaceChildren(element("div", { className: "module-error error-panel", role: "alert" }, [
      element("h2", { text: "无法加载设置" }),
      element("p", { text: error.message }),
      element("button", { type: "button", className: "primary-button", text: "重试", onClick: () => renderSettings() })
    ]));
    return;
  }

  /**
   * model selector component:
   *   - select dropdown (initially empty or with current value only)
   *   - fetch models button: uses URL+Key to call API for available models
   *   - manual input toggle: when fetch fails or custom value needed
   */
  function createModelSelector(label, config, scopeName) {
    const currentModel = config.model ?? "";
    const wrapper = element("div", { className: "model-selector" });
    const modelSelect = element("select", { id: `${label}-model`, name: `${label}-model` });
    // Populate initial option based on current model
    if (currentModel) {
      modelSelect.append(element("option", { value: currentModel, text: currentModel, selected: true }));
    } else {
      modelSelect.append(element("option", { value: "", text: "（请获取或手动输入）" }));
    }
    const modelInput = element("input", { type: "text", id: `${label}-model-input`, placeholder: "手动输入模型名称", value: "" });
    modelInput.style.display = "none";
    const fetchBtn = element("button", { type: "button", className: "secondary-button model-fetch-btn", text: "获取模型列表" });
    const modelErr = element("small", { className: "form-hint model-fetch-hint" });
    const toggleInput = element("a", { href: "#", className: "model-toggle-input", text: "手动输入", onClick: (e) => {
      e.preventDefault();
      const isInput = modelInput.style.display !== "none";
      if (isInput) {
        modelInput.style.display = "none";
        modelSelect.style.display = "";
        toggleInput.textContent = "手动输入";
        // 如果手输入了值，同步回下拉
        if (modelInput.value.trim()) {
          const existing = [...modelSelect.options].find(o => o.value === modelInput.value.trim());
          if (!existing) {
            modelSelect.replaceChildren(element("option", { value: modelInput.value.trim(), text: modelInput.value.trim(), selected: true }));
          } else {
            modelSelect.value = modelInput.value.trim();
          }
        }
      } else {
        modelSelect.style.display = "none";
        modelInput.style.display = "";
        toggleInput.textContent = "下拉选择";
        modelInput.value = modelSelect.value;
        modelInput.focus();
      }
    }});

    fetchBtn.addEventListener("click", async () => {
      const baseUrlEl = document.getElementById(`${label}-base-url`);
      const apiKeyEl = document.getElementById(`${label}-api-key`);
      const baseUrl = baseUrlEl?.value?.trim() || config.baseUrl || "";
      const apiKey = apiKeyEl?.value?.trim() || "";
      if (!baseUrl) {
        modelErr.textContent = "请先填写 API 地址";
        return;
      }
      fetchBtn.disabled = true;
      fetchBtn.textContent = "获取中…";
      modelErr.textContent = "";
      try {
        const result = await api("/api/settings/fetch-models", {
          method: "POST",
          mutation: true,
          body: { scope: scopeName, baseUrl, apiKey }
        });
        const models = result.models || [];
        if (models.length === 0) {
          modelErr.textContent = "API 返回了空列表，可手动输入模型名";
          modelSelect.replaceChildren(element("option", { value: "", text: "（空列表，请手动输入）", selected: true }));
        } else {
          const prev = modelSelect.value || currentModel;
          modelSelect.replaceChildren(
            element("option", { value: "", text: "（请选择）" }),
            ...models.map(m => element("option", { value: m, text: m, selected: m === prev }))
          );
          if (prev && models.includes(prev)) modelSelect.value = prev;
          modelErr.textContent = `获取到 ${models.length} 个模型`;
        }
        // 确保下拉模式可见
        modelInput.style.display = "none";
        modelSelect.style.display = "";
        toggleInput.textContent = "手动输入";
      } catch (err) {
        modelErr.textContent = err.message || "获取失败，可手动输入";
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = "获取模型列表";
      }
    });

    // 提供一个 getValue 方法，供表单提交时调用
    wrapper.getModelValue = () => {
      if (modelInput.style.display !== "none") return modelInput.value.trim();
      return modelSelect.value.trim();
    };

    wrapper.replaceChildren(
      element("div", { className: "model-selector-controls" }, [
        modelSelect,
        modelInput,
        fetchBtn,
        toggleInput
      ]),
      modelErr
    );
    return wrapper;
  }

  function providerForm(label, config, endpoint) {
    const providerSelect = element("select", { id: `${label}-provider` }, [
      element("option", { value: "disabled", text: "未启用", selected: config.provider === "disabled" }),
      element("option", { value: "openai-compatible", text: "OpenAI 兼容", selected: config.provider === "openai-compatible" })
    ]);
    const baseUrl = element("input", { type: "url", id: `${label}-base-url`, name: `${label}-base-url`, autoComplete: "url", value: config.baseUrl ?? "", placeholder: ["https:", "//api.example.com/v1"].join("") });
    const apiKey = element("input", { type: "password", id: `${label}-api-key`, name: `${label}-api-key`, autoComplete: "new-password", value: "", placeholder: config.apiKeySet ? `已配置（${config.apiKeyMasked}）` : "输入 API Key" });
    const modelSelector = createModelSelector(label, config, label === "gen" ? "generation" : label);
    const allowedHosts = element("input", { type: "text", id: `${label}-hosts`, name: `${label}-hosts`, autoComplete: "off", value: config.allowedHosts ?? "", placeholder: "api.example.com" });
    const err = element("p", { className: "form-error", role: "alert" });
    const save = element("button", { type: "submit", className: "primary-button", text: "保存" });
    const status = element("span", {
      className: `provider-status ${config.provider === "disabled" ? "disabled" : config.apiKeySet ? "configured" : "incomplete"}`,
      text: config.provider === "disabled" ? "未启用" : config.apiKeySet ? "已配置" : "缺少密钥"
    });
    const testConnection = element("button", { type: "button", className: "secondary-button", text: "测试连接", disabled: config.provider === "disabled", onClick: async () => {
      err.textContent = "";
      testConnection.disabled = true;
      testConnection.textContent = "测试中…";
      try {
        const result = await api("/api/settings/test-connection", {
          method: "POST",
          mutation: true,
          body: { scope: label === "gen" ? "generation" : label }
        });
        showToast(`连接成功 · ${result.latencyMs}ms`);
      } catch (requestError) {
        err.textContent = requestError.message;
      } finally {
        testConnection.disabled = config.provider === "disabled";
        testConnection.textContent = "测试连接";
      }
    } });

    const form = element("form", { className: "settings-form" });
    const submitProvider = async event => {
      event.preventDefault();
      err.textContent = "";
      save.disabled = true;
      save.textContent = "保存中…";
      try {
        await api(endpoint, {
          method: "PUT",
          mutation: true,
          body: {
            provider: providerSelect.value,
            baseUrl: baseUrl.value.trim(),
            apiKey: apiKey.value.trim(),
            model: modelSelector.getModelValue(),
            allowedHosts: allowedHosts.value.trim()
          }
        });
        showToast("设置已保存，重启后生效");
        renderSettings();
      } catch (e) {
        err.textContent = e.message;
      } finally {
        save.disabled = false;
        save.textContent = "保存";
      }
    };
    form.addEventListener("submit", submitProvider);
    form._baseSubmitHandler = submitProvider;

    form.replaceChildren(
      element("div", { className: "provider-form-status" }, [
        element("strong", { text: "连接配置" }),
        element("div", { className: "provider-status-actions" }, [status, testConnection])
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-provider`, text: "服务类型" }), providerSelect
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-base-url`, text: "API 地址" }), baseUrl
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-api-key`, text: "API Key" }), apiKey,
        config.apiKeySet ? element("small", { className: "form-hint", text: `当前: ${config.apiKeyMasked}，留空则不修改` }) : null
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-model`, text: "模型名称" }),
        element("small", { className: "form-hint", text: '先填好 API 地址和 Key，再点「获取模型列表」' }),
        modelSelector
      ]),
      element("details", { className: "settings-advanced" }, [
        element("summary", { text: "高级设置" }),
        element("div", { className: "field" }, [
          element("label", { htmlFor: `${label}-hosts`, text: "允许的域名" }), allowedHosts,
          element("small", { className: "form-hint", text: "多个用逗号分隔，必须与 API 地址域名一致" })
        ])
      ]),
      err,
      element("div", { className: "settings-form-actions" }, [save])
    );
    return form;
  }

  function genProviderForm(label, config, endpoint) {
    const form = providerForm(label, config, endpoint);
    form.removeEventListener("submit", form._baseSubmitHandler);
    // Add generation-specific fields before the error/save buttons
    const timeout = element("input", { type: "number", id: `${label}-timeout`, value: config.timeoutMs ?? 60000, min: 1000, max: 600000, step: 1000 });
    const maxTokens = element("input", { type: "number", id: `${label}-tokens`, value: config.maxOutputTokens ?? 8000, min: 100, max: 8000, step: 100 });
    const reasoning = element("select", { id: `${label}-reasoning` }, [
      element("option", { value: "", text: "默认", selected: !config.reasoningEffort }),
      element("option", { value: "none", text: "关闭推理", selected: config.reasoningEffort === "none" }),
      element("option", { value: "minimal", text: "最小", selected: config.reasoningEffort === "minimal" }),
      element("option", { value: "low", text: "低", selected: config.reasoningEffort === "low" }),
      element("option", { value: "medium", text: "中", selected: config.reasoningEffort === "medium" }),
      element("option", { value: "high", text: "高", selected: config.reasoningEffort === "high" })
    ]);

    // Patch the submit handler to include gen-specific fields
    const extraFields = element("details", { className: "settings-advanced" }, [
      element("summary", { text: "生成高级设置" }),
      element("div", { className: "field" }, [element("label", { htmlFor: `${label}-timeout`, text: "超时（毫秒）" }), timeout]),
      element("div", { className: "field" }, [element("label", { htmlFor: `${label}-tokens`, text: "最大输出 Token" }), maxTokens]),
      element("div", { className: "field" }, [element("label", { htmlFor: `${label}-reasoning`, text: "推理强度" }), reasoning])
    ]);
    // Insert extra fields before the last two children (error + save)
    const kids = [...form.children];
    form.replaceChildren(...kids.slice(0, -2), extraFields, ...kids.slice(-2));

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const save = form.querySelector("button[type=submit]");
      const err = form.querySelector(".form-error");
      err.textContent = "";
      save.disabled = true;
      save.textContent = "保存中…";
      try {
        await api(endpoint, {
          method: "PUT",
          mutation: true,
          body: {
            provider: form.querySelector(`#${label}-provider`).value,
            baseUrl: form.querySelector(`#${label}-base-url`).value.trim(),
            apiKey: form.querySelector(`#${label}-api-key`).value.trim(),
            model: (() => {
              const sel = form.querySelector(`#${label}-model`);
              const inp = form.querySelector(`#${label}-model-input`);
              return (inp && inp.style.display !== "none") ? inp.value.trim() : (sel?.value?.trim() || "");
            })(),
            allowedHosts: form.querySelector(`#${label}-hosts`).value.trim(),
            timeoutMs: Number(form.querySelector(`#${label}-timeout`).value),
            maxOutputTokens: Number(form.querySelector(`#${label}-tokens`).value),
            reasoningEffort: form.querySelector(`#${label}-reasoning`).value
          }
        });
        showToast("设置已保存，重启后生效");
        renderSettings();
      } catch (e) {
        err.textContent = e.message;
      } finally {
        save.disabled = false;
        save.textContent = "保存";
      }
    });
    return form;
  }

  function visionProviderForm(label, config, endpoint) {
    const providerSelect = element("select", { id: `${label}-provider` }, [
      element("option", { value: "disabled", text: "未启用", selected: config.provider === "disabled" }),
      element("option", { value: "openai-compatible", text: "OpenAI 兼容", selected: config.provider === "openai-compatible" })
    ]);
    const baseUrl = element("input", { type: "url", id: `${label}-base-url`, name: `${label}-base-url`, autoComplete: "url", value: config.baseUrl ?? "", placeholder: "https://api.example.com/v1" });
    const apiKey = element("input", { type: "password", id: `${label}-api-key`, name: `${label}-api-key`, autoComplete: "new-password", value: "", placeholder: config.apiKeySet ? `已配置（${config.apiKeyMasked}）` : "输入 API Key（留空则复用上方项目更新 AI 的 Key）" });

    // 模型选择器：填好 URL+Key 后点"获取模型列表"动态加载，也可手动输入
    const modelSelector = createModelSelector(label, config, "vision");

    const allowedHosts = element("input", { type: "text", id: `${label}-hosts`, name: `${label}-hosts`, autoComplete: "off", value: config.allowedHosts ?? "", placeholder: "api.example.com" });
    const timeout = element("input", { type: "number", id: `${label}-timeout`, value: config.timeoutMs ?? 120000, min: 1000, max: 600000, step: 1000 });
    const maxTokens = element("input", { type: "number", id: `${label}-tokens`, value: config.maxOutputTokens ?? 4000, min: 100, max: 16000, step: 100 });
    const err = element("p", { className: "form-error", role: "alert" });
    const save = element("button", { type: "submit", className: "primary-button", text: "保存" });
    const status = element("span", {
      className: `provider-status ${config.provider === "disabled" ? "disabled" : config.apiKeySet ? "configured" : "incomplete"}`,
      text: config.provider === "disabled" ? "未启用" : config.apiKeySet ? "已配置" : "复用更新 AI 密钥"
    });
    const testConnection = element("button", { type: "button", className: "secondary-button", text: "测试连接", disabled: config.provider === "disabled", onClick: async () => {
      err.textContent = "";
      testConnection.disabled = true;
      testConnection.textContent = "测试中…";
      try {
        const result = await api("/api/settings/test-connection", { method: "POST", mutation: true, body: { scope: "vision" } });
        showToast(`连接成功 · ${result.latencyMs}ms`);
      } catch (requestError) {
        err.textContent = requestError.message;
      } finally {
        testConnection.disabled = config.provider === "disabled";
        testConnection.textContent = "测试连接";
      }
    } });

    const form = element("form", { className: "settings-form" });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      err.textContent = "";
      save.disabled = true;
      save.textContent = "保存中…";
      try {
        await api(endpoint, {
          method: "PUT",
          mutation: true,
          body: {
            provider: providerSelect.value,
            baseUrl: baseUrl.value.trim(),
            apiKey: apiKey.value.trim(),
            model: modelSelector.getModelValue(),
            allowedHosts: allowedHosts.value.trim(),
            timeoutMs: Number(timeout.value),
            maxOutputTokens: Number(maxTokens.value)
          }
        });
        showToast("设置已保存，重启后生效");
        renderSettings();
      } catch (e) {
        err.textContent = e.message;
      } finally {
        save.disabled = false;
        save.textContent = "保存";
      }
    });

    form.replaceChildren(
      element("div", { className: "provider-form-status" }, [
        element("strong", { text: "连接配置" }),
        element("div", { className: "provider-status-actions" }, [status, testConnection])
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-provider`, text: "服务类型" }), providerSelect
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-model`, text: "视觉模型" }),
        element("small", { className: "form-hint", text: '先填好 API 地址和 Key，再点「获取模型列表」' }),
        modelSelector
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-base-url`, text: "API 地址" }), baseUrl,
        element("small", { className: "form-hint", text: "填写您的 AI 服务商 API 地址" })
      ]),
      element("div", { className: "field" }, [
        element("label", { htmlFor: `${label}-api-key`, text: "API Key" }), apiKey,
        config.apiKeySet ? element("small", { className: "form-hint", text: `当前: ${config.apiKeyMasked}，留空则不修改` }) : element("small", { className: "form-hint", text: "留空则复用项目更新 AI 的 Key" })
      ]),
      element("details", { className: "settings-advanced" }, [
        element("summary", { text: "高级设置" }),
        element("div", { className: "field" }, [
          element("label", { htmlFor: `${label}-hosts`, text: "允许的域名" }), allowedHosts,
          element("small", { className: "form-hint", text: "多个用逗号分隔" })
        ]),
        element("div", { className: "field" }, [element("label", { htmlFor: `${label}-timeout`, text: "超时（毫秒）" }), timeout]),
        element("div", { className: "field" }, [element("label", { htmlFor: `${label}-tokens`, text: "最大输出 Token" }), maxTokens])
      ]),
      err,
      element("div", { className: "settings-form-actions" }, [save])
    );
    return form;
  }

  const changePassForm = element("form", { className: "settings-form" });
  const cpCurrent = element("input", { type: "password", autoComplete: "current-password", required: true });
  const cpNew = element("input", { type: "password", autoComplete: "new-password", required: true, minLength: 12 });
  const cpConfirm = element("input", { type: "password", autoComplete: "new-password", required: true, minLength: 12 });
  const cpErr = element("p", { className: "form-error", role: "alert" });
  const cpSubmit = element("button", { type: "submit", className: "primary-button", text: "修改密码" });
  changePassForm.addEventListener("submit", async event => {
    event.preventDefault();
    cpErr.textContent = "";
    if (cpNew.value.length < 12) { cpErr.textContent = "新密码至少 12 个字符"; return; }
    if (cpNew.value !== cpConfirm.value) { cpErr.textContent = "两次输入不一致"; return; }
    cpSubmit.disabled = true; cpSubmit.textContent = "修改中…";
    try {
      await api("/api/account/password", { method: "POST", mutation: true, body: { currentPassword: cpCurrent.value, newPassword: cpNew.value } });
      showToast("密码已修改");
      cpCurrent.value = ""; cpNew.value = ""; cpConfirm.value = "";
    } catch (e) {
      cpErr.textContent = e.message;
    } finally {
      cpSubmit.disabled = false; cpSubmit.textContent = "修改密码";
    }
  });
  changePassForm.replaceChildren(
    element("div", { className: "field" }, [element("label", { text: "当前密码" }), cpCurrent]),
    element("div", { className: "field" }, [element("label", { text: "新密码（至少 12 位）" }), cpNew]),
    element("div", { className: "field" }, [element("label", { text: "确认新密码" }), cpConfirm]),
    cpErr, cpSubmit
  );

  appContent.replaceChildren(
    element("div", { className: "settings-page" }, [
      element("header", { className: "settings-header" }, [
        element("h1", { text: "平台设置" }),
        element("p", { text: "配置 AI 服务、账号安全与平台信息。" })
      ]),
      element("section", { className: "settings-section" }, [
        element("h2", { text: "项目问答 AI" }),
        element("p", { className: "settings-desc", text: "用于项目材料问答检索。配置后可在项目资料中使用问答功能。" }),
        providerForm("chat", settings.aiChat, "/api/settings/ai-chat")
      ]),
      element("section", { className: "settings-section" }, [
        element("h2", { text: "项目更新 AI" }),
        element("p", { className: "settings-desc", text: "用于从材料生成任务、路线等项目节点预览。配置后可在项目更新流程中生成并核对。" }),
        genProviderForm("gen", settings.aiGeneration, "/api/settings/ai-generation")
      ]),
      element("section", { className: "settings-section" }, [
        element("h2", { text: "材料视觉 AI" }),
        element("p", { className: "settings-desc", text: "用于提取 PDF、图片等非文本材料的内容（多模态识别）。配置后上传 PDF/图片不再依赖系统工具。" }),
        visionProviderForm("vision", settings.aiVision ?? {}, "/api/settings/ai-vision")
      ]),
      element("section", { className: "settings-section" }, [
        element("h2", { text: "账号安全" }),
        element("p", { className: "settings-desc", text: "修改当前账号密码。" }),
        changePassForm
      ]),
      element("section", { className: "settings-section" }, [
        element("h2", { text: "平台信息" }),
        element("dl", { className: "settings-info" }, [
          element("div", {}, [element("dt", { text: "当前账号" }), element("dd", { text: state.session.user.loginName })]),
          element("div", {}, [element("dt", { text: "角色" }), element("dd", { text: roleLabels[state.session.user.isPlatformAdmin ? "platform_admin" : ""] ?? "—" })])
        ])
      ])
    ])
  );
}

function renderPasswordReset() {
  const form = element("form", { className: "login-form", novalidate: true });
  const currentPassword = element("input", { type: "password", autoComplete: "current-password", required: true });
  const newPassword = element("input", { type: "password", autoComplete: "new-password", required: true, minLength: 12 });
  const confirmPassword = element("input", { type: "password", autoComplete: "new-password", required: true, minLength: 12 });
  const error = element("p", { className: "form-error", role: "alert" });
  const submit = element("button", { type: "submit", className: "primary-button", text: "修改密码" });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    if (newPassword.value.length < 12) {
      error.textContent = "新密码至少 12 个字符";
      newPassword.focus();
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      error.textContent = "两次输入的新密码不一致";
      confirmPassword.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "正在修改…";
    try {
      await api("/api/account/password", {
        method: "POST",
        mutation: true,
        body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
      });
      state.session = { ...state.session, mustResetPassword: false };
      showToast("密码已修改");
      navigate("/projects", { replace: true });
    } catch (requestError) {
      error.textContent = requestError.message;
      currentPassword.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = "修改密码";
    }
  });

  form.append(
    element("div", { className: "field" }, [element("label", { htmlFor: "current-password", text: "当前密码" }), currentPassword]),
    element("div", { className: "field" }, [element("label", { htmlFor: "new-password", text: "新密码（至少 12 位）" }), newPassword]),
    element("div", { className: "field" }, [element("label", { htmlFor: "confirm-password", text: "确认新密码" }), confirmPassword]),
    error,
    submit
  );

  app.replaceChildren(element("main", { className: "login-screen" }, [
    element("section", { className: "login-form-panel" }, [
      element("div", { className: "login-form-wrap" }, [
        element("span", { className: "eyebrow", text: "安全设置" }),
        element("h1", { text: "修改初始密码" }),
        element("p", { text: "首次登录需要设置新密码后才能使用平台。" }),
        form
      ])
    ])
  ]));
  currentPassword.focus();
}

async function renderRoute() {
  state.routeRequest += 1;
  if (!state.session) {
    if (location.pathname !== "/login") state.intendedPath = safeIntendedPath();
    history.replaceState({}, "", "/login");
    renderLogin();
    return;
  }
  if (state.session.mustResetPassword && location.pathname !== "/account/password") {
    history.replaceState({}, "", "/account/password");
    renderPasswordReset();
    return;
  }
  if (location.pathname === "/account/password") {
    renderPasswordReset();
    return;
  }
  if (location.pathname === "/login" || location.pathname === "/") {
    navigate("/projects", { replace: true });
    return;
  }
  if (location.pathname === "/settings") {
    renderSettings();
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
  const updateProposalMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/updates\/proposals\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (updateProposalMatch) {
    await renderProject(updateProposalMatch[1], "materials", "", { workspace: "update", proposalId: updateProposalMatch[2] });
    return;
  }
  const updatePreviewMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/updates\/preview\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (updatePreviewMatch) {
    await renderProject(updatePreviewMatch[1], "materials", "", { workspace: "update", previewProposalId: updatePreviewMatch[2] });
    return;
  }
  const updateGenerationTaskMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/updates\/generation-tasks\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/);
  if (updateGenerationTaskMatch) {
    await renderProject(updateGenerationTaskMatch[1], "materials", "", { workspace: "update", generationTaskId: updateGenerationTaskMatch[2] });
    return;
  }
  const updateReleaseMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/updates\/release$/);
  if (updateReleaseMatch) {
    await renderProject(updateReleaseMatch[1], "materials", "", { workspace: "update", updateView: "release" });
    return;
  }
  const updateMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/updates$/);
  if (updateMatch) {
    await renderProject(updateMatch[1], "materials", "", { workspace: "update" });
    return;
  }
  const moduleMatch = location.pathname.match(/^\/projects\/([a-z0-9][a-z0-9._-]{2,63})\/modules\/([a-z0-9][a-z0-9-]{1,63})$/);
  if (moduleMatch) {
    if (moduleMatch[2] === "overview") {
      navigate(`/projects/${encodeURIComponent(moduleMatch[1])}${location.search}`, { replace: true });
      return;
    }
    const legacyMaterialView = new URLSearchParams(location.search).get("view");
    if (moduleMatch[2] === "materials" && legacyMaterialView === "proposals") {
      navigate(`/projects/${encodeURIComponent(moduleMatch[1])}/updates`, { replace: true });
      return;
    }
    if (moduleMatch[2] === "materials" && legacyMaterialView === "release") {
      navigate(`/projects/${encodeURIComponent(moduleMatch[1])}/updates/release`, { replace: true });
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
    navigate(`/projects/${encodeURIComponent(proposalMatch[1])}/updates/proposals/${encodeURIComponent(proposalMatch[2])}${location.search}`, { replace: true });
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
