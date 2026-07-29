import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173";
const SHOTS = "/tmp/roadmap-shots";
import { mkdirSync } from "fs";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Login
await page.goto(BASE + "/login");
await page.fill('input[name="loginName"]', "admin");
await page.fill('input[name="password"]', "admin12345678");
await page.click('button[type="submit"]');
await page.waitForURL(/\/projects/);
console.log("Logged in");

// Navigate to roadmap
await page.goto(BASE + "/projects/test/modules/roadmap");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/01-roadmap-default.png`, fullPage: true });
console.log("Saved roadmap screenshot");

// Check for empty state text
const bodyText = await page.textContent("body");
if (bodyText?.includes("尚未建立")) {
  console.log("STILL EMPTY — roadmap shows empty state");
} else {
  console.log("HAS CONTENT — roadmap renders stages");
}

// Also capture swimlane view
await page.goto(BASE + "/projects/test/modules/roadmap?view=swimlane");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/02-roadmap-swimlane.png`, fullPage: true });

// Capture gantt
await page.goto(BASE + "/projects/test/modules/gantt");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/03-gantt.png`, fullPage: true });

console.log("All screenshots saved to", SHOTS);
await browser.close();
