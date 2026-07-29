import { chromium } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "http://127.0.0.1:4173";
const OUT = resolve("test-results/demo-screenshots");
mkdirSync(OUT, { recursive: true });
const PID = "xugu-agentic-group";

async function snap(page, name, description) {
  const path = resolve(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  const size = statSync(path).size;
  console.log(`  ✓ ${name}: ${description} (${Math.round(size/1024)}KB)`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log("\n=== 平台截图开始 ===\n");

// --- Login ---
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(800);
await snap(page, "01-login", "登录页面");

// Fill and submit via keyboard (Enter) to trigger SPA handler
await page.fill("#login-name", "admin");
await page.fill("#login-password", "admin12345678");
await page.press('button.login-submit', 'Enter');

// Wait for SPA to redirect to /projects (URL change)
await page.waitForURL("**/projects**", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);

// --- Project list ---
await snap(page, "02-project-list", "项目作战台 - 项目列表");

// Helper: navigate + wait + snap
async function nav(url, name, desc) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2500);
  await snap(page, name, desc);
}

// --- Core pages ---
await nav(`/projects/${PID}`, "03-project-overview", "作战总览");
await nav(`/projects/${PID}/modules/roadmap?view=swimlane`, "04-roadmap-swimlane", "项目路线图 · 卡片泳道（默认视图）");

// Expand a main task
try {
  await page.click(".spine-node, .main-task, [data-stage-id]", { timeout: 5000 });
  await page.waitForTimeout(1500);
  await snap(page, "05-roadmap-expanded", "项目路线图 · 主任务展开态");
} catch { console.log("  (展开态跳过)"); }

await nav(`/projects/${PID}/modules/roadmap?view=board`, "06-roadmap-board", "阶段卡片板");
await nav(`/projects/${PID}/modules/roadmap?view=units`, "07-roadmap-units", "作战单元进度");
await nav(`/projects/${PID}/modules/roadmap?view=network`, "08-roadmap-network", "依赖网络");
await nav(`/projects/${PID}/modules/gantt`, "09-gantt", "排期甘特");
await nav(`/projects/${PID}/modules/units`, "10-units", "作战单元 / 团队");
await nav(`/projects/${PID}/modules/materials`, "11-materials", "项目材料工作区");
await nav(`/projects/${PID}/modules/outcomes`, "12-outcomes", "战果档案");
await nav(`/projects/${PID}/modules/risks`, "13-risks", "风险台账");
await nav(`/projects/${PID}/modules/metrics`, "14-metrics", "效果指标");
await nav(`/projects/${PID}/modules/task-network`, "15-task-network", "任务网络");

await browser.close();
console.log("\n=== 全部完成 ===");
