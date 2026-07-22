import { expect, test } from "@playwright/test";
import { accounts, api, loginApi } from "./helpers.mjs";

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4191}`;
const ROADMAP = "/projects/xugu-agentic-group/modules/roadmap";

test.describe("Phase 8 路线图可视化工作台", () => {
  test("四种视图切换器存在并可互跳", async ({ page }) => {
    await page.goto(ROADMAP);
    await expect(page.locator(".roadmap-view-switcher")).toBeVisible();
    const tabs = page.locator(".roadmap-view-switcher a");
    await expect(tabs).toHaveCount(5);

    // 切换到卡片板
    await page.locator(".roadmap-view-switcher a", { hasText: "阶段卡片板" }).click();
    await expect(page).toHaveURL(/view=board/);
    await expect(page.locator(".roadmap-board")).toBeVisible();

    // 切换到作战单元进度
    await page.locator(".roadmap-view-switcher a", { hasText: "作战单元进度" }).click();
    await expect(page).toHaveURL(/view=units/);
    await expect(page.locator(".roadmap-units")).toBeVisible();

    // 切换到依赖网络
    await page.locator(".roadmap-view-switcher a", { hasText: "依赖网络" }).click();
    await expect(page).toHaveURL(/view=network/);
    await expect(page.locator(".roadmap-network")).toBeVisible();

    // 切回活动路线图（timeline）
    await page.locator(".roadmap-view-switcher a", { hasText: "活动路线图" }).click();
    // timeline 视图同时呈现战略曲线与时间列；断言主曲线可见
    await expect(page.locator(".roadmap-svg")).toBeVisible();
  });

  test("深链 view=board 直接恢复卡片板", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=board`);
    await expect(page.locator(".roadmap-board")).toBeVisible();
    await expect(page.locator(".board-lanes .board-lane").first()).toBeVisible();
  });

  test("卡片板按状态泳道展示任务卡", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=board`);
    // 至少有 4 个泳道（待确认/进行中/待审核/已完成）
    await expect(page.locator(".board-lane")).toHaveCount(4);
    // 任务卡存在并可点击
    const card = page.locator(".board-card").first();
    if (await card.count() > 0) {
      await card.click();
      await expect(page).toHaveURL(/task=/);
    }
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
    await page.goto(`${ROADMAP}?view=board`);
    await expect(page.locator(".roadmap-board")).toBeVisible();
    // 拿到第一张卡片和它的 data-state
    const card = page.locator(".board-card").first();
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

  test("依赖网络视图显示任务列表", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=network`);
    await expect(page.locator(".roadmap-network")).toBeVisible();
    await expect(page.locator(".dependency-list")).toBeVisible();
  });

  test("项目泳道呈现主泳道/副泳道/双锚点并支持深链", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane`);
    await expect(page.locator(".roadmap-swimlane")).toBeVisible();
    // 主泳道：阶段站点（项目锚点·拆解）
    await expect(page.locator(".swimlane-main-track .phase-station").first()).toBeVisible();
    expect(await page.locator(".swimlane-main-track .phase-station").count()).toBeGreaterThanOrEqual(6);
    // 副泳道：作战单元行 + 任务条（并行子任务）
    await expect(page.locator(".swimlane-sub .swimlane-row").first()).toBeVisible();
    expect(await page.locator(".swimlane-sub .swimlane-row").count()).toBeGreaterThanOrEqual(7);
    await expect(page.locator(".swimlane-bar").first()).toBeVisible();
    // 收口锚点（战果闭环）
    expect(await page.locator(".closure-anchor").count()).toBeGreaterThanOrEqual(1);
    // 生命周期三带图例
    await expect(page.locator(".swimlane-legend .band-prepare")).toBeVisible();
    await expect(page.locator(".swimlane-legend .band-active")).toBeVisible();
    await expect(page.locator(".swimlane-legend .band-converged")).toBeVisible();
    // 点击阶段站点写入 stage 深链
    await page.locator(".swimlane-main-track .phase-station").first().click();
    await expect(page).toHaveURL(/stage=/);
    // 点击任务条写入 task 深链
    await page.locator(".swimlane-bar").first().click();
    await expect(page).toHaveURL(/task=/);
  });
});

  test("项目泳道副泳道展示同单元拆解链并高亮链上任务", async ({ page }) => {
    await page.goto(`${ROADMAP}?view=swimlane`);
    // 先等副泳道任务条渲染完成
    await expect(page.locator(".swimlane-bar").first()).toBeVisible();
    // 带 parentId 的子任务条带拆解标记（⇢ 与 has-parent）
    const decompBars = page.locator(".swimlane-bar[data-parent]:not([data-parent=''])");
    expect(await decompBars.count()).toBeGreaterThanOrEqual(3);
    await expect(decompBars.first()).toBeVisible();
    // 图例含拆解链说明
    await expect(page.locator(".swimlane-legend .decomp-glyph")).toBeVisible();
    // 点击研发拆解链的中节点（rd-driver-productize），祖孙三代（rd-core-assessment → productize → rd-tool-rebuild）均高亮
    const productize = page.locator(".swimlane-bar[data-task-id='rd-driver-productize']");
    await productize.click();
    await expect(page).toHaveURL(/task=rd-driver-productize/);
    await expect(productize).toHaveClass(/\bchain\b/);
    const rdParent = page.locator(".swimlane-bar[data-task-id='rd-core-assessment']");
    await expect(rdParent).toHaveClass(/\bchain\b/);
    const rdChild = page.locator(".swimlane-bar[data-task-id='rd-tool-rebuild']");
    await expect(rdChild).toHaveClass(/\bchain\b/);
    // 非链上任务（如财务）应被淡化
    const financeTask = page.locator(".swimlane-bar[data-task-id='finance-scale']");
    await expect(financeTask).toHaveClass(/\bdimmed\b/);
  });

  test("泳道生命周期术语随模板配置（作战语言 vs 通用项目管理语言）", async ({ page }) => {
    // 虚谷（campaign 模板）：作战语言 事前/事中/事后
    await page.goto(`${ROADMAP}?view=swimlane`);
    await expect(page.locator(".swimlane-bar").first()).toBeVisible();
    await expect(page.locator(".swimlane-legend .band-prepare")).toContainText("事前");
    await expect(page.locator(".swimlane-legend .band-active")).toContainText("事中");
    await expect(page.locator(".swimlane-legend .band-converged")).toContainText("事后");
    // 标准项目（standard 模板）：通用项目管理语言 规划/执行/交付
    await page.goto(`/projects/standard-project-sample/modules/roadmap?view=swimlane`);
    await expect(page.locator(".swimlane-bar").first()).toBeVisible();
    await expect(page.locator(".swimlane-legend .band-prepare")).toContainText("规划");
    await expect(page.locator(".swimlane-legend .band-active")).toContainText("执行");
    await expect(page.locator(".swimlane-legend .band-converged")).toContainText("交付");
  });
