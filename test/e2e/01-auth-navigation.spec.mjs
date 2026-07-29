import { expect, test } from "@playwright/test";
import { accounts, loginViaForm } from "./helpers.mjs";

// 默认 use.storageState 已注入 admin 会话；以下需要未登录或其它流程的测试用独立 context。

test.describe("认证与平台导航", () => {
  test("管理员登录后进入项目作战台并看到两个授权项目", async ({ page }) => {
    await page.goto("/projects");
    const results = page.locator(".project-grid[aria-live]");
    await expect(results).toBeVisible();
    await expect(results.locator(".project-id", { hasText: "xugu-agentic-group" })).toBeVisible();
    await expect(results.locator(".project-id", { hasText: "standard-project-sample" })).toBeVisible();
  });

  test("未登录访问受保护路由会跳转登录", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "登录项目作战平台" })).toBeVisible();
    await context.close();
  });

  test("错误密码显示统一错误且不进入平台", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("账号").fill("admin");
    await page.getByLabel("密码").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "登录平台" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert")).toContainText(/账号或密码不正确|不正确|稍后/);
    await context.close();
  });

  test("走真实登录流程可进入作战台", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await loginViaForm(page, accounts.admin);
    await expect(page.locator(".project-grid[aria-live]")).toBeVisible();
    await context.close();
  });

  test("在两个项目之间切换不串库", async ({ page }) => {
    await page.goto("/projects/xugu-agentic-group");
    await expect(page.locator(".project-nav")).toBeVisible();
    await expect(page.getByText(/7\s*作战单元/).first()).toBeVisible();
    await page.goto("/projects/standard-project-sample");
    await expect(page).toHaveURL(/\/projects\/standard-project-sample/);
    await expect(page.locator(".project-id", { hasText: "standard-project-sample" })).toBeVisible();
  });

  test("一级导航收敛为六个工作区并保留健康与资料二级入口", async ({ page }) => {
    await page.goto("/projects/xugu-agentic-group/modules/roadmap");
    const primary = page.locator(".project-nav a");
    await expect(primary).toHaveCount(6);
    await expect(primary).toHaveText(["作战总览", "项目路线图", "作战单元", "排期甘特", "项目健康", "项目资料"]);
    await expect(page.locator(".project-nav a", { hasText: "任务网络" })).toHaveCount(0);

    await page.getByRole("link", { name: "项目健康", exact: true }).click();
    await expect(page).toHaveURL(/\/modules\/risks$/);
    await expect(page.locator(".module-section-nav a")).toHaveText(["风险台账", "效果指标"]);

    await page.getByRole("link", { name: "项目资料", exact: true }).click();
    await expect(page).toHaveURL(/\/modules\/outcomes$/);
    await expect(page.locator(".module-section-nav a", { hasText: "战果档案" })).toHaveCount(1);
    await expect(page.locator(".module-section-nav a", { hasText: "项目材料" })).toHaveCount(1);
    await expect(page.locator(".module-section-nav a")).toHaveCount(2);
    await expect(page.locator(".module-section-nav a", { hasText: "项目更新" })).toHaveCount(0);

    await page.goto("/projects/xugu-agentic-group/updates");
    await expect(page.getByRole("heading", { name: "项目更新", exact: true })).toBeVisible();
    await expect(page.locator(".module-section-nav")).toHaveCount(0);
    await expect(page.locator(".project-nav a.active")).toHaveCount(0);
  });
});
