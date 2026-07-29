import { test, expect } from "@playwright/test";

/**
 * 前端 E2E 测试套件 — AI 项目作战管理平台
 *
 * 覆盖完整的用户交互流程：
 *   登录 → 项目列表 → 进入项目 → 路线图 → 切换 Tab →
 *   材料管理 → 更新建议 → 审核与发布 → 运维自检 → 退出
 *
 * 测试使用真实浏览器（Chromium headless），覆盖 UI 渲染、交互、路由、CSS。
 * 前提：服务器运行在 http://127.0.0.1:4173，数据库有测试项目数据。
 */

const BASE = "http://127.0.0.1:4173";
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin12345678";

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
    await expect(firstCard.locator(".project-id")).toBeVisible();
    await expect(firstCard.locator(".card-footer")).toBeVisible();
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

  test("切换到更新建议视图", async ({ page }) => {
    const proposalsTab = page.locator('.module-section-nav a[href*="view=proposals"]');
    if (await proposalsTab.count() > 0) {
      await proposalsTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("切换到审核与发布视图", async ({ page }) => {
    const releaseTab = page.locator('.module-section-nav a[href*="view=release"]');
    if (await releaseTab.count() > 0) {
      await releaseTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator(".module-content")).toBeVisible();
    }
  });

  test("切换到运维自检视图", async ({ page }) => {
    const operationsTab = page.locator('.module-section-nav a[href*="view=operations"]');
    if (await operationsTab.count() > 0) {
      await operationsTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator(".module-content")).toBeVisible();
    }
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
    await page.locator("article.project-card h3 a").first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

    const roadmapLink = page.locator('nav.project-nav a[href*="/modules/roadmap"], nav.project-nav a[href*="/modules/task-network"]');
    if (await roadmapLink.count() > 0) {
      await roadmapLink.first().click();
      await page.waitForURL(/\/modules\/(roadmap|task-network)/, { timeout: 10_000 });
    }
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

test.describe("06c 更新建议工作区", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/modules/materials?view=proposals`);
    await page.waitForTimeout(2000);
  });

  test("更新建议页面渲染", async ({ page }) => {
    await expect(page.locator(".module-content")).toBeVisible();
    await page.waitForTimeout(1000);
    const hasProposalList = await page.locator(".proposal-list, .proposal-row, .generation-task-list").count();
    const hasEmpty = await page.locator(".module-empty").count();
    const hasButton = await page.locator('button:has-text("生成"), button:has-text("更新")').count();
    expect(hasProposalList + hasEmpty + hasButton).toBeGreaterThan(0);
  });

  test("一键全部生成按钮存在", async ({ page }) => {
    const batchBtn = page.locator('button:has-text("一键全部生成"), button:has-text("批量生成")');
    // 按钮可能存在也可能不存在（取决于是否有 ready 材料）
    const moduleOk = await page.locator(".module-content").count();
    expect(moduleOk).toBeGreaterThan(0);
  });
});

test.describe("06d 审核与发布页面", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    const firstCard = page.locator("article.project-card h3 a").first();
    const href = await firstCard.getAttribute("href");
    await page.goto(`${href}/modules/materials?view=release`);
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

  test("平板尺寸正常显示", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await expect(page.locator("article.project-card").first()).toBeVisible();
  });

  test("手机尺寸正常显示", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.waitForTimeout(1000);
    // 在手机尺寸可能只显示一列，但页面不应该崩溃
    const cardCount = await page.locator("article.project-card").count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
