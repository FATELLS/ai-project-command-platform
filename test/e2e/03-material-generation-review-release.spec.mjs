import { expect, test } from "@playwright/test";
import { accounts, api, loginApi } from "./helpers.mjs";

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4191}`;
const P = "xugu-agentic-group";

// 真实 server + DB + fake provider 跑通完整闭环；关键节点用 UI 验证呈现。
test.describe("材料→生成→审核→发布闭环", () => {
  test("上传人工材料后可生成、审核、合并、发布并回滚", async ({ page }) => {
    const { cookie, csrf } = await loginApi(BASE, accounts.admin);
    const h = { cookie, csrf };
    const stamp = `${Date.now()}`;
    const title = `E2E 闭环材料 ${stamp}`;

    // 1) API 创建人工材料（带会议纪要模板）
    const created = await api(BASE, `/api/projects/${P}/materials/manual`, { ...h, method: "POST", body: { title, body: "第一作战单元需要执行 E2E 跟进任务，并在下次例会报告进度。", updateTemplateId: "meeting-notes" } });
    expect([200, 201]).toContain(created.status);
    const materialId = created.payload.material.id;

    // 2) 授权生成
    const enabled = await api(BASE, `/api/projects/${P}/materials/${materialId}/generation`, { ...h, method: "PATCH", body: { enabled: true } });
    expect([200, 204]).toContain(enabled.status);

    // 3) UI 验证材料出现在台账、状态为就绪
    await page.goto(`/projects/${P}/modules/materials`);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator(".material-status.status-ready").first()).toBeVisible();

    // 4) 生成结构化提案
    const gen = await api(BASE, `/api/projects/${P}/generation-tasks`, { ...h, method: "POST", body: { materialIds: [materialId], idempotencyKey: `e2e-loop-${stamp}` } });
    expect([200, 202]).toContain(gen.status);
    expect(gen.payload.task.state).toBe("succeeded");
    const proposalId = gen.payload.task.proposalId;

    // 5) UI 验证独立项目更新流程只显示一张统一路线图
    await page.goto(`/projects/${P}/updates/preview/${proposalId}`);
    await expect(page.locator(".project-update-roadmap")).toBeVisible();
    await expect(page.locator(".proposal-list, .generation-task-list")).toHaveCount(0);

    // 6) 审核单项接受（管理员 + CSRF）
    const reviewDetail = await api(BASE, `/api/projects/${P}/change-proposals/${proposalId}/review`, h);
    expect(reviewDetail.status).toBe(200);
    const changeId = reviewDetail.payload.proposal.changes[0].changeId;
    const accepted = await api(BASE, `/api/projects/${P}/change-proposals/${proposalId}/review/${changeId}`, { ...h, method: "PATCH", body: { decision: "accepted", patch: { title: "E2E 已审核跟进任务", unitId: "rd" } } });
    expect(accepted.status).toBe(200);

    // 7) 合并到草稿（copy-on-write）
    const merged = await api(BASE, `/api/projects/${P}/change-proposals/${proposalId}/merge`, { ...h, method: "POST", body: {} });
    expect(merged.status).toBe(200);

    // 8) 发布预览 + 发布
    const preview = await api(BASE, `/api/projects/${P}/release/preview`, h);
    expect(preview.status).toBe(200);
    expect(preview.payload.changes.count).toBeGreaterThan(0);
    const versionLabel = `e2e-${stamp.slice(-6)}`;
    const published = await api(BASE, `/api/projects/${P}/release/publish`, { ...h, method: "POST", body: { previewToken: preview.payload.previewToken, versionLabel, acknowledged: true } });
    expect(published.status).toBe(200);

    // 9) UI 验证发布中心显示新发布版本标签
    await page.goto(`/projects/${P}/updates/release`);
    await expect(page.getByText(versionLabel).first()).toBeVisible({ timeout: 15000 });

    // 10) 回滚到直接前驱
    const rolled = await api(BASE, `/api/projects/${P}/release/rollback`, { ...h, method: "POST", body: { confirmed: true } });
    expect(rolled.status).toBe(200);

    // 11) 审计包含发布与回滚事件
    const audit = await api(BASE, `/api/projects/${P}/release/audit`, h);
    expect(audit.status).toBe(200);
    const actions = audit.payload.items.map((item) => item.action);
    expect(actions).toContain("project.published");
    expect(actions).toContain("project.rolled_back");
  });
});
