import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createApp } from "../src/http/app.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createAuthService } from "../src/services/auth-service.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const materialTemplateDownloads = readFileSync(new URL("../public/material-template-downloads.js", import.meta.url), "utf8");
const clientRegistry = readFileSync(new URL("../public/modules/registry.js", import.meta.url), "utf8");
const clientShared = readFileSync(new URL("../public/modules/shared.js", import.meta.url), "utf8");
const clientRenderers = readFileSync(new URL("../public/modules/renderers.js", import.meta.url), "utf8");

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "platform-ui-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  applyMigrations(database);
  importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
  createAuthService(database).ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-test-password", displayName: "Admin" });
  const server = createServer(createApp({ database }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise(resolve => server.close(resolve));
      database.close();
    }
  };
}

test("HTML is local, semantic, and contains no project facts before login", () => {
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /<main class="boot-screen"/);
  assert.match(html, /<link rel="stylesheet" href="\/styles\.css">/);
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /虚谷伟业|xugu-agentic-group|29|v4\.2/);
  assert.doesNotMatch(html, /<script[^>]*>\s*[^<]/);
  assert.doesNotMatch(html, /style="/);
});

test("CSS implements Xugu-aligned desktop frame, focus, and responsive fallbacks", () => {
  for (const token of ["--navy-950", "--blue-600", "--orange-600", "--green-600", "--shadow-card", "--radius-card"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 1279px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(3/);
  assert.match(css, /min-height:\s*40px/);
  assert.match(css, /\.public-header\s*\{[^}]*height:\s*76px/);
  assert.match(css, /global-background\.png/);
  assert.match(css, /\.goal-hero\s*\{[^}]*grid-template-columns:\s*1\.25fr \.85fr/);
  assert.match(css, /\.overall-card\s*\{[^}]*background:\s*linear-gradient/);
  assert.doesNotMatch(css, /\.global-rail|grid-template-columns:\s*72px/);
  assert.doesNotMatch(css, /@import|url\(["']?https?:/);
});

test("client contract keeps credentials in memory and renders server data through safe DOM APIs", () => {
  const completeClient = `${client}\n${materialTemplateDownloads}\n${clientRegistry}\n${clientShared}\n${clientRenderers}`;
  for (const copy of [
    "登录项目作战平台", "登录平台", "清除搜索条件", "没有找到匹配项目", "重新加载项目",
    "项目或模块不存在，或你无权访问", "暂无正式完成率", "模块配置", "归档项目", "恢复项目",
    "会话已过期，请重新登录"
  ]) assert.match(completeClient, new RegExp(copy));
  assert.match(client, /credentials:\s*"same-origin"/);
  assert.match(client, /replaceChildren/);
  assert.match(client, /textContent/);
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(client, /eval\(|new Function|https?:\/\//);
  assert.match(client, /pageshow/);
  assert.match(client, /history\.replaceState/);
  assert.match(client, /ariaModal/);
  assert.match(client, /public-header/);
  for (const projectCopy of [
    "XUGU AGENTIC GROUP SCHEDULE", "OVERALL MISSION · 总作战目标", "CURRENT CAMPAIGN",
    "STANDARD PROJECT SCHEDULE", "PROJECT OVERVIEW · 项目目标", "CURRENT STATUS"
  ]) assert.match(client, new RegExp(projectCopy));
  assert.match(client, /projectPresentation\(project\)/);
  assert.match(client, /project\?\.name/);
  assert.doesNotMatch(client, /global-rail/);
  assert.doesNotMatch(client, /即将开放/);
  assert.match(client, /public\/modules|\/modules\/registry\.js|canonicalModulePath/);
  for (const source of [client, materialTemplateDownloads, clientRegistry, clientShared, clientRenderers]) {
    assert.doesNotMatch(source, /\.innerHTML\s*=/);
    assert.doesNotMatch(source, /eval\(|new Function|javascript:/);
  }
});

test("security headers, MIME types, and direct routes are deterministic", async () => {
  const context = await setup();
  try {
    for (const route of ["/", "/login", "/projects", "/projects/xugu-agentic-group", "/projects/xugu-agentic-group/modules/roadmap"]) {
      const response = await fetch(`${context.baseUrl}${route}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /^text\/html/);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(await response.text(), html);
    }
    const script = await fetch(`${context.baseUrl}/app.js`);
    assert.match(script.headers.get("content-type"), /^text\/javascript/);
    assert.equal(await script.text(), client);
    const templateScript = await fetch(`${context.baseUrl}/material-template-downloads.js`);
    assert.match(templateScript.headers.get("content-type"), /^text\/javascript/);
    assert.equal(await templateScript.text(), materialTemplateDownloads);
    for (const [route, expected] of [["registry.js", clientRegistry], ["shared.js", clientShared], ["renderers.js", clientRenderers]]) {
      const moduleScript = await fetch(`${context.baseUrl}/modules/${route}`);
      assert.match(moduleScript.headers.get("content-type"), /^text\/javascript/);
      assert.equal(await moduleScript.text(), expected);
    }
    const stylesheet = await fetch(`${context.baseUrl}/styles.css`);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);
    assert.equal(await stylesheet.text(), css);
    for (const asset of ["global-background.png", "brand-wave.png", "transformation-group-transparent-v2.png"]) {
      const response = await fetch(`${context.baseUrl}/assets/${asset}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.ok((await response.arrayBuffer()).byteLength > 1_000);
    }
    const protectedResponse = await fetch(`${context.baseUrl}/api/projects`);
    assert.equal(protectedResponse.status, 401);
    assert.doesNotMatch(JSON.stringify(await protectedResponse.json()), /虚谷|xugu-agentic-group|v4\.2/);
    assert.equal((await fetch(`${context.baseUrl}/does-not-exist`)).status, 404);
  } finally { await context.close(); }
});
