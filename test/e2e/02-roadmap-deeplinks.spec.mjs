import { expect, test } from "@playwright/test";

 const PROJECT = "/projects/xugu-agentic-group/modules/roadmap";
 // 默认视图已改为项目泳道；以下用例针对「活动路线图」曲线视图，显式进入 ?view=timeline。
 const TIMELINE = `${PROJECT}?view=timeline`;

test.describe("路线图深链与就地详情", () => {
  test("默认渲染项目泳道（主脊/副泳道反应式）", async ({ page }) => {
    await page.goto(PROJECT);
    await expect(page.locator(".roadmap-swimlane")).toBeVisible();
    await expect(page.locator(".phase-station")).toHaveCount(6);
  });

  test("活动路线图渲染 6 个可点击战役节点", async ({ page }) => {
    await page.goto(TIMELINE);
    await expect(page.locator(".roadmap-svg")).toBeVisible();
    await expect(page.locator("[data-stage-id]")).toHaveCount(6);
  });

  test("点击阶段节点写入 stage 深链并就地展开详情", async ({ page }) => {
    await page.goto(TIMELINE);
    await page.locator("[data-stage-id='pilot']").click();
    await expect(page).toHaveURL(/stage=pilot/);
    await expect(page.locator(".stage-node-detail")).toBeVisible();
    await expect(page.locator(".stage-node-detail h2")).toBeVisible();
  });

  test("深链 stage=pilot 直接恢复选中态", async ({ page }) => {
    await page.goto(`${TIMELINE}&stage=pilot`);
    await expect(page.locator("[data-stage-id='pilot']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".stage-node-detail")).toBeVisible();
  });

  test("点击作战单元模块卡片写入 unit 深链并高亮该模块", async ({ page }) => {
    await page.goto(`${TIMELINE}&stage=launch`);
    const card = page.locator(".unit-module-card").first();
    await expect(card).toBeVisible();
    const unitId = await card.getAttribute("data-unit-id");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`unit=${unitId}`));
    await expect(page.locator(".unit-module-card.selected")).toHaveCount(1);
  });

  test("切换阶段节点会清除旧的 unit 选择", async ({ page }) => {
    await page.goto(`${TIMELINE}&stage=launch&unit=finance`);
    await expect(page).toHaveURL(/unit=finance/);
    await page.locator("[data-stage-id='scale']").click();
    await expect(page).toHaveURL(/stage=scale/);
    await expect(page).not.toHaveURL(/unit=finance/);
  });

  test("点击作战单元任务写入 task 深链并就地展开任务详情", async ({ page }) => {
    await page.goto(`${TIMELINE}&stage=launch`);
    // 模块化：任务在选中单元模块卡片后才展开
    await page.locator(".unit-module-card").first().click();
    await expect(page).toHaveURL(/unit=/);
    const taskChip = page.locator(".stage-task-chip").first();
    await expect(taskChip).toBeVisible();
    await taskChip.click();
    await expect(page).toHaveURL(/task=/);
    await expect(page.locator(".stage-task-item.selected")).toHaveCount(1);
  });
});
