import assert from "node:assert/strict";
import test from "node:test";
import { getProposalTemplate } from "../src/proposals/catalog.mjs";
import { buildGenerationPrompt, GENERATION_SYSTEM_PROMPT_V1 } from "../src/proposals/prompt-builder.mjs";
import { boundedPublished } from "../src/proposals/context-builder.mjs";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";
import { applyReviewedChanges } from "../src/review/version-apply.mjs";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));
const at = "2026-07-18T00:00:00.000Z";

/* ── 1. boundedPublished 输出 PMBOK 元素 ──────────────────────── */

test("boundedPublished includes PMBOK elements in published_state tasks", () => {
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database);
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: at });
    const projects = createProjectRepository(database);
    const graph = projects.getModuleVersionGraph("xugu-agentic-group", "published");
    const published = boundedPublished(graph);
    // tasks 数组必须存在
    assert.ok(Array.isArray(published.tasks));
    assert.ok(published.tasks.length > 0);
    // graph task 对象本身有 objective/health 属性（来自统一表列）
    const firstTask = graph.tasks[0];
    assert.ok("objective" in firstTask, "graph task should have objective column");
    assert.ok("health" in firstTask, "graph task should have health column");
    // boundedPublished 只在值非空时输出 PMBOK 字段——确认 expectedOutput（有值）被透传
    assert.ok("expectedOutput" in published.tasks[0], "expectedOutput should be in published state");
  } finally {
    database.close();
  }
});

test("boundedPublished includes PMBOK array fields when present", () => {
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database);
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: at });
    const projects = createProjectRepository(database);
    const versionId = projects.getProject("xugu-agentic-group").draftVersionId;

    // 创建一个带 PMBOK 数组字段的 task
    applyReviewedChanges(database, versionId, [{
      module: "task-network",
      operation: "create",
      targetId: "pmbok-test-task",
      patch: {
        title: "PMBOK 测试任务",
        unitId: "rd",
        objective: "验证 PMBOK 元素增量合并",
        health: "on-track",
        stakeholders: ["张三(产品)", "李四(开发)"],
        deliverables: [{ name: "设计文档", state: "doing" }],
        risks: [{ title: "技术方案不确定", severity: "medium", status: "open" }],
        acceptanceCriteria: "通过设计评审",
        decisions: [{ date: "2026-07-14", summary: "采用方案A", decidedBy: "张三" }]
      }
    }]);

    // 从 draft graph 构建 published_state（boundedPublished 不区分 layer，只看 graph 对象）
    const graph = projects.getModuleVersionGraph("xugu-agentic-group", "draft");
    const published = boundedPublished(graph);
    const task = published.tasks.find(t => t.id === "pmbok-test-task");

    assert.ok(task, "pmbok-test-task should be in published state");
    assert.equal(task.objective, "验证 PMBOK 元素增量合并");
    assert.equal(task.health, "on-track");
    assert.ok(Array.isArray(task.stakeholders));
    assert.equal(task.stakeholders.length, 2);
    assert.ok(Array.isArray(task.deliverables));
    assert.equal(task.deliverables.length, 1);
    assert.ok(Array.isArray(task.risks));
    assert.equal(task.risks.length, 1);
    assert.equal(task.acceptanceCriteria, "通过设计评审");
    assert.ok(Array.isArray(task.decisions));
    assert.equal(task.decisions.length, 1);
  } finally {
    database.close();
  }
});

/* ── 2. system prompt 包含 PMBOK 框架指令 ──────────────────── */

test("system prompt includes PMBOK seven-element framework", () => {
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /PMBOK 七元素提取框架/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /目标与范围/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /时间与进度/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /人员与相关方/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /交付物/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /风险/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /评价与质量/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /决策/);
});

test("system prompt includes element-association guidance", () => {
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /元素间关联引导/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /提到.*延期.*同时更新/);
});

test("system prompt instructs LLM to output merged arrays for updates", () => {
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /增量合并规则/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /合并后的完整数组/);
  assert.match(GENERATION_SYSTEM_PROMPT_V1, /去重/);
});

/* ── 3. writeCard 数组字段深度合并 ──────────────────────────── */

test("writeCard update merges PMBOK arrays with dedup instead of overwrite", () => {
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database);
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: at });
    const projects = createProjectRepository(database);
    const versionId = projects.getProject("xugu-agentic-group").draftVersionId;

    // 第一步：创建带 PMBOK 数组的 task
    applyReviewedChanges(database, versionId, [{
      module: "task-network",
      operation: "create",
      targetId: "merge-test-task",
      patch: {
        title: "合并测试任务",
        unitId: "rd",
        stakeholders: ["张三(产品)", "李四(开发)"],
        deliverables: [{ name: "需求文档", state: "done" }],
        risks: [{ title: "接口不稳定", severity: "high", status: "open" }],
        decisions: [{ summary: "选REST架构", decidedBy: "张三" }]
      }
    }]);

    // 第二步：update 追加新条目 + 更新已有条目
    applyReviewedChanges(database, versionId, [{
      module: "task-network",
      operation: "update",
      targetId: "merge-test-task",
      patch: {
        stakeholders: ["李四(开发)", "王五(测试)"],  // 李四重复，王五新增
        deliverables: [{ name: "需求文档", state: "done" }, { name: "原型设计", state: "doing" }],  // 需求文档已有，原型设计新增
        risks: [{ title: "接口不稳定", severity: "low", status: "mitigated" }],  // 更新 severity 和 status
        decisions: [{ summary: "选REST架构", decidedBy: "张三" }, { summary: "用PostgreSQL", decidedBy: "李四" }]  // 追加
      }
    }]);

    // 验证合并结果
    const graph = projects.getModuleVersionGraph("xugu-agentic-group", "draft");
    const task = graph.tasks.find(t => t.id === "merge-test-task");

    assert.ok(task, "merge-test-task should exist");
    // stakeholders: 张三 + 李四 + 王五 = 3（去重后）
    assert.equal(task.stakeholders.length, 3, "stakeholders should have 3 unique entries after merge");
    // deliverables: 需求文档 + 原型设计 = 2
    assert.equal(task.deliverables.length, 2, "deliverables should have 2 entries after merge");
    // risks: 只有 1 条（更新了 severity/status，不新增）
    assert.equal(task.risks.length, 1, "risks should have 1 entry with updated fields");
    assert.equal(task.risks[0].severity, "low", "risk severity should be updated to low");
    assert.equal(task.risks[0].status, "mitigated", "risk status should be updated to mitigated");
    // decisions: 选REST + 用PostgreSQL = 2
    assert.equal(task.decisions.length, 2, "decisions should have 2 entries after merge");
  } finally {
    database.close();
  }
});

test("writeCard update preserves existing array when new patch omits it", () => {
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database);
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: at });
    const projects = createProjectRepository(database);
    const versionId = projects.getProject("xugu-agentic-group").draftVersionId;

    // 创建带数组的 task
    applyReviewedChanges(database, versionId, [{
      module: "task-network",
      operation: "create",
      targetId: "preserve-test-task",
      patch: {
        title: "保留测试任务",
        unitId: "rd",
        stakeholders: ["张三", "李四"],
        deliverables: [{ name: "文档A", state: "doing" }]
      }
    }]);

    // update 只改标题，不带数组字段
    applyReviewedChanges(database, versionId, [{
      module: "task-network",
      operation: "update",
      targetId: "preserve-test-task",
      patch: { title: "保留测试任务（已改名）" }
    }]);

    const graph = projects.getModuleVersionGraph("xugu-agentic-group", "draft");
    const task = graph.tasks.find(t => t.id === "preserve-test-task");

    assert.equal(task.title, "保留测试任务（已改名）");
    assert.equal(task.stakeholders.length, 2, "stakeholders should be preserved when patch omits it");
    assert.equal(task.deliverables.length, 1, "deliverables should be preserved when patch omits it");
  } finally {
    database.close();
  }
});

/* ── 4. buildGenerationPrompt 正确组装 PMBOK 上下文 ──────────── */

test("buildGenerationPrompt passes card_element_levels and storage_map", () => {
  const context = {
    projectId: "p1",
    baseVersionId: 1,
    baseVersionLabel: "v1",
    templateId: "meeting-notes",
    templateVersion: "1.0.0",
    materials: [{ id: "material-00000001", readiness: { status: "ready" } }],
    evidence: [{ evidenceId: "evidence-00000001", materialId: "material-00000001", materialName: "notes.txt", kind: "text", location: {}, text: "讨论了测试。" }],
    published: { projectId: "p1", units: [], stages: [], tasks: [], risks: [], metrics: [], outcomes: [] }
  };
  const request = buildGenerationPrompt(context, getProposalTemplate("meeting-notes"));
  const payload = JSON.parse(request.messages[1].content);
  assert.ok(payload.card_element_levels);
  assert.ok(payload.card_element_levels.required.includes("objective"));
  assert.ok(payload.card_element_levels.required.includes("stakeholders"));
  assert.ok(payload.card_storage_map);
  assert.ok(payload.card_storage_map.columns.includes("objective"));
  assert.ok(payload.card_storage_map.attrs.includes("stakeholders"));
});
