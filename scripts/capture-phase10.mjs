import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:4173";
const OUT = resolve("test-results/phase10-screenshots");
mkdirSync(OUT, { recursive: true });

const PID = "xugu-agentic-group";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Login
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 });
await page.fill("#login-name", "admin");
await page.fill("#login-password", "admin12345678");
await page.press("button.login-submit", "Enter");
await page.waitForTimeout(3000);

// 1. Project list with new "新建项目" button
await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(OUT, "01-project-list.png") });
console.log("01-project-list captured");

// 2. Open create dialog (three choices)
await page.click("button:has-text('新建项目')");
await page.waitForTimeout(800);
await page.screenshot({ path: resolve(OUT, "02-create-three-choices.png") });
console.log("02-create-three-choices captured");

// 3. Close dialog and go to material page
await page.press("body", "Escape");
await page.waitForTimeout(500);

// 4. Material ledger (no auth column)
await page.goto(`${BASE}/projects/${PID}/modules/materials?view=ledger`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: resolve(OUT, "03-materials-no-auth.png") });
console.log("03-materials-no-auth captured");

// 5. Material detail (no auth buttons)
const materialLink = await page.$(".material-table a[href*='materials/']");
if (materialLink) {
  await materialLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(OUT, "04-material-detail-no-auth.png") });
  console.log("04-material-detail-no-auth captured");
}

// 6. Project page with floating chat button
await page.goto(`${BASE}/projects/${PID}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(OUT, "05-floating-chat-closed.png") });
console.log("05-floating-chat-closed captured");

// 7. Open floating chat
const chatFab = await page.$(".chat-fab");
if (chatFab) {
  await chatFab.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(OUT, "06-floating-chat-open.png") });
  console.log("06-floating-chat-open captured");
}

// 8. Section nav on materials page
await page.goto(`${BASE}/projects/${PID}/modules/materials?view=proposals`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: resolve(OUT, "07-section-nav-proposals.png") });
console.log("07-section-nav-proposals captured");

await browser.close();
console.log("All Phase 10 screenshots captured");
