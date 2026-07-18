const SVG_NAMESPACE = ["http:", "//www.w3.org/2000/svg"].join("");
const STABLE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && !key.startsWith("aria")) node[key] = value;
    else if (key.startsWith("aria") && key.length > 4) {
      node.setAttribute(`aria-${key.slice(4).replace(/[A-Z]/g, character => `-${character.toLowerCase()}`).replace(/^-/, "")}`, String(value));
    } else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== undefined && child !== null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function svgEl(tag, attributes = {}, children = []) {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) if (child instanceof Node) node.append(child);
  return node;
}

export function safeText(value, fallback = "待补充") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function formatDay(value) {
  if (!value) return "待确认";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function emptyState(title, supporting = "需要由获授权成员补充已确认的项目数据。") {
  return el("section", { className: "module-empty empty-panel", role: "status" }, [
    el("div", { className: "empty-mark", ariaHidden: "true", text: "—" }),
    el("h2", { text: title }),
    el("p", { text: supporting })
  ]);
}

export function moduleError(title, message, retry) {
  return el("section", { className: "module-error error-panel", role: "alert" }, [
    el("h2", { text: title }),
    el("p", { text: message }),
    el("button", { type: "button", className: "primary-button", text: "重新加载模块", onClick: retry })
  ]);
}

export function unsupportedState(retry) {
  return moduleError("模块数据版本不受支持", "页面已停止渲染这份数据，避免显示不完整或跨版本事实。", retry);
}

export function moduleSkeleton(type) {
  const visualTypes = new Set(["roadmap", "task-network"]);
  const laneTypes = new Set(["gantt"]);
  const rowTypes = new Set(["risks"]);
  const className = visualTypes.has(type) ? "skeleton-diagram" : laneTypes.has(type) ? "skeleton-lanes" : rowTypes.has(type) ? "skeleton-rows" : "skeleton-cards";
  return el("section", { className: `module-skeleton ${className}`, ariaHidden: "true" },
    Array.from({ length: type === "overview" ? 4 : 3 }, () => el("i")));
}

export function validateEnvelope(envelope, expected) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return false;
  if (envelope.projectId !== expected.projectId || envelope.layer !== "published" || envelope.version !== expected.version) return false;
  if (envelope.template?.id !== expected.templateId || envelope.template?.version !== expected.templateVersion) return false;
  const module = envelope.module;
  if (!module || module.type !== expected.type || module.schemaVersion !== "1.0.0" || module.enabled !== true) return false;
  if (!STABLE_ID.test(module.type) || !expected.allowedViews.includes(module.viewVariant)) return false;
  return envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data);
}

export function validateManifest(manifest, expected, registryTypes) {
  if (!manifest || manifest.projectId !== expected.projectId || manifest.layer !== "published" || manifest.version !== expected.version) return false;
  if (manifest.template?.id !== expected.templateId || manifest.template?.version !== expected.templateVersion || !Array.isArray(manifest.modules)) return false;
  const seen = new Set();
  let previousPosition = -1;
  return manifest.modules.every(module => {
    if (!module || seen.has(module.type) || !registryTypes.includes(module.type) || !Number.isInteger(module.position) || module.position <= previousPosition || module.enabled !== true) return false;
    seen.add(module.type);
    previousPosition = module.position;
    return module.schemaVersion === "1.0.0" && typeof module.title === "string";
  });
}

export function localScroller(label, content) {
  return el("div", { className: "visual-scroll edge-fade", tabIndex: 0, role: "region", ariaLabel: label }, [content]);
}

export function definitionList(entries, className = "module-detail-list") {
  return el("dl", { className }, entries.flatMap(([term, value]) => [
    el("dt", { text: term }), el("dd", { text: safeText(value) })
  ]));
}

export function statusText(value) {
  return safeText(value, "状态待确认");
}
