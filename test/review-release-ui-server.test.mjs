import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderers=readFileSync(new URL("../public/modules/renderers.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/http/app.mjs",import.meta.url),"utf8");

test("review UI presents business changes, semantic comparison, evidence, decisions and atomic merge",()=>{
  for(const copy of ["当前值","建议值","审核后的建议值","证据来源","内容性质","可信程度","接受此项","驳回此项","编辑后接受","接受全部${proposalModuleLabels[module]??module}变更","应用到草稿","任一校验失败将整体回滚"])assert.match(renderers,new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(renderers,/review-diff-grid\$\{selected\.operation==="create"\?" create":""\}/);
  assert.match(renderers,/selected\.operation==="create"\?null/);
  for(const route of ["/review/","/review/modules/","/merge"])assert.match(renderers,new RegExp(route.replaceAll("/","\\/")));
  for(const segment of ["segments[5] === \"review\"","segments[5] === \"merge\""])assert.ok(app.includes(segment));
});

test("release center is project-scoped, role-gated and never exposes AI execution",()=>{
  for(const copy of ["审核发布中心","草稿差异预览","发布检查清单","受控发布","直接上一发布版本","发布历史","项目成员","审计日志","AI 无法执行这些动作"])assert.match(renderers,new RegExp(copy));
  for(const route of ["/preview","/history","/audit","/publish","/rollback","/members"])assert.match(renderers,new RegExp(route.replaceAll("/","\\/")));
  for(const segment of ["segments[4] === \"preview\"","segments[4] === \"publish\"","segments[3] === \"members\""])assert.ok(app.includes(segment));
  assert.doesNotMatch(renderers,/innerHTML|insertAdjacentHTML|eval\(|new Function/);
});

test("review and release layouts preserve desktop with tablet and mobile fallbacks",()=>{
  for(const rule of [/\.review-diff-grid/,/\.review-summary-grid/,/\.release-layout/,/\.release-version-grid/,/\.release-operations-grid/,/@media \(max-width: 1279px\)/,/@media \(max-width: 767px\)/])assert.match(css,rule);
  assert.match(css,/grid-template-columns:\s*minmax\(0,1\.35fr\) minmax\(300px,\.65fr\)/);
});
