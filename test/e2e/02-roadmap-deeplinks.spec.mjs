import { expect, test } from "@playwright/test";

const PROJECT = "/projects/xugu-agentic-group/modules/roadmap";

test.describe("路线图深链与就地详情", () => {
  test("默认渲染项目路线图主任务线并隐藏副任务", async ({ page }) => {
    await page.goto(PROJECT);
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
    await expect(page.locator(".swimlane-stage-card")).toHaveCount(6);
    await expect(page.locator(".swimlane-card-row")).toHaveCount(0);
    await expect(page.locator(".roadmap-unscheduled-cards .swimlane-task-card")).toHaveCount(1);
  });

  test("旧 view=timeline 深链回落到项目路线图", async ({ page }) => {
    await page.goto(`${PROJECT}?view=timeline`);
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
    await expect(page.locator(".roadmap-svg")).toHaveCount(0);
    await expect(page.locator(".roadmap-view-switcher a.active")).toContainText("项目路线图");
    await expect(page.locator(".roadmap-view-switcher a")).toHaveCount(2);
  });

  test("点击主任务写入 stage 深链并就地展开副任务", async ({ page }) => {
    await page.goto(PROJECT);
    await page.locator(".swimlane-stage-cell[data-stage-id='launch'] .swimlane-stage-card").click();
    await expect(page).toHaveURL(/stage=launch/);
    await expect(page.locator(".swimlane-stage-card.selected")).toContainText("第一次作战汇报完成后启动");
    await expect(page.locator(".swimlane-card-row").first()).toBeVisible();
  });

  test("深链 stage=launch 直接恢复路线展开态", async ({ page }) => {
    await page.goto(`${PROJECT}?stage=launch`);
    await expect(page.locator(".swimlane-stage-cell[data-stage-id='launch'] .swimlane-stage-card")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".swimlane-task-card").first()).toBeVisible();
  });

  test("切换主任务会清除旧的 unit/task 选择", async ({ page }) => {
    await page.goto(`${PROJECT}?stage=launch&unit=rd&task=rd-driver-productize`);
    await expect(page.locator(".swimlane-task-detail")).toBeVisible();
    await page.locator(".swimlane-stage-cell[data-stage-id='scale'] .swimlane-stage-card").click();
    await expect(page).toHaveURL(/stage=scale/);
    await expect(page).not.toHaveURL(/unit=rd/);
    await expect(page).not.toHaveURL(/task=/);
  });

  test("点击副任务写入 task 深链并在原卡片展开详情", async ({ page }) => {
    await page.goto(`${PROJECT}?stage=launch`);
    const task = page.locator(".swimlane-task-card-shell[data-task-id='rd-driver-productize']");
    await task.locator(".swimlane-task-card").click();
    await expect(page).toHaveURL(/task=/);
    await expect(task.locator(".swimlane-task-detail")).toBeVisible();
  });
});
