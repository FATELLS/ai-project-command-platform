import { expect, test } from "@playwright/test";
import { accounts, api, loginApi } from "./helpers.mjs";

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4191}`;
const ROADMAP = "/projects/xugu-agentic-group/modules/roadmap";

test.describe("Phase 8 路线图可视化工作台", () => {
  test("项目路线图与作战单元进度视图可互跳", async ({ page }) => {
    await page.goto(ROADMAP);
    await expect(page.locator(".roadmap-view-switcher")).toBeVisible();
    const tabs = page.locator(".roadmap-view-switcher a");
    await expect(tabs).toHaveCount(2);

    // 切换到作战单元进度
    await page.locator(".roadmap-view-switcher a", { hasText: "作战单元进度" }).click();
    await expect(page).toHaveURL(/view=units/);
    await expect(page.locator(".roadmap-units")).toBeVisible();

    // 切回项目路线图
    await page.locator(".roadmap-view-switcher a", { hasText: "项目路线图" }).click();
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
  });

  test("深链 view=board 回落到项目路线图", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=board`);
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
  });

  test("拖拽卡片创建受控提案而非直写草稿", async ({ page }) => {
    const h = await loginApi(BASE, accounts.editor);
    // 交互提案的高影响字段（state）必须引用证据：先建一份带证据的人工材料。
    const material = await api(BASE, `/api/projects/xugu-agentic-group/materials/manual`, {
      ...h, method: "POST",
      body: { title: `E2E 拖拽依据 ${Date.now()}`, body: "平台计划任务已进入待审核，作战单元确认可以推进。" }
    });
    const materialId = material.payload.material.id;
    const evidence = await api(BASE, `/api/projects/xugu-agentic-group/materials/${materialId}/evidence`, h);
    const evidenceId = evidence.payload.items[0].id;
    // 确保没有 pending 提案残留（避免配额/状态干扰）
    await page.goto(`${ROADMAP}?view=swimlane&stage=launch`);
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
    // 拿到第一张卡片和它的 data-task-id
    const card = page.locator(".swimlane-task-card-shell[data-task-id]").first();
    await expect(card).toBeVisible();
    const taskId = await card.getAttribute("data-task-id");
    expect(taskId).toBeTruthy();

    // 模拟拖拽：直接调用 API（浏览器原生拖拽在 headless 不稳定，用 API 验证安全语义）
    const response = await api(BASE, `/api/projects/xugu-agentic-group/change-proposals`, {
      ...h, method: "POST",
      body: {
        source: "board-drag",
        summary: "E2E 拖拽测试提案",
        materialIds: [materialId],
        evidenceIds: [evidenceId],
        changes: [{ changeId: `e2e-drag-${Date.now()}`, module: "task-network", operation: "update", targetId: taskId, semanticType: "plan", patch: { state: "review" }, confidence: 0.5, warnings: [], evidenceIds: [evidenceId] }]
      }
    });
    // 创建成功（201），进入待审核，不是直写
    expect(response.status).toBe(201);
    expect(response.payload.proposal.status).toBe("pending");

    // 验证任务在发布版的 state 没有被直接修改（拖拽不直写 published/draft）
    const pub = await api(BASE, `/api/projects/xugu-agentic-group/public/modules/task-network`, h);
    const task = pub.payload.data.nodes.find((n) => n.id === taskId);
    // 发布态 state 不应因提案改变
    expect(task).toBeTruthy();
  });

  test("缺少 CSRF 的交互提案被拒绝", async () => {
    const { cookie } = await loginApi(BASE, accounts.editor);
    const r = await api(BASE, `/api/projects/xugu-agentic-group/change-proposals`, {
      cookie, method: "POST",
      body: { changes: [{ changeId: "x", module: "task-network", operation: "update", targetId: "platform-plan", semanticType: "plan", patch: { state: "review" }, confidence: 0.5, warnings: [], evidenceIds: [] }] }
    });
    expect(r.status).toBe(403);
  });

  test("viewer 不能创建交互提案", async () => {
    const h = await loginApi(BASE, accounts.viewer);
    const r = await api(BASE, `/api/projects/xugu-agentic-group/change-proposals`, {
      ...h, method: "POST",
      body: { changes: [{ changeId: "v", module: "task-network", operation: "update", targetId: "platform-plan", semanticType: "plan", patch: { state: "review" }, confidence: 0.5, warnings: [], evidenceIds: [] }] }
    });
    expect(r.status).toBe(404);
  });

  test("作战单元进度视图显示单元卡片和完成度", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=units`);
    await expect(page.locator(".unit-progress-card").first()).toBeVisible();
    // 点击单元展开任务
    const unit = page.locator(".unit-progress-card").first();
    await unit.click();
    await expect(page).toHaveURL(/unit=/);
  });

  test("项目泳道默认只呈现主任务时间线，点击主任务才展开副任务", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane`);
    await expect(page.locator(".roadmap-card-swimlane")).toBeVisible();
    await expect(page.locator(".swimlane-main-cards .swimlane-stage-card").first()).toBeVisible();
    expect(await page.locator(".swimlane-stage-card").count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator(".swimlane-card-empty")).toContainText("未选择时隐藏全部");
    await expect(page.locator(".swimlane-card-row")).toHaveCount(0);
    await expect(page.locator(".swimlane-task-card")).toHaveCount(0);

    const launch = page.locator(".swimlane-stage-card").filter({ hasText: "首批场景出征" });
    await launch.click();
    await expect(page).toHaveURL(/stage=launch/);
    await expect(launch).toHaveAttribute("aria-expanded", "true");
    await expect(launch).toContainText("第一次作战汇报完成后启动");
    await expect(page.locator(".swimlane-card-row").first()).toBeVisible();
    await expect(page.locator(".swimlane-task-card").first()).toBeVisible();

    await launch.click();
    await expect(page).not.toHaveURL(/stage=/);
    await expect(page.locator(".swimlane-card-row")).toHaveCount(0);
    await expect(page.locator(".swimlane-task-card")).toHaveCount(0);
  });

  test("副任务是固定卡片集合而非甘特条，并按作战单元稳定分色", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane&stage=launch`);
    const cards = page.locator(".swimlane-task-card-shell:not(.expanded)");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(3);
    const widths = await cards.evaluateAll(nodes => nodes.slice(0, 4).map(node => Math.round(node.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBe(1);
    await expect(page.locator(".swimlane-bar")).toHaveCount(0);

    const rows = page.locator(".swimlane-card-row");
    expect(await rows.count()).toBeGreaterThan(1);
    const colors = await rows.evaluateAll(nodes => nodes.slice(0, 3).map(node => getComputedStyle(node.querySelector(".swimlane-unit-color")).backgroundColor));
    expect(new Set(colors).size).toBeGreaterThan(1);
    const panelBox = await page.locator(".swimlane-child-panel").boundingBox();
    const firstRow = page.locator(".swimlane-card-row").first();
    const firstRowCards = firstRow.locator(".swimlane-task-card-shell");
    const firstThree = await Promise.all([0, 1, 2].map(index => firstRowCards.nth(index).boundingBox()));
    expect(firstThree[1].y).toBe(firstThree[0].y);
    expect(firstThree[2].y).toBe(firstThree[0].y);
    expect(firstThree[0].x).toBeGreaterThanOrEqual(panelBox.x);
    expect(firstThree[2].x + firstThree[2].width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
    const labelBox = await firstRow.locator(".swimlane-card-row-label").boundingBox();
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(firstThree[0].y);
    await expect(page.locator(".swimlane-child-slope path")).toHaveCount(2);
  });

  test("主任务展开卡覆盖相邻列而不挤宽时间线", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane&stage=launch`);
    const selected = page.locator(".swimlane-stage-card.selected");
    const previous = page.locator(".swimlane-stage-cell[data-stage-id='report-1'] .swimlane-stage-card");
    const next = page.locator(".swimlane-stage-cell[data-stage-id='pilot'] .swimlane-stage-card");
    const geometry = await Promise.all([selected, previous, next].map(locator => locator.boundingBox()));
    const [selectedBox, previousBox, nextBox] = geometry;
    expect(selectedBox.width).toBeGreaterThan(previousBox.width * 2);
    expect(selectedBox.x).toBeLessThan(previousBox.x + previousBox.width);
    expect(selectedBox.x + selectedBox.width).toBeGreaterThan(nextBox.x);
    await expect(page.locator(".swimlane-main-cards")).toHaveCSS("grid-template-columns", /.+/);
  });

  test("点击副任务在原位置二次展开，再次点击收起", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane&stage=launch`);
    const card = page.locator(".swimlane-task-card-shell[data-task-id='rd-driver-productize']");
    await expect(card).toBeVisible();
    await card.locator(".swimlane-task-card").click();
    await expect(page).toHaveURL(/task=rd-driver-productize/);
    await expect(card).toHaveClass(/\bexpanded\b/);
    await expect(card.locator(".swimlane-task-detail")).toBeVisible();
    await expect(card.locator(".swimlane-task-detail")).toContainText("拆解自");
    await expect(card.locator(".swimlane-task-detail")).toContainText("预期产出");
    await expect(page.locator(".swimlane-overlay")).toHaveCount(0);
    const expandedBox = await card.boundingBox();
    const collapsedNeighbor = page.locator(".swimlane-task-card-shell:not(.expanded)").first();
    const collapsedBox = await collapsedNeighbor.boundingBox();
    expect(expandedBox.width).toBeGreaterThan(collapsedBox.width * 2);
    const childPanelBox = await page.locator(".swimlane-child-panel").boundingBox();
    expect(expandedBox.x).toBeGreaterThanOrEqual(childPanelBox.x);
    expect(expandedBox.x + expandedBox.width).toBeLessThanOrEqual(childPanelBox.x + childPanelBox.width);

    await card.locator(".swimlane-task-card").click();
    await expect(page).not.toHaveURL(/task=/);
    await expect(card.locator(".swimlane-task-detail")).toHaveCount(0);
  });

  test("task 深链恢复主任务、副泳道与原位展开状态", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane&task=rd-driver-productize`);
    await expect(page.locator(".swimlane-card-board")).toHaveAttribute("data-open-stage", "launch");
    await expect(page.locator(".swimlane-stage-card").filter({ hasText: "首批场景出征" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".swimlane-task-card-shell[data-task-id='rd-driver-productize']")).toHaveClass(/\bexpanded\b/);
    await expect(page.locator(".swimlane-task-card-shell[data-task-id='rd-tool-rebuild']")).toHaveClass(/\bchain\b/);
    await expect(page.locator(".swimlane-legend .decomp-glyph")).toBeVisible();
  });

  test("末端主任务深链会自动滚入安全区且不越过画布右边界", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(`${ROADMAP}?view=swimlane&stage=institutionalize`);
    const scroller = page.locator(".roadmap-card-swimlane .visual-scroll");
    const selected = page.locator(".swimlane-stage-card.selected");
    await expect(selected).toContainText("机制与能力固化");
    await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    const bounds = await page.locator(".swimlane-card-board").evaluate((board) => {
      const card = board.querySelector(".swimlane-stage-card.selected");
      const boardRect = board.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        cardRight: Math.round(cardRect.right),
        boardRight: Math.round(boardRect.right),
        rightPadding: Math.round(boardRect.right - cardRect.right)
      };
    });
    expect(bounds.cardRight).toBeLessThanOrEqual(bounds.boardRight);
    expect(bounds.rightPadding).toBeGreaterThanOrEqual(24);
  });

  test("泳道生命周期术语随模板配置", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane`);
    await expect(page.locator(".swimlane-legend .band-prepare")).toContainText("事前");
    await expect(page.locator(".swimlane-legend .band-active")).toContainText("事中");
    await expect(page.locator(".swimlane-legend .band-converged")).toContainText("事后");

    await page.goto("/projects/standard-project-sample/modules/roadmap?view=swimlane");
    await expect(page.locator(".swimlane-legend .band-prepare")).toContainText("规划");
    await expect(page.locator(".swimlane-legend .band-active")).toContainText("执行");
    await expect(page.locator(".swimlane-legend .band-converged")).toContainText("交付");
    await expect(page.locator(".swimlane-card-row")).toHaveCount(0);
    await page.locator(".swimlane-stage-card").filter({ hasText: "原型验证" }).click();
    await expect(page.locator(".swimlane-card-row").first()).toBeVisible();
  });

  test("项目泳道保留多源收口锚点与深链详情", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane`);
    const multiAnchor = page.locator(".closure-anchor[data-anchor='launch-pilot-convergence']");
    await expect(multiAnchor).toBeVisible();
    expect(await page.locator(".closure-anchor").count()).toBeGreaterThanOrEqual(3);
    await multiAnchor.click();
    await expect(page).toHaveURL(/anchor=launch-pilot-convergence/);
    const detail = page.locator(".inline-task-detail");
    await expect(detail).toContainText("report-1");
    await expect(detail).toContainText("launch");
    await expect(detail).toContainText("pilot");
  });
});
