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

// 1) 默认 timeline：粗主线 + 模块摘要芯片 + 模块检查器
await page.goto(ROADMAP);
await page.waitForSelector(".roadmap-svg");
await page.waitForSelector(".module-inspector");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/roadmap-default.png`, fullPage: true });
console.log("saved", `${OUT}/roadmap-default.png`);

// 2) 下钻：点阶段节点 launch，再点第一个作战单元模块卡片展开任务
await page.goto(`${ROADMAP}?stage=launch`);
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
