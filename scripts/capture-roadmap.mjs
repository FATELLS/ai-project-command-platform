import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:4173";
const OUT = "/private/tmp";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });

await page.goto(`${BASE}/login`);
await page.getByLabel("账号").fill("admin");
await page.getByLabel("密码").fill("admin12345678");
await page.getByRole("button", { name: "登录平台" }).click();
await page.waitForURL(/\/projects/);

const ROADMAP = `${BASE}/projects/xugu-agentic-group/modules/roadmap`;

// 1) 默认项目泳道（主脊/副泳道反应式）：当前阶段 launch 默认展开，涉及单元任务条显现
await page.goto(ROADMAP);
await page.waitForSelector(".roadmap-swimlane");
await page.waitForSelector(".phase-station.open");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/roadmap-default.png`, fullPage: true });
console.log("saved", `${OUT}/roadmap-default.png`);

// 1b) 副泳道任务条浮层（单独打开/关闭）
await page.goto(`${ROADMAP}?view=swimlane&stage=launch`);
await page.waitForSelector(".swimlane-bar");
await page.locator(".swimlane-bar").first().click();
await page.waitForSelector(".swimlane-overlay");
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/roadmap-overlay.png`, fullPage: true });
console.log("saved", `${OUT}/roadmap-overlay.png`);

// 2) 活动路线图（曲线视图，现在为可切换视图）：粗主线 + 模块摘要芯片 + 模块检查器
await page.goto(`${ROADMAP}?view=timeline`);
await page.waitForSelector(".roadmap-svg");
await page.waitForSelector(".module-inspector");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/roadmap-timeline.png`, fullPage: true });
console.log("saved", `${OUT}/roadmap-timeline.png`);

// 2b) 曲线下钻：点阶段节点 launch，再点第一个作战单元模块卡片展开任务
await page.goto(`${ROADMAP}?view=timeline&stage=launch`);
await page.waitForSelector(".unit-module-card");
await page.locator(".unit-module-card").first().click();
await page.waitForURL(/unit=/);
await page.waitForTimeout(500);
if (await page.locator(".stage-task-chip").count() > 0) {
  await page.locator(".stage-task-chip").first().click();
  await page.waitForURL(/task=/);
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT}/roadmap-drill.png`, fullPage: true });
console.log("saved", `${OUT}/roadmap-drill.png`);

await browser.close();
