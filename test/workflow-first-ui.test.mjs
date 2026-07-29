import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const renderers = readFileSync(new URL("../public/modules/renderers.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("project shell exposes six workspaces and one renderer-owned heading on detail routes", () => {
  const groupBlock = app.slice(app.indexOf("const groups = ["), app.indexOf("].map(group", app.indexOf("const groups = [")));
  assert.equal((groupBlock.match(/types:/g) ?? []).length, 6);
  assert.doesNotMatch(groupBlock, /sectionOverride/);
  assert.match(app, /rendererOwnsHeading/);
  assert.match(app, /requestedType === "overview" \|\| rendererOwnsHeading/);
  assert.match(app, /text: "项目"/);
});

test("project entry and overview place work ahead of decorative or technical context", () => {
  assert.match(app, /className: "page-head operational-page-head"/);
  assert.doesNotMatch(app.slice(app.indexOf("async function renderProjects"), app.indexOf("function projectSwitcher")), /command-orbit|command-status/);
  assert.match(renderers, /className: "project-context-strip"/);
  assert.match(renderers, /className: "overview-priority-grid"/);
  assert.match(renderers, /text: "项目更新"/);
  assert.match(renderers, /context\.project\.role === "viewer" \? null/);
});

test("materials lead with upload and list while quota stays in progressive disclosure", () => {
  const ledger = renderers.slice(renderers.indexOf("function renderLedger"), renderers.indexOf("function materialTable"));
  assert.ok(ledger.indexOf("workspace-action-header") < ledger.indexOf("material-toolbar"));
  assert.ok(ledger.indexOf("material-toolbar") < ledger.indexOf("workspace-usage-details"));
  assert.match(ledger, /text: "手动录入"/);
  assert.match(ledger, /ariaExpanded: "false"/);
});

test("generic project update begins with material instead of the latest proposal", () => {
  assert.match(renderers, /function renderUpdateStartWorkspace/);
  assert.match(renderers, /text: "上传本次更新材料"/);
  assert.match(renderers, /previewHref\(context, pending\.proposalId\), "继续上一次更新"/);
  assert.match(app, /updates\\\/preview/);
  assert.match(app, /updates\\\/generation-tasks/);
});

test("review is business-first and technical identifiers are folded", () => {
  assert.match(renderers, /proposalChangeTitle/);
  assert.match(renderers, /proposalFieldLabel/);
  assert.match(renderers, /className:"review-focus-summary"/);
  assert.match(renderers, /text:"原因与影响"/);
  assert.match(renderers, /className:"technical-details review-technical-details"/);
});

test("dialogs trap focus and restore the invoking control", () => {
  assert.match(app, /function installDialogBehavior/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /event\.key !== "Tab"/);
  assert.match(app, /returnFocus\?\.focus\?\.\(\)/);
  assert.match(app, /确认项目骨架/);
});

test("settings fold advanced fields, avoid login autofill and expose a connection test", () => {
  assert.match(app, /autoComplete: "new-password"/);
  assert.match(app, /className: "settings-advanced"/);
  assert.match(app, /text: "测试连接"/);
  assert.match(app, /\/api\/settings\/test-connection/);
});

test("mobile keeps core visual work available and uses 44px targets", () => {
  const finalMobile = css.slice(css.lastIndexOf("@media (max-width: 767px)"));
  assert.match(finalMobile, /\.visual-scroll\s*\{[^}]*display:\s*block/s);
  assert.doesNotMatch(finalMobile, /\.visual-scroll\s*\{[^}]*display:\s*none/s);
  assert.match(finalMobile, /min-height:\s*44px/);
  assert.match(css, /\.review-diff-grid\.create\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
