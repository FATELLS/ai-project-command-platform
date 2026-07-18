import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const registry = readFileSync(new URL("../public/modules/registry.js", import.meta.url), "utf8");
const shared = readFileSync(new URL("../public/modules/shared.js", import.meta.url), "utf8");
const renderers = readFileSync(new URL("../public/modules/renderers.js", import.meta.url), "utf8");

const expectedTypes = ["overview", "roadmap", "units", "task-network", "gantt", "outcomes", "risks", "metrics", "materials"];

test("client registry contains exactly nine fixed safe renderer types and canonical routes", () => {
  for (const type of expectedTypes) assert.match(registry, new RegExp(`\\[?\\?*?"${type.replace("-", "\\-")}"`));
  assert.match(registry, /Object\.freeze/);
  assert.match(registry, /canonicalModulePath/);
  assert.match(registry, /type === "overview"/);
  assert.doesNotMatch(registry, /dynamic import|import\(|componentPath|rendererKey/);
  assert.match(app, /\/projects\/\$\{encodedProjectId\}\/modules|canonicalModulePath/);
  assert.match(app, /history\.pushState/);
  assert.match(app, /popstate/);
});

test("route and envelope state contract fails closed without mixing stale module data", () => {
  for (const copy of [
    "加载时间较长，请稍候…", "无法加载", "重新加载模块", "模块数据版本不受支持",
    "项目或模块不存在，或你无权访问", "返回项目总览", "会话已过期，请重新登录"
  ]) assert.match(`${app}\n${shared}`, new RegExp(copy));
  assert.match(shared, /envelope\.projectId !== expected\.projectId/);
  assert.match(shared, /envelope\.version !== expected\.version/);
  assert.match(shared, /expected\.allowedViews\.includes/);
  assert.match(app, /requestId !== state\.routeRequest/);
  assert.match(app, /replaceChildren/);
});

test("safe DOM and SVG renderers never accept project markup or executable URLs", () => {
  for (const source of [app, registry, shared, renderers]) {
    assert.doesNotMatch(source, /\.innerHTML\s*=/);
    assert.doesNotMatch(source, /insertAdjacentHTML|document\.write|eval\(|new Function|javascript:/);
    assert.doesNotMatch(source, /https?:\/\//);
  }
  assert.match(shared, /textContent/);
  assert.match(shared, /createElementNS/);
  assert.match(renderers, /svgEl\("(?:svg|circle|rect|line|polyline)"/);
  assert.doesNotMatch(renderers, /srcdoc|data:text\/html/);
});

test("overview, units, roadmap, network, gantt and outcomes are DTO-driven with honest states", () => {
  for (const name of ["renderOverview", "renderUnits", "renderRoadmap", "renderTaskNetwork", "renderGantt", "renderOutcomes"]) {
    assert.match(renderers, new RegExp(`export function ${name}`));
  }
  for (const copy of [
    "暂无正式完成率", "负责人待确认", "日期待确认", "层级关系", "依赖关系", "待排期",
    "未排期任务单列", "无本地预览"
  ]) assert.match(renderers, new RegExp(copy));
  assert.match(renderers, /Math\.max\(820/);
  assert.match(renderers, /dayNumber/);
  assert.match(renderers, /previewAssets/);
});

test("risks, metrics and materials preserve exact empty and Phase 4 boundary copy", () => {
  for (const name of ["renderRisks", "renderMetrics", "renderMaterials"]) assert.match(renderers, new RegExp(`export function ${name}`));
  for (const copy of [
    "暂无已登记风险", "这表示尚未录入风险，不代表项目已确认无风险。", "暂无已登记指标",
    "项目材料功能将在下一阶段开放", "当前页面不会读取或上传材料。", "待补充", "目标"
  ]) assert.match(renderers, new RegExp(copy.replace(/[。]/g, "。")));
  assert.doesNotMatch(renderers, /拖拽上传|创建问答|AI 生成|type: "file"/);
});

test("draft-only module configuration sheet is role-gated, ordered and transactional", () => {
  for (const copy of [
    "正在配置草稿模块；当前发布页面不会立即变化。", "必填模块", "上移", "下移",
    "保存草稿配置", "正在保存…", "放弃本次修改", "草稿模块配置已保存",
    "放弃未保存的模块配置？", "继续编辑", "放弃修改", "未能保存模块配置，请检查后重试"
  ]) assert.match(app, new RegExp(copy));
  assert.match(app, /\["platform_admin", "project_admin", "project_editor"\]/);
  assert.match(app, /\/draft\/modules/);
  assert.match(app, /method: "PATCH", mutation: true/);
  assert.doesNotMatch(app, /发布草稿|raw JSON|component path/i);
});

test("responsive and accessibility CSS keeps local scrolling and Xugu frame", () => {
  for (const contract of [
    /\.public-header\s*\{[^}]*height:\s*76px/,
    /\.public-header\s*\{[^}]*padding-inline:\s*32px/,
    /\.visual-scroll[^}]*overflow:\s*auto/,
    /\.module-config-sheet/,
    /@media \(max-width: 1279px\)/,
    /@media \(max-width: 767px\)/,
    /@media \(prefers-reduced-motion: reduce\)/,
    /:focus-visible\s*\{[^}]*outline:\s*3px/
  ]) assert.match(css, contract);
  assert.match(css, /grid-template-columns:\s*1\.25fr \.85fr/);
  assert.match(css, /min-height:\s*40px/);
  assert.doesNotMatch(css, /@import|url\(["']?https?:/);
});
