// harness 逐环测试：用独立测试拿到的 LLM 输出，逐步跑 validator → version-apply，定位断在哪一环。
// 不扩大边界，只验证数据落库这条链路。
import { buildGenerationPrompt } from "../src/proposals/prompt-builder.mjs";
import { getProposalTemplate } from "../src/proposals/catalog.mjs";
import { validateProposal } from "../src/proposals/validator.mjs";
import { applyReviewedChanges } from "../src/review/version-apply.mjs";
import { DatabaseSync } from "node:sqlite";

const API_URL = "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
const API_KEY = process.env.AI_GENERATION_API_KEY || "c594a0d01354421d918839109370cb03.uWAQel4YIgYiaQ88";
const MODEL = "glm-5.2";

// ====== 模拟会议纪要 ======
const meetingNotes = `
2026年7月14日 产品周会纪要
参会人：张明（产品负责人）、李华（前端开发）、王芳（后端开发）、赵强（测试）

一、本周进展
1. 推荐算法 v2 设计：张明负责，已完成需求文档（done），原型设计进行中（doing），进度 60%。目标 7 月 25 日前完成设计交付评审。当前 on-track。
2. 用户画像重构：李华负责前端，王芳负责后端。当前 at-risk——第三方数据接口未就绪（high 风险），后端 mock 无法替换。前端进度 70%，后端 40%。截止 8 月 10 日。
3. 性能优化专项：赵强主导，已完成首轮压测（done），发现 P99 延迟 800ms 超过 500ms 目标。决策：采用 CDN 缓存方案（张明拍板，7 月 14 日）。

二、下周计划
1. 推荐算法进入评审（review）。
2. 新任务：登录流程改版，张明负责，7 月 20 日启动，8 月 5 日截止，目标提升登录转化率。
`;

// ====== Step 0: 构建提示词 + 调 LLM ======
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 0: 调 LLM 获取原始输出");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const template = getProposalTemplate("meeting-notes");
const context = {
  projectId: "harness-test-0001",
  baseVersionId: 1,
  baseVersionLabel: "v1",
  templateId: "meeting-notes",
  templateVersion: "1.0.0",
  materials: [{ id: "mat-000000000000001", readiness: "ready" }],
  published: { overview: {}, units: [], roadmap: [], tasks: [], risks: [], outcomes: [], metrics: [] },
  evidence: [{
    evidenceId: "ev-0000000000000001",
    materialId: "mat-000000000000001",
    materialName: "周会纪要.txt",
    kind: "text",
    location: "full",
    text: meetingNotes
  }]
};

const { messages } = buildGenerationPrompt(context, template);
const llmResp = await fetch(API_URL, {
  method: "POST",
  headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({ model: MODEL, messages, temperature: 0.1, max_tokens: 8000, stream: false, response_format: { type: "json_object" }, reasoning_effort: "none" })
});
const llmPayload = JSON.parse(await llmResp.text());
const rawContent = llmPayload.choices[0].message.content;
const llmOutput = JSON.parse(rawContent);
console.log(`✓ LLM 返回 ${llmOutput.changes.length} 条变更, finish_reason=${llmPayload.choices[0].finish_reason}`);
console.log("");

// ====== Step 1: validator ======
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 1: validateProposal (结构校验)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
let validated;
try {
  validated = validateProposal(rawContent, context);
  console.log(`✓ validator 通过: ${validated.changes.length} 条变更`);
  console.log(`  warnings: ${JSON.stringify(validated.warnings)}`);
  const taskChanges = validated.changes.filter(c => c.module === "task-network");
  console.log(`  task-network 变更: ${taskChanges.length} 条`);
  // 打印每个 task 的 patch 字段
  taskChanges.forEach((c, i) => {
    console.log(`  [${i+1}] ${c.operation} ${c.targetId}: patch keys = [${Object.keys(c.patch).join(", ")}]`);
  });
} catch (err) {
  console.log(`✗ validator 失败: ${err.code || err.message}`);
  console.log(err.details || err.stack);
  process.exit(1);
}
console.log("");

// ====== Step 2: version-apply (落库) ======
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 2: applyReviewedChanges (落库)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// 建一个临时 in-memory SQLite
const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE project_versions (id INTEGER PRIMARY KEY, project_id TEXT, version_label TEXT, layer TEXT, metadata_json TEXT);
  CREATE TABLE project_tasks (version_id INTEGER, external_id TEXT, unit_external_id TEXT NOT NULL, parent_external_id TEXT, position INTEGER, title TEXT NOT NULL, start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '', progress REAL, data_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (version_id, external_id), CHECK(json_valid(data_json)));
  CREATE TABLE task_links (version_id INTEGER, task_external_id TEXT, depends_on_external_id TEXT, relation_type TEXT DEFAULT 'depends_on', position INTEGER);
  CREATE TABLE project_units (version_id INTEGER, external_id TEXT, position INTEGER, name TEXT, data_json TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE project_stages (version_id INTEGER, external_id TEXT, position INTEGER, title TEXT, date_label TEXT, data_json TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE project_closures (version_id INTEGER, external_id TEXT, position INTEGER, title TEXT, date_label TEXT, data_json TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE project_risks (version_id INTEGER, external_id TEXT, position INTEGER, title TEXT, severity TEXT, status TEXT, owner TEXT, mitigation TEXT, due_date TEXT, source TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE project_metrics (version_id INTEGER, external_id TEXT, position INTEGER, name TEXT, value_json TEXT, unit TEXT, status TEXT, as_of TEXT, target_json TEXT, source TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE project_workstreams (version_id INTEGER, external_id TEXT, position INTEGER, title TEXT, data_json TEXT, PRIMARY KEY(version_id, external_id));
  CREATE TABLE workstream_tasks (workstream_external_id TEXT, task_external_id TEXT, position INTEGER);
  INSERT INTO project_versions VALUES (1, 'harness-test-001', 'v1', 'draft', '{}');
`);

// 由于 validator 把 update 任务的 unitId 补成了 default-unit，
// 但 version-apply 需要 project_units 表里有对应的行，
// 先插入一个 default-unit
db.prepare("INSERT INTO project_units (version_id, external_id, position, name, data_json) VALUES (?,?,?,?,?)")
  .run(1, "default-unit", 0, "默认团队", JSON.stringify({ status: "active" }));

const versionId = 1;
const changes = validated.changes;
console.log(`准备 apply ${changes.length} 条变更到 versionId=${versionId}...`);

// 先打印每条 change 的实际 patch 值，定位哪个参数绑不上
console.log("");
console.log("=== 逐字段检查 task patch ===");
const taskChanges = changes.filter(c => c.module === "task-network" || c.module === "gantt");
taskChanges.forEach((c, i) => {
  const p = c.patch;
  console.log(`Task ${i+1} (${c.targetId}):`);
  console.log(`  unitId: ${typeof p.unitId} = ${JSON.stringify(p.unitId)}`);
  console.log(`  parentId: ${typeof p.parentId} = ${JSON.stringify(p.parentId)}`);
  console.log(`  title: ${typeof p.title} = ${JSON.stringify(p.title)?.slice(0,60)}`);
  console.log(`  startDate: ${typeof p.startDate} = ${JSON.stringify(p.startDate)}`);
  console.log(`  endDate: ${typeof p.endDate} = ${JSON.stringify(p.endDate)}`);
  console.log(`  progress: ${typeof p.progress} = ${JSON.stringify(p.progress)}`);
  console.log(`  objective: ${typeof p.objective} = ${JSON.stringify(p.objective)?.slice(0,60)}`);
  console.log(`  stakeholders: ${typeof p.stakeholders} = ${JSON.stringify(p.stakeholders)?.slice(0,60)}`);
  console.log(`  health: ${typeof p.health} = ${JSON.stringify(p.health)}`);
  console.log(`  deliverables: ${typeof p.deliverables} = ${JSON.stringify(p.deliverables)?.slice(0,80)}`);
  console.log(`  risks: ${typeof p.risks} = ${JSON.stringify(p.risks)?.slice(0,80)}`);
  console.log("");
});

try {
  applyReviewedChanges(db, versionId, changes);
  console.log("✓ applyReviewedChanges 成功！");
} catch (err) {
  console.log(`✗ applyReviewedChanges 失败: ${err.message}`);
  console.log(err.stack);
  console.log("");
  console.log("=== 失败时检查已写入的 task data_json ===");
  const tasks = db.prepare("SELECT external_id, title, data_json FROM project_tasks WHERE version_id=?").all(versionId);
  tasks.forEach(t => {
    console.log(`  ${t.external_id}: ${t.title}`);
    console.log(`    data_json: ${t.data_json}`);
  });
  process.exit(1);
}

console.log("");
console.log("=== 落库结果 ===");
const tasks = db.prepare("SELECT external_id, title, start_date, end_date, progress, data_json FROM project_tasks WHERE version_id=?").all(versionId);
console.log(`写入 task 数量: ${tasks.length}`);
tasks.forEach((t, i) => {
  console.log(`--- Task ${i+1}: ${t.external_id} ---`);
  console.log(`  title: ${t.title}`);
  console.log(`  start_date: ${t.start_date}`);
  console.log(`  end_date: ${t.end_date}`);
  console.log(`  progress: ${t.progress}`);
  console.log(`  data_json: ${t.data_json}`);
  const data = JSON.parse(t.data_json);
  console.log(`  data_json keys: [${Object.keys(data).join(", ")}]`);
  // 检查 PMBOK 新字段是否在里面
  const pmbokNew = ["objective", "stakeholders", "health", "deliverables", "risks", "acceptanceCriteria", "decisions"];
  const present = pmbokNew.filter(f => data[f] !== undefined);
  const missing = pmbokNew.filter(f => data[f] === undefined);
  console.log(`  PMBOK 新字段存在: ${present.length ? present.join(", ") : "(无)"}`);
  console.log(`  PMBOK 新字段丢失: ${missing.length ? missing.join(", ") : "(无)"}`);
  console.log("");
});

db.close();
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("harness 逐环测试完成");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
