import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { accounts } from "./helpers.mjs";

// 全轮只为每个角色登录一次，把会话 cookie 存成 storageState 供各 spec 复用。
// 这样既贴近真实浏览器会话，又不会撞上平台 5 次/15 分钟的登录限流。
const port = Number(process.env.E2E_PORT || 4191);
const base = `http://127.0.0.1:${port}`;
const stateDir = resolve(".e2e-auth");
mkdirSync(stateDir, { recursive: true });

async function saveRole(browser, name, account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("账号").fill(account.login);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录平台" }).click();
  await page.waitForURL(/\/projects/, { timeout: 15_000 });
  await context.storageState({ path: resolve(stateDir, `${name}.json`) });
  await context.close();
}

export default async function globalSetup() {
  const browser = await chromium.launch();
  try {
    for (const [name, account] of Object.entries(accounts)) {
      await saveRole(browser, name, account);
    }
  } finally {
    await browser.close();
  }
}
