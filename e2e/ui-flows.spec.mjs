import { test, expect } from "@playwright/test";

/**
 * 前端 E2E 测试套件 — AI 项目作战管理平台
 *
 * 覆盖完整的用户交互流程：
 *   登录 → 项目列表 → 进入项目 → 路线图 → 切换 Tab →
 *   材料管理 → AI 节点预览 → 审核与发布 → 运维自检 → 退出
 *
 * 测试使用真实浏览器（Chromium headless），覆盖 UI 渲染、交互、路由、CSS。
 * 前提：由 playwright.config.mjs 的 webServer 自动启动 fixture server。
 */

const ADMIN_USER = "admin";
const ADMIN_PASS = "e2e-platform-admin-pw";

// ========== 辅助函数 ==========

/** 登录并返回到 /projects */
async function login(page) {
  await page.goto("/login");
  await page.locator("#login-name").fill(ADMIN_USER);
  await page.locator("#login-password").fill(ADMIN_PASS);
  await page.locator(".login-submit").click();
  // 等待跳转到项目列表页
  await page.waitForURL("**/projects", { timeout: 10_000 });
  await expect(page.locator("h1")).toContainText("项目作战台");
}

// ========== 测试用例 ==========

test.describe("01 登录流程", () => {
  test("成功登录跳转到项目列表", async ({ page }) => {
    await login(page);
    // 验证项目卡片渲染
    await expect(page.locator("article.project-card")).toHaveCount(await page.locator("article.project-card").count());
    const cardCount = await page.locator("article.project-card").count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("错误密码显示错误提示", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-name").fill(ADMIN_USER);
    await page.locator("#login-password").fill("wrong-password");
    await page.locator(".login-submit").click();
    // 等待错误提示出现
    await expect(page.locator(".form-error")).toBeVisible({ timeout: 5_000 });
    // 应该还停留在登录页
    await expect(page.locator("h1")).toContainText("登录");
  });

  test("空表单不提交", async ({ page }) => {
    await page.goto("/login");
    await page.locator(".login-submit").click();
    // 浏览器 required 属性会阻止提交，页面不跳转
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("02 项目列表页", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("项目卡片包含关键信息", async ({ page }) => {
    const firstCard = page.locator("article.project-card").first();
    await expect(firstCard.locator(".template-label")).toBeVisible();
    await expect(firstCard.locator(".badge.active, .badge.archived")).toBeVisible();
    await expect(firstCard.locator("h3")).toBeVisible();
    await expect(firstCard.locator(".card-footer")).toBeVisible();
    const technicalDetails = firstCard.locator("details.project-technical-details");
    await expect(technicalDetails.locator("summary")).toBeVisible();
    await expect(firstCard.locator(".project-id")).toBeHidden();
    await technicalDetails.locator("summary").click();
    await expect(firstCard.locator(".project-id")).toBeVisible();
  });

  test("搜索过滤项目", async ({ page }) => {
    // 先记录初始项目数
    const initialCount = await page.locator("article.project-card").count();

    // 搜索一个关键词
    await page.locator("#project-search").fill("研发");
    await page.waitForTimeout(500); // 等待防抖

    const filteredCount = await page.locator("article.project-card").count();
    // 搜索结果应该 <= 初始数量
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // 清除搜索
    await page.locator(".clear-search").click();
    await page.waitForTimeout(500);
    const restoredCount = await page.locator("article.project-card").count();
    expect(restoredCount).toBe(initialCount);
  });

  test("点击项目卡片进入项目详情", async ({ page }) => {
    const firstLink = page.locator("article.project-card h3 a").first();
    const projectName = await firstLink.textContent();
    await firstLink.click();

    // 验证进入项目页面
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });
    // 面包屑或模块标题应该可见
    await expect(page.locator(".module-page-heading, .breadcrumb")).toBeVisible();
  });

  test("项目切换器下拉工作", async ({ page }) => {
    // 先进入一个项目
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

    // 查找项目切换器
    const switcher = page.locator('select[aria-label="切换项目"]');
    if (await switcher.isVisible()) {
      const options = await switcher.locator("option").count();
      expect(options).toBeGreaterThan(1);
    }
  });
});

test.describe("03 项目详情页 — 模块导航", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });
  });

  test("模块导航栏可见且有多个模块", async ({ page }) => {
    const nav = page.locator("nav.project-nav");
    await expect(nav).toBeVisible();
    const moduleLinks = nav.locator("ul li a");
    const count = await moduleLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("总览的项目更新进入独立更新流程", async ({ page }) => {
    const updateLink = page.getByRole("link", { name: "项目更新", exact: true });
    await expect(updateLink).toBeVisible();
    await updateLink.click();
    await page.waitForURL(/\/updates$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "项目更新", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "先提交本次更新材料" })).toBeVisible();
    const uploadUpdateMaterial = page.getByRole("button", { name: "上传本次更新材料" });
    await expect(uploadUpdateMaterial).toBeVisible();
    await expect(page.locator(".project-update-roadmap")).toHaveCount(0);
    await uploadUpdateMaterial.click();
    await expect(page.getByRole("dialog", { name: /上传.*材料/ })).toBeVisible();
    await page.locator(".dialog-close").click();
  });

  test("切换到路线图模块", async ({ page }) => {
    const roadmapLink = page.locator('nav.project-nav a[href*="/modules/roadmap"], nav.project-nav a[href*="/modules/task-network"]');
    if (await roadmapLink.count() > 0) {
      await roadmapLink.first().click();
      await page.waitForURL(/\/modules\/(roadmap|task-network)/, { timeout: 10_000 });
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("切换到作战单元模块", async ({ page }) => {
    const unitsLink = page.locator('nav.project-nav a[href*="/modules/units"]');
    if (await unitsLink.count() > 0) {
      await unitsLink.first().click();
      await page.waitForURL(/\/modules\/units/, { timeout: 10_000 });
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("切换到排期甘特模块", async ({ page }) => {
    const ganttLink = page.locator('nav.project-nav a[href*="/modules/gantt"]');
    if (await ganttLink.count() > 0) {
      await ganttLink.first().click();
      await page.waitForURL(/\/modules\/gantt/, { timeout: 10_000 });
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("面包屑导航可返回项目列表", async ({ page }) => {
    const breadcrumb = page.locator("nav.breadcrumb");
    if (await breadcrumb.isVisible()) {
      // 点击面包屑中的"项目作战台"链接
      const projectsLink = breadcrumb.locator('a[href*="/projects"]');
      if (await projectsLink.count() > 0) {
        await projectsLink.first().click();
        await page.waitForURL("**/projects", { timeout: 10_000 });
      }
    }
  });
});

test.describe("04 项目资料 — 子分区导航", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 进入第一个项目
    const firstCard = page.locator("article.project-card h3 a").first();
    await firstCard.click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

    // 导航到"项目资料"模块（路由是 outcomes）
    const outcomesLink = page.locator('nav.project-nav a[href*="/modules/outcomes"]');
    if (await outcomesLink.count() > 0) {
      await outcomesLink.first().click();
      await page.waitForURL(/\/modules\/outcomes/, { timeout: 10_000 });
    }
  });

  test("子分区导航可见", async ({ page }) => {
    const sectionNav = page.locator("nav.module-section-nav");
    if (await sectionNav.isVisible()) {
      const links = sectionNav.locator("a");
      expect(await links.count()).toBeGreaterThanOrEqual(2);
    }
  });

  test("项目资料不混入项目更新入口", async ({ page }) => {
    const sectionNav = page.locator("nav.module-section-nav");
    await expect(sectionNav.locator("a")).toHaveText(["战果档案", "项目材料"]);
    await expect(sectionNav.locator('a[href*="view=proposals"], a[href*="/updates"]')).toHaveCount(0);
  });

  test("旧节点预览入口兼容跳转到项目更新材料起点", async ({ page }) => {
    const projectPath = new URL(page.url()).pathname.split("/modules/")[0];
    await page.goto(`${projectPath}/modules/materials?view=proposals`);
    await expect(page).toHaveURL(/\/updates$/);
    await expect(page.getByRole("heading", { name: "项目更新", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "先提交本次更新材料" })).toBeVisible();
  });

  test("项目更新页没有项目资料分区导航", async ({ page }) => {
    const projectPath = new URL(page.url()).pathname.split("/modules/")[0];
    await page.goto(`${projectPath}/updates`);
    await expect(page.locator("nav.module-section-nav")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "项目更新", exact: true })).toBeVisible();
  });

  test("切换回项目材料视图", async ({ page }) => {
    const ledgerTab = page.locator('.module-section-nav a[href*="view=ledger"]');
    if (await ledgerTab.count() > 0) {
      await ledgerTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });
});

test.describe("05 材料管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 进入第一个项目
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    // 直接导航到材料列表页（materials?view=ledger），避免子导航跳转的时序问题
    await page.goto(`${href}/modules/materials?view=ledger`);
    await page.waitForTimeout(2000);
  });

  test("项目资料页面渲染", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    // 资料页可能有子分区导航（ledger/proposals/release/operations）
    const sectionNav = page.locator("nav.module-section-nav");
    const hasSectionNav = await sectionNav.count();
    // 或者直接是材料内容（表格或空状态）
    const hasTable = await page.locator("table").count();
    const hasEmpty = await page.locator(".module-empty").count();
    const hasCard = await page.locator(".material-summary-card, article").count();
    expect(hasSectionNav + hasTable + hasEmpty + hasCard).toBeGreaterThan(0);
  });

  test("上传按钮可见", async ({ page }) => {
    // beforeEach 已导航到 materials?view=ledger
    await page.waitForTimeout(1000);
    const uploadBtn = page.locator('button:has-text("上传")');
    expect(await uploadBtn.count()).toBeGreaterThan(0);
  });

  test("打开上传面板", async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("上传")').first();
    await uploadBtn.click();
    await page.waitForTimeout(1000);
    // 精确匹配材料上传面板
    const sheet = page.locator("section.material-sheet");
    await expect(sheet).toBeVisible({ timeout: 5_000 });
  });

  test("关闭上传面板", async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("上传")').first();
    await uploadBtn.click();
    await page.waitForTimeout(1000);
    const sheet = page.locator("section.material-sheet");
    await expect(sheet).toBeVisible();

    // 点关闭按钮
    const closeBtn = page.locator('.material-sheet button.dialog-close, .material-sheet button:has-text("关闭")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe("06 路线图视图", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const href = await page.locator("article.project-card h3 a").first().getAttribute("href");
    await page.goto(`${href}/modules/roadmap`);
    await expect(page).toHaveURL(/\/modules\/roadmap$/);
    await expect(page.locator(".module-content")).toBeVisible();
  });

  test("路线图页面渲染", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    // 等待数据加载
    await page.waitForTimeout(2000);

    // 路线图渲染为卡片式时间线（region + button），不是 table
    const hasTimeline = await page.locator('region, [aria-label*="路线图"], [aria-label*="时间线"]').count();
    const hasBoard = await page.locator(".roadmap-board, .kanban-board, .board-column").count();
    const hasStageButton = await page.locator('button:has-text("点击展开")').count();
    const hasEmpty = await page.locator(".module-empty").count();
    const hasHeading = await page.locator('h2:has-text("路线图"), h2:has-text("路线")').count();
    // 至少渲染出了某种内容
    expect(hasTimeline + hasBoard + hasStageButton + hasEmpty + hasHeading).toBeGreaterThan(0);
  });

  test("正式路线图卡片编辑创建待审核节点预览且不直改发布图", async ({ page }) => {
    await expect(page.locator(".swimlane-stage-cell").first()).toBeVisible();
    const originalTitle = (await page.locator(".swimlane-stage-title").first().textContent()).trim();
    await page.locator(".swimlane-stage-cell .roadmap-card-edit-button").first().click();

    const dialog = page.getByRole("dialog", { name: /编辑.*(节点|里程碑|任务)/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("标题").fill(`${originalTitle}（编辑预览）`);
    await dialog.getByRole("button", { name: "提交编辑审核" }).click();

    await expect(page).toHaveURL(/\/updates\/preview\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "项目更新", level: 1 })).toBeVisible();
    await expect(page.getByText(`${originalTitle}（编辑预览）`, { exact: true }).first()).toBeVisible();
    await page.goto(page.url().replace(/\/updates.*$/, "/modules/roadmap"));
    await expect(page.locator(".swimlane-stage-title").filter({ hasText: originalTitle }).first()).toBeVisible();
    await expect(page.getByText(`${originalTitle}（编辑预览）`, { exact: true })).toHaveCount(0);
  });
});

test.describe("06b 材料工具栏新功能", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/modules/materials?view=ledger`);
    await page.waitForTimeout(2000);
  });

  test("编写指南按钮可见且可展开", async ({ page }) => {
    const guideBtn = page.locator('button:has-text("编写指南")');
    expect(await guideBtn.count()).toBeGreaterThan(0);

    const guidePanel = page.locator(".guide-inline-wrapper");
    expect(await guidePanel.count()).toBeGreaterThan(0);
    const initialDisplay = await guidePanel.first().evaluate(el => getComputedStyle(el).display);
    expect(initialDisplay).toBe("none");

    await guideBtn.first().click();
    await page.waitForTimeout(500);
    const openDisplay = await guidePanel.first().evaluate(el => getComputedStyle(el).display);
    expect(openDisplay).not.toBe("none");

    const quickGrid = page.locator(".guide-quick-grid");
    expect(await quickGrid.count()).toBeGreaterThan(0);

    const guideTabs = page.locator(".guide-tab");
    expect(await guideTabs.count()).toBeGreaterThanOrEqual(4);
  });

  test("编写指南展开后可收起", async ({ page }) => {
    const guideBtn = page.locator('button:has-text("编写指南")').first();
    const guidePanel = page.locator(".guide-inline-wrapper").first();

    await guideBtn.click();
    await page.waitForTimeout(500);
    expect(await guidePanel.evaluate(el => getComputedStyle(el).display)).not.toBe("none");

    await guideBtn.click();
    await page.waitForTimeout(500);
    expect(await guidePanel.evaluate(el => getComputedStyle(el).display)).toBe("none");
  });

  test("编写指南标签页可切换", async ({ page }) => {
    const guideBtn = page.locator('button:has-text("编写指南")').first();
    await guideBtn.click();
    await page.waitForTimeout(500);

    const tabs = page.locator(".guide-tab");
    expect(await tabs.nth(0).evaluate(el => el.classList.contains("active"))).toBe(true);

    if (await tabs.count() > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(300);
      expect(await tabs.nth(0).evaluate(el => el.classList.contains("active"))).toBe(false);
      expect(await tabs.nth(1).evaluate(el => el.classList.contains("active"))).toBe(true);

      const content = page.locator(".guide-tab-content");
      expect(await content.count()).toBeGreaterThan(0);
    }
  });

  test("下载推荐模板下拉和按钮可见", async ({ page }) => {
    const dlSelect = page.locator('select#template-download-select, select[aria-label="选择模板类型"]');
    expect(await dlSelect.count()).toBeGreaterThan(0);

    const options = dlSelect.first().locator("option");
    const optCount = await options.count();
    expect(optCount).toBeGreaterThanOrEqual(4);

    const dlBtn = page.locator('button:has-text("下载")');
    expect(await dlBtn.count()).toBeGreaterThan(0);
  });

  test("材料搜索功能", async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill("zzzznotexist");
      await page.waitForTimeout(500);
      const emptyState = page.locator(".module-empty, .material-empty");
      expect(await emptyState.count()).toBeGreaterThan(0);

      await searchInput.first().fill("");
      await page.waitForTimeout(500);
    }
  });

  test("材料状态筛选", async ({ page }) => {
    const statusSelect = page.locator('select[aria-label="筛选处理状态"]');
    if (await statusSelect.count() > 0) {
      await statusSelect.first().selectOption({ index: 1 });
      await page.waitForTimeout(500);
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("材料排序", async ({ page }) => {
    const sortSelect = page.locator('select[aria-label="材料排序"]');
    if (await sortSelect.count() > 0) {
      await sortSelect.first().selectOption("name");
      await page.waitForTimeout(500);
      await expect(page.locator(".module-content")).toBeVisible();
      await sortSelect.first().selectOption("newest");
      await page.waitForTimeout(300);
    }
  });
});

test.describe("06c 项目更新流程与模拟路线图", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/updates`);
    await page.waitForTimeout(2000);
  });

  test("通用项目更新入口先显示材料步骤", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    await expect(page.getByRole("heading", { name: "项目更新", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "先提交本次更新材料" })).toBeVisible();
    await expect(page.getByRole("button", { name: "上传本次更新材料" })).toBeVisible();
    await expect(page.locator(".project-update-flow-steps [aria-current=step]")).toContainText("本次材料");
    await expect(page.locator(".project-update-roadmap")).toHaveCount(0);
  });

  test("继续具体更新时只渲染一张复用主视图的路线图", async ({ page }) => {
    await page.getByRole("link", { name: "继续上一次更新" }).click();
    await expect(page).toHaveURL(/\/updates\/preview\/[^/]+$/);
    const roadmap = page.locator(".project-update-roadmap");
    await expect(roadmap).toHaveCount(1);
    await expect(page.locator(".material-summary-grid, .proposal-list, .proposal-row, .generation-task-list")).toHaveCount(0);
    await expect(page.locator(".project-update-roadmap .swimlane-card-board")).toHaveCount(await roadmap.count());
  });

  test("模拟路线图不重复材料生成控制台", async ({ page }) => {
    await page.getByRole("link", { name: "继续上一次更新" }).click();
    await expect(page.getByText("一键全部生成", { exact: true })).toHaveCount(0);
    await expect(page.getByText("材料模板", { exact: true })).toHaveCount(0);
    await expect(page.getByText("生成的节点预览", { exact: true })).toHaveCount(0);
  });
});

test.describe("06d 审核与发布页面", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/updates/release`);
    await page.waitForTimeout(2000);
  });

  test("审核发布页面渲染", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    await page.waitForTimeout(1000);
    const hasContent = await page.locator(".module-empty, .release-center, .proposal-workspace, section").count();
    expect(hasContent).toBeGreaterThan(0);
  });
});

test.describe("06e 运维自检页面", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/modules/materials?view=operations`);
    await page.waitForTimeout(2000);
  });

  test("运维自检页面渲染", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    await page.waitForTimeout(1000);
    const hasContent = await page.locator(".module-empty, section, .operations-check, table").count();
    expect(hasContent).toBeGreaterThan(0);
  });
});

test.describe("06f 项目健康页面", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/modules/risks`);
    await page.waitForTimeout(2000);
  });

  test("项目健康页面渲染不崩溃", async ({ page }) => {
    const hasContent = await page.locator(".module-content, .module-empty, section, table").count();
    expect(hasContent).toBeGreaterThan(0);
  });
});

test.describe("07 SPA 路由", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("浏览器前进后退按钮工作", async ({ page }) => {
    // 进入第一个项目
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });
    const projectUrl = page.url();

    // 进到资料模块
    const outcomesLink = page.locator('nav.project-nav a[href*="/modules/outcomes"]');
    if (await outcomesLink.count() > 0) {
      await outcomesLink.first().click();
      await page.waitForURL(/\/modules\/outcomes/, { timeout: 10_000 });
    }
    const materialsUrl = page.url();

    // 浏览器后退
    await page.goBack();
    await page.waitForTimeout(1000);
    // 应该回到项目页
    expect(page.url()).not.toBe(materialsUrl);

    // 浏览器前进
    await page.goForward();
    await page.waitForTimeout(1000);
  });

  test("直接访问项目 URL 能加载", async ({ page }) => {
    // 先获取一个项目 ID
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");

    // 直接访问该 URL
    await page.goto(href);
    await page.waitForTimeout(2000);
    await expect(page.locator(".module-content, .module-page-heading")).toBeVisible();
  });
});

test.describe("08 全局导航和退出", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("项目作战台链接可返回列表", async ({ page }) => {
    // 先进入一个项目
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

    // 点全局导航中的"项目作战台"链接
    const projectsLink = page.locator('nav.public-nav a[href="/projects"]');
    if (await projectsLink.count() === 0) {
      // 回退：用面包屑中的 Projects 链接
      const breadcrumbLink = page.locator('nav.breadcrumb a[href="/projects"]');
      if (await breadcrumbLink.count() > 0) {
        await breadcrumbLink.first().click();
        await page.waitForURL("**/projects", { timeout: 10_000 });
        return;
      }
    }
    if (await projectsLink.count() > 0) {
      await projectsLink.first().click();
      await page.waitForURL("**/projects", { timeout: 10_000 });
    }
  });

  test("退出登录返回登录页", async ({ page }) => {
    const logoutBtn = page.locator('button:has-text("退出"), button[aria-label*="退出"]');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForTimeout(2000);
      // 应该回到登录页或启动页
      await expect(page.locator(".login-screen, .boot-screen")).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("09 页面无控制台错误", () => {
  test("登录页无 JS 错误", async ({ page }) => {
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.goto("/login");
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test("项目列表页无 JS 错误", async ({ page }) => {
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await login(page);
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test("项目详情页无 JS 错误", async ({ page }) => {
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await login(page);
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });
    await page.waitForTimeout(3000);
    expect(errors).toEqual([]);
  });
});

test.describe("10 响应式布局", () => {
  test("桌面尺寸正常显示", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await expect(page.locator("article.project-card").first()).toBeVisible();
  });

  test("1280 首屏包含搜索、创建和项目入口", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page);
    await expect(page.locator("#project-search")).toBeVisible();
    await expect(page.getByRole("button", { name: "新建项目" })).toBeVisible();
    await expect(page.locator("article.project-card").first()).toBeVisible();
  });

  test("平板尺寸正常显示", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await expect(page.locator("article.project-card").first()).toBeVisible();
  });

  test("手机尺寸正常显示", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    const cardCount = await page.locator("article.project-card").count();
    expect(cardCount).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("手机路线图保留可滚动核心内容", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.locator("article.project-card h3 a").first().click();
    await page.getByRole("link", { name: "项目路线图" }).click();
    const visual = page.locator(".visual-scroll").first();
    await expect(visual).toBeVisible();
    expect(await visual.evaluate(node => node.scrollWidth > 0 && node.clientHeight > 0)).toBe(true);
  });
});
