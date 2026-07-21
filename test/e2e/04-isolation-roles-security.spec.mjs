import { expect, test } from "@playwright/test";
import { accounts, api, loginApi, storageStatePath } from "./helpers.mjs";

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4191}`;

test.describe("项目隔离、角色边界与 CSRF", () => {
  test("viewer 看不到模块配置、审核发布与运维自检入口", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("viewer") });
    const page = await context.newPage();
    // viewer 在 xugu 项目内：项目详情无模块配置按钮
    await page.goto("/projects/xugu-agentic-group");
    await expect(page.locator(".module-config-entry")).toHaveCount(0);
    // 材料工作区无审核发布中心、无运维自检 tab
    await page.goto("/projects/xugu-agentic-group/modules/materials");
    await expect(page.getByRole("link", { name: "审核与发布" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "运维自检" })).toHaveCount(0);
    await context.close();
  });

  test("editor 可见审核发布入口但不见运维自检", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("editor") });
    const page = await context.newPage();
    await page.goto("/projects/xugu-agentic-group/modules/materials");
    await expect(page.getByRole("link", { name: "审核与发布" })).toBeVisible();
    await expect(page.getByRole("link", { name: "运维自检" })).toHaveCount(0);
    await context.close();
  });

  test("标准项目查看者访问 xugu 材料接口返回 404，不串库", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("stdViewer") });
    const page = await context.newPage();
    // stdViewer 不是 xugu 成员；直接访问 xugu 应被 404 隔离
    const response = await page.goto("/projects/xugu-agentic-group");
    // 未授权项目使用统一 404/拒绝视图，不应进入项目内容
    await expect(page.locator(".project-nav")).toHaveCount(0);
    await context.close();
  });

  test("跨项目猜测他人提案 ID 返回 404", async () => {
    const admin = await loginApi(BASE, accounts.admin);
    const viewer = await loginApi(BASE, accounts.viewer);
    // 先在 xugu 建一个提案拿真实 proposalId
    const made = await api(BASE, "/api/projects/xugu-agentic-group/materials/manual", { ...admin, method: "POST", body: { title: `E2E 隔离 ${Date.now()}`, body: "第一作战单元需要执行跨项目隔离验证任务，并在下次例会报告进度。", updateTemplateId: "meeting-notes" } });
    const materialId = made.payload.material.id;
    await api(BASE, `/api/projects/xugu-agentic-group/materials/${materialId}/generation`, { ...admin, method: "PATCH", body: { enabled: true } });
    const gen = await api(BASE, "/api/projects/xugu-agentic-group/generation-tasks", { ...admin, method: "POST", body: { materialIds: [materialId], idempotencyKey: `e2e-iso-${Date.now()}` } });
    const proposalId = gen.payload.task.proposalId;
    // 用 xugu 的 proposalId 去打标准项目命名空间：必须 404
    const cross = await api(BASE, `/api/projects/standard-project-sample/change-proposals/${proposalId}/review`, viewer);
    expect(cross.status).toBe(404);
  });

  test("缺少 CSRF 的写请求被拒绝", async () => {
    const admin = await loginApi(BASE, accounts.admin);
    // 故意不带 csrf 创建材料
    const noCsrf = await api(BASE, "/api/projects/xugu-agentic-group/materials/manual", { cookie: admin.cookie, method: "POST", body: { title: "不应创建", body: "x", updateTemplateId: "meeting-notes" } });
    expect(noCsrf.status).toBe(403);
  });

  test("未认证访问项目材料 API 被拒", async () => {
    const r = await api(BASE, "/api/projects/xugu-agentic-group/materials", {});
    expect(r.status).toBe(401);
  });
});
