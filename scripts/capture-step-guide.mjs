import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:4173";
const OUT = resolve("test-results/step-guide-screenshots");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Login
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.fill("#login-name", "admin");
await page.fill("#login-password", "admin12345678");
await page.press("button.login-submit", "Enter");
await page.waitForTimeout(3000);

// 1. Test project materials ledger - should show "→ 可生成建议" hint
await page.goto(BASE + "/projects/test/modules/materials?view=ledger", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: resolve(OUT, "01-ledger-with-hints.png") });
console.log("01 captured - ledger with hints");

// 2. Click into the material detail - should show step guide
const materialLink = await page.$("a[href*='/modules/materials/392b']");
if (materialLink) {
  await materialLink.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(OUT, "02-detail-step-guide.png") });
  console.log("02 captured - detail with step guide");
}

await browser.close();
console.log("Done");
