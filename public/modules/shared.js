const SVG_NAMESPACE = ["h", "ttp:", "//www.w3.org/2000/svg"].join("");
const STABLE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LUCIDE_ICONS = Object.freeze({
  "arrow-left": [
    ["path", { d: "m12 19-7-7 7-7" }],
    ["path", { d: "M19 12H5" }]
  ],
  archive: [
    ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1" }],
    ["path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" }],
    ["path", { d: "M10 12h4" }]
  ],
  "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
  "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
  "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
  "circle-alert": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 8v4" }],
    ["path", { d: "M12 16h.01" }]
  ],
  "circle-check": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m9 12 2 2 4-4" }]
  ],
  diamond: [["path", { d: "m12 2 10 10-10 10L2 12Z" }]],
  "git-branch": [
    ["line", { x1: "6", x2: "6", y1: "3", y2: "15" }],
    ["circle", { cx: "18", cy: "6", r: "3" }],
    ["circle", { cx: "6", cy: "18", r: "3" }],
    ["path", { d: "M18 9a9 9 0 0 1-9 9" }]
  ],
  "log-out": [
    ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
    ["polyline", { points: "16 17 21 12 16 7" }],
    ["line", { x1: "21", x2: "9", y1: "12", y2: "12" }]
  ],
  "panel-top": [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M3 9h18" }]
  ],
  "message-circle": [["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }]],
  "message-square": [["path", { d: "M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" }]],
  package: [
    ["path", { d: "m21 8-9 5-9-5" }],
    ["path", { d: "M3 8 12 3l9 5v8l-9 5-9-5Z" }],
    ["path", { d: "M12 13v8" }]
  ],
  pencil: [
    ["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }],
    ["path", { d: "m15 5 4 4" }]
  ],
  "refresh-cw": [
    ["path", { d: "M21 12a9 9 0 0 1-15.2 6.5L3 16" }],
    ["path", { d: "M3 21v-5h5" }],
    ["path", { d: "M3 12A9 9 0 0 1 18.2 5.5L21 8" }],
    ["path", { d: "M21 3v5h-5" }]
  ],
  "sliders-horizontal": [
    ["line", { x1: "21", x2: "14", y1: "4", y2: "4" }],
    ["line", { x1: "10", x2: "3", y1: "4", y2: "4" }],
    ["line", { x1: "21", x2: "12", y1: "12", y2: "12" }],
    ["line", { x1: "8", x2: "3", y1: "12", y2: "12" }],
    ["line", { x1: "21", x2: "16", y1: "20", y2: "20" }],
    ["line", { x1: "12", x2: "3", y1: "20", y2: "20" }],
    ["line", { x1: "14", x2: "14", y1: "2", y2: "6" }],
    ["line", { x1: "8", x2: "8", y1: "10", y2: "14" }],
    ["line", { x1: "16", x2: "16", y1: "18", y2: "22" }]
  ],
  "square-pen": [
    ["path", { d: "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }],
    ["path", { d: "M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" }]
  ],
  "triangle-alert": [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }]
  ],
  upload: [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { d: "m17 8-5-5-5 5" }],
    ["path", { d: "M12 3v12" }]
  ],
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }]
  ]
});

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

export function icon(name, options = {}) {
  const definition = LUCIDE_ICONS[name];
  if (!definition) throw new Error(`Unsupported icon: ${name}`);
  const size = options.size ?? 18;
  return svgEl("svg", {
    class: `ui-icon${options.className ? ` ${options.className}` : ""}`,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": options.strokeWidth ?? 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false"
  }, definition.map(([tag, attributes]) => svgEl(tag, attributes)));
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
  const visualTypes = new Set(["roadmap"]);
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
