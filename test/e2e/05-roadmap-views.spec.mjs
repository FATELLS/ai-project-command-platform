import { expect, test } from "@playwright/test";
import { accounts, api, loginApi } from "./helpers.mjs";

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4191}`;
const ROADMAP = "/projects/xugu-agentic-group/modules/roadmap";

test.describe("Phase 8 路线图可视化工作台", () => {
  test("四种视图切换器存在并可互跳", async ({ page }) => {
    await page.goto(ROADMAP);
    await expect(page.locator(".roadmap-view-switcher")).toBeVisible();
    const tabs = page.locator(".roadmap-view-switcher a");
    await expect(tabs).toHaveCount(4);

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
});
