import { expect, test } from "@playwright/test";

const projectId = "xugu-agentic-group";

async function openCreationMaterialDialog(page) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByRole("button", { name: /上传材料创建/ }).click();
  return page.getByRole("dialog", { name: "上传材料创建项目" });
}

async function openUploadDialog(page) {
  await page.goto(`/projects/${projectId}/modules/materials?view=ledger`);
  await expect(page).toHaveURL(/\/modules\/materials\?view=ledger$/);
  await page.getByRole("button", { name: "上传作战材料" }).first().click();
  const dialog = page.getByRole("dialog", { name: "上传作战材料" });
  await dialog.getByLabel("更新模板").selectOption("meeting-notes");
  return dialog;
}

async function materialCount(page) {
  const response = await page.request.get(`/api/projects/${projectId}/materials`);
  expect(response.ok()).toBe(true);
  return (await response.json()).items.length;
}

test.describe("异常项目创建材料", () => {
  test("未选择文件和空文件均原位阻止且不创建项目", async ({ page }) => {
    const before = await page.request.get("/api/projects");
    const beforeCount = (await before.json()).projects.length;
    const dialog = await openCreationMaterialDialog(page);

    await dialog.getByRole("button", { name: "分析并创建项目" }).click();
    await expect(dialog.getByRole("alert")).toContainText("请先选择一份项目文档");

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "空白项目.md",
      mimeType: "text/markdown",
      buffer: Buffer.alloc(0)
    });
    await dialog.getByRole("button", { name: "分析并创建项目" }).click();
    await expect(dialog.getByRole("alert")).toContainText("空文件不能用于创建项目");

    const after = await page.request.get("/api/projects");
    expect((await after.json()).projects).toHaveLength(beforeCount);
  });

  test("伪装 PDF 和不支持格式被识别，不进入项目骨架", async ({ page }) => {
    let dialog = await openCreationMaterialDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "伪装项目方案.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("项目名称：伪装文件\n项目目标：不应被接受")
    });
    await dialog.getByRole("button", { name: "分析并创建项目" }).click();
    await expect(dialog.getByRole("alert")).toContainText("文件内容与声明的类型不匹配");
    await dialog.getByRole("button", { name: "关闭" }).click();

    dialog = await openCreationMaterialDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "未知阶段材料.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not executable")
    });
    await dialog.getByRole("button", { name: "分析并创建项目" }).click();
    await expect(dialog.getByRole("alert")).toContainText("不支持此文件类型");
  });

  test("缺少项目名称和目标的文本材料给出补充指引", async ({ page }) => {
    const dialog = await openCreationMaterialDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "随手记录.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("本周大家继续保持沟通，具体事项和后续安排以后再讨论。")
    });
    await dialog.getByRole("button", { name: "分析并创建项目" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/材料缺少.*项目名称.*项目目标/);
    await expect(page.getByRole("dialog", { name: "确认项目骨架" })).toHaveCount(0);
  });

  test("完整项目创建模板可进入骨架确认", async ({ page }) => {
    const dialog = await openCreationMaterialDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "cloud-migration-project.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# 云平台迁移项目\n\n项目目标：在2026年9月底完成核心系统迁移并降低运维成本。\n\n团队：基础设施组，负责人刘芳。"
      )
    });
    await dialog.getByRole("button", { name: "分析并创建项目" }).click();

    const confirmation = page.getByRole("dialog", { name: "确认项目骨架" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByLabel("项目名称")).toHaveValue("云平台迁移项目");
    await expect(confirmation.getByLabel("项目摘要（可选）")).toHaveValue(/完成核心系统迁移/);
  });
});

test.describe("异常项目更新材料", () => {
  test("空文件、扩展名伪装和未知格式不增加材料台账", async ({ page }) => {
    const beforeCount = await materialCount(page);
    let dialog = await openUploadDialog(page);

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "空白会议纪要.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(0)
    });
    await dialog.getByRole("button", { name: "开始上传" }).click();
    await expect(dialog.getByRole("alert")).toContainText("空文件不被接受");
    await dialog.locator(".sheet-actions").getByRole("button", { name: "关闭上传面板" }).click();

    dialog = await openUploadDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "伪装进度报告.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("这不是 PDF")
    });
    await dialog.getByRole("button", { name: "开始上传" }).click();
    await expect(dialog.getByRole("alert")).toContainText("文件内容与扩展名不一致");
    await dialog.locator(".sheet-actions").getByRole("button", { name: "关闭上传面板" }).click();

    dialog = await openUploadDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "异常更新.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("unsupported")
    });
    await dialog.getByRole("button", { name: "开始上传" }).click();
    await expect(dialog.getByRole("alert")).toContainText("不支持此文件类型");
    expect(await materialCount(page)).toBe(beforeCount);
  });

  test("重复材料第二次上传被阻止且只保留一份", async ({ page }) => {
    const beforeCount = await materialCount(page);
    const dialog = await openUploadDialog(page);
    const file = {
      name: `重复会议纪要-${Date.now()}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("会议日期：2026-07-29\n行动项：刘芳负责整理方案，截止2026-08-05。")
    };

    await dialog.locator('input[type="file"]').setInputFiles(file);
    await dialog.getByRole("button", { name: "开始上传" }).click();
    await expect.poll(() => materialCount(page)).toBe(beforeCount + 1);
    await expect(page.locator("#toast")).toContainText("材料已归档");
    await expect(dialog.locator('input[type="file"]')).toHaveValue("");

    await dialog.locator('input[type="file"]').setInputFiles({
      ...file,
      buffer: Buffer.from("会议日期：2026-07-29\n行动项：刘芳负责整理方案，截止2026-08-05。")
    });
    await dialog.getByRole("button", { name: "开始上传" }).click();
    await expect(dialog.getByRole("alert")).toContainText("相同内容已归档");
    expect(await materialCount(page)).toBe(beforeCount + 1);
  });

  test("内容与项目计划模板不匹配时显示缺失项并阻止生成", async ({ page }) => {
    const title = `异常阶段材料-${Date.now()}`;
    await page.goto(`/projects/${projectId}/modules/materials?view=ledger`);
    await page.getByRole("button", { name: "手动录入" }).click();
    const dialog = page.getByRole("dialog", { name: "填写人工材料" });
    await dialog.getByLabel("标题").fill(title);
    await dialog.getByLabel("更新模板").selectOption("project-plan");
    await dialog.getByLabel("正文（纯文本）").fill("成果：客户验收报告已经签署。来源：验收会议记录。完成日期：2026-07-28。");
    await dialog.getByRole("button", { name: "归档人工材料" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toContainText("缺少必要信息");
    await expect(row).toContainText("需补充内容");
  });
});

test.describe("创建与更新入口的模板下载", () => {
  test("项目创建和项目更新材料起点均提供模板", async ({ page }) => {
    let dialog = await openCreationMaterialDialog(page);
    const creationDownload = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "下载项目创建模板" }).click();
    expect((await creationDownload).suggestedFilename()).toBe("new-project-material-模板.md");
    await dialog.getByRole("button", { name: "关闭" }).click();

    await page.goto(`/projects/${projectId}`);
    await page.getByText("材料模板", { exact: true }).click();
    let selector = page.getByLabel("选择模板类型");
    await expect(selector.locator("option")).toHaveCount(7);
    await selector.selectOption("project-plan");
    const overviewDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载模板" }).click();
    expect((await overviewDownload).suggestedFilename()).toBe("project-plan-模板.md");

    await page.getByRole("link", { name: "项目更新", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/updates$`));
    await expect(page.getByRole("button", { name: "上传本次更新材料" })).toBeVisible();
    await expect(page.getByLabel("选择模板类型")).toBeVisible();
    await expect(page.getByText("一键全部生成", { exact: true })).toHaveCount(0);
  });
});

test.describe("AI 节点预览路线图", () => {
  test("通过 UI 归档更新材料后可生成并定位未排期节点卡片", async ({ page }) => {
    const title = `节点预览定位材料-${Date.now()}`;
    await page.goto(`/projects/${projectId}/modules/materials?view=ledger`);
    await page.getByRole("button", { name: "手动录入" }).click();

    let dialog = page.getByRole("dialog", { name: "填写人工材料" });
    await dialog.getByLabel("标题").fill(title);
    await dialog.getByLabel("更新模板").selectOption("meeting-notes");
    await dialog.getByLabel("正文（纯文本）").fill(
      "会议日期：2026-07-29\n行动项：刘芳负责完成 E2E 跟进任务。\n负责人：刘芳\n截止日期：2026-08-05"
    );
    await dialog.getByRole("button", { name: "归档人工材料" }).click();

    await page.getByRole("link", { name: title, exact: true }).click();
    await page.getByLabel("材料处理进度").getByRole("button", { name: "生成节点预览", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "生成项目节点预览" });
    await expect(dialog.locator(".generation-selection-count")).toContainText("已选择 1/");
    await dialog.getByRole("button", { name: "生成节点预览", exact: true }).click();

    await expect(page.getByRole("link", { name: "查看模拟路线图", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "查看模拟路线图", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/updates/preview/[^/]+$`));
    await expect(page.locator(".module-section-nav")).toHaveCount(0);

    const projection = page.locator(".project-update-roadmap-root");
    await expect(projection).toBeVisible();
    await expect(projection).not.toContainText("null");
    await expect(projection.getByRole("heading", { name: "更新后的项目路线图" })).toBeVisible();
    await expect(projection.getByText("待排期卡片", { exact: true })).toBeVisible();
    await expect(projection.getByText("E2E 跟进任务", { exact: true })).toHaveCount(1);
    await expect(projection.getByText("AI 新增", { exact: true }).first()).toBeVisible();
    await expect(projection.locator(".update-preview-readonly").first()).toBeVisible();
    await expect(projection.locator(".update-preview-readonly .roadmap-card-edit-button")).toHaveCount(0);

    await projection.locator(".update-preview-added .roadmap-card-edit-button").click();
    dialog = page.getByRole("dialog", { name: /编辑.*任务/ });
    await dialog.getByLabel("标题").fill("E2E 跟进任务（预览已编辑）");
    await dialog.getByRole("button", { name: "保存预览修改" }).click();
    await expect(projection.getByText("E2E 跟进任务（预览已编辑）", { exact: true })).toHaveCount(1);

    await projection.locator(".update-preview-added .roadmap-card-edit-button").click();
    dialog = page.getByRole("dialog", { name: /编辑.*任务/ });
    const deleteButton = dialog.getByRole("button", { name: "删除本次预览卡片" });
    await expect(deleteButton).toBeDisabled();
    await dialog.getByLabel("删除确认").fill("确认");
    await expect(deleteButton).toBeDisabled();
    await dialog.getByLabel("删除确认").fill("确认删除");
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(projection.getByText("E2E 跟进任务（预览已编辑）", { exact: true })).toHaveCount(0);
  });
});
