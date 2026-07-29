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

test("project navigation groups nine safe modules into six user-facing work areas", () => {
  for (const copy of ["项目路线图", "排期甘特", "项目健康", "项目资料", "项目材料", "项目更新"]) {
    assert.match(app, new RegExp(copy));
  }
  assert.match(app, /types: \["roadmap", "task-network"\]/);
  assert.match(app, /types: \["risks", "metrics"\]/);
  assert.match(app, /types: \["outcomes", "materials"\]/);
  assert.match(app, /moduleSectionNavigation/);
  assert.match(app, /activeWorkspace === "update"/);
  assert.match(app, /\/updates/);
  assert.doesNotMatch(app.slice(app.indexOf("function moduleSectionNavigation"), app.indexOf("function canConfigureModules")), /AI 生成项目节点预览/);
  assert.match(css, /\.module-section-nav/);
  assert.doesNotMatch(app, /manifest\.modules\.map\(module => \{\s*const path = canonicalModulePath/);
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
  assert.match(renderers, /dataset: \{ stageId/);
  assert.match(renderers, /stage-task-chip/);
  assert.match(renderers, /dataset: \{ unitId/);
  assert.match(renderers, /ariaPressed/);
  assert.match(renderers, /unit-card-detail/);
  assert.match(renderers, /inline-task-detail/);
  assert.match(renderers, /项目路线图/);
  assert.doesNotMatch(renderers, /\["timeline", "活动路线图"\]/);
  assert.doesNotMatch(renderers, /data-closure-id/);
});

test("risks, metrics and materials preserve honest empty states and the controlled AI boundary", () => {
  for (const name of ["renderRisks", "renderMetrics", "renderMaterials"]) assert.match(renderers, new RegExp(`export function ${name}`));
  for (const copy of [
    "暂无已登记风险", "这表示尚未录入风险，不代表项目已确认无风险。", "暂无已登记指标",
    "上传与管理材料", "AI 只生成带来源的节点预览；不会修改项目草稿或发布版本。", "待补充", "目标"
  ]) assert.match(renderers, new RegExp(copy.replace(/[。]/g, "。")));
  assert.match(renderers, /input\.type = "file"/);
  assert.match(renderers, /renderNodePreviewRoadmap/);
  assert.match(renderers, /不会修改项目草稿或发布版本/);
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
    /\.swimlane-main-cards\s*\{/,
    /\.swimlane-task-card\s*\{/,
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

test("roadmap card swimlane keeps the main route and two-level task projection fixed", () => {
  for (const contract of [
    /function renderRoadmapSwimlane\(context\)/,
    /function openRoadmapCardEditor\(context, options\)/,
    /className: `roadmap-card-edit-button/,
    /提交编辑审核/,
    /placeholder: "输入：确认删除"/,
    /className: "swimlane-main-cards"/,
    /className: "swimlane-card-expansion"/,
    /className: "swimlane-child-focus"/,
    /class: "swimlane-child-slope"/,
    /className: "swimlane-child-panel"/,
    /className: "swimlane-task-stack swimlane-task-grid"/,
    /className: "swimlane-task-detail"/,
    /未选择时隐藏全部/,
    /副任务不按工期拉长/,
    /scroller\.scrollLeft \+= cardCenter - scrollerCenter/,
    /--swimlane-board-min-width:\$\{desktopBoardMinWidth\}px/,
    /expandAlign: expansionAlign\(index\)/,
    /querySelector\("\.swimlane-task-card-shell\.expanded"\)/
  ]) assert.match(renderers, contract);
  for (const contract of [
    /\.swimlane-main-cards\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--stage-count\)/,
    /\.swimlane-task-card-shell\s*\{[^}]*border-left:\s*4px solid var\(--unit-accent\)/,
    /\.roadmap-card-edit-button\s*\{/,
    /\.card-editor-danger\s*\{/,
    /\.swimlane-task-card\s*\{[^}]*width:\s*100%/,
    /\.swimlane-card-board\s*\{[^}]*min-width:\s*var\(--swimlane-board-min-width/,
    /\.swimlane-card-board\[data-open-stage\][^}]*background:\s*rgba\(15,\s*43,\s*76,\s*\.18\)/,
    /\.swimlane-stage-card\.selected\s*\{[^}]*width:\s*min\(420px,[^}]*backdrop-filter:\s*blur\(9px\)/,
    /\.swimlane-child-focus\s*\{[^}]*width:\s*min\(420px,/,
    /\.swimlane-child-panel\s*\{[^}]*width:\s*100%[^}]*background:\s*rgba\(241,\s*246,\s*255,\s*\.82\)/,
    /\.swimlane-child-slope path\s*\{[^}]*stroke:\s*rgba\(30,\s*101,\s*204,\s*\.58\)/,
    /\.swimlane-task-stack\s*\{[^}]*grid-template-columns:\s*repeat\(3,/,
    /\.swimlane-task-card-shell\.expanded\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*width:\s*100%/,
    /\.unit-color-6\s*\{/
  ]) assert.match(css, contract);
});
