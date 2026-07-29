// CRUD 层测试：用真实 DB + 真实 pending proposal，跑 merge → release，验证 PMBOK 数据落库。
// 直接调用 review-service 的 merge，走真实代码路径。
import { DatabaseSync } from "node:sqlite";

const DB_PATH = "data/platform.sqlite";
const PROPOSAL_ID = "df9242f4-c454-42e8-b77b-cf1c3e88b340";

// 备份 DB
import { copyFileSync, existsSync } from "node:fs";
const backupPath = DB_PATH + ".backup-" + Date.now();
copyFileSync(DB_PATH, backupPath);
console.log("DB 已备份到:", backupPath);
console.log("");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL;");

// 动态 import review-service
const { createReviewService } = await import("../src/review/review-service.mjs");
const { createProjectRepository } = await import("../src/repositories/project-repository.mjs");

// 平台管理员 principal
const adminUser = { id: "usr_b2f8d19d-17c5-4091-9be8-9d59a0942566", isPlatformAdmin: 1 };

const reviewService = createReviewService(db);
const projects = createProjectRepository(db);

// 查 proposal 和 project
const proposalRow = db.prepare("SELECT project_id, base_version_id, status FROM change_proposals WHERE id=?").get(PROPOSAL_ID);
const projectId = proposalRow.project_id;
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CRUD 测试: merge pending proposal");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("proposal:", PROPOSAL_ID);
console.log("project:", projectId);
console.log("base_version_id:", proposalRow.base_version_id);
console.log("status:", proposalRow.status);
console.log("");

// 查 merge 前的状态
const project = db.prepare("SELECT published_version_id, draft_version_id FROM projects WHERE id=?").get(projectId);
console.log("merge 前:");
console.log("  published_version_id:", project.published_version_id);
console.log("  draft_version_id:", project.draft_version_id);

const draftTasks = db.prepare("SELECT count(*) as c FROM project_tasks WHERE version_id=?").get(project.draft_version_id).c;
console.log("  draft tasks:", draftTasks);
console.log("");

// 执行 merge
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 1: reviewService.merge()");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
try {
  const result = reviewService.merge(adminUser, projectId, PROPOSAL_ID);
  console.log("✓ merge 成功!");
  console.log("  result draft version:", result.merge?.resultDraftVersionId);
} catch (err) {
  console.log("✗ merge 失败:", err.code || err.message);
  console.log(err.stack);
  db.close();
  process.exit(1);
}
console.log("");

// 检查 merge 后的 draft tasks
const projectAfter = db.prepare("SELECT published_version_id, draft_version_id FROM projects WHERE id=?").get(projectId);
console.log("merge 后:");
console.log("  published_version_id:", projectAfter.published_version_id);
console.log("  draft_version_id:", projectAfter.draft_version_id);

const newDraftId = projectAfter.draft_version_id;
const draftTasksAfter = db.prepare("SELECT count(*) as c FROM project_tasks WHERE version_id=?").get(newDraftId).c;
console.log("  draft tasks:", draftTasksAfter);
console.log("");

// 检查 PMBOK 字段是否落进 data_json
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 2: 检查 draft task data_json 的 PMBOK 字段");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const tasks = db.prepare("SELECT external_id, title, data_json FROM project_tasks WHERE version_id=? ORDER BY position").all(newDraftId);
const pmbokFields = ["objective", "stakeholders", "health", "deliverables", "risks", "acceptanceCriteria", "decisions"];
let pmbokHitCount = {};
pmbokFields.forEach(f => pmbokHitCount[f] = 0);

tasks.forEach((t, i) => {
  const data = JSON.parse(t.data_json);
  console.log(`[${i+1}] ${t.external_id}: ${t.title}`);
  console.log(`    data_json keys: [${Object.keys(data).join(", ")}]`);
  pmbokFields.forEach(f => {
    if (data[f] !== undefined && data[f] !== null && !(Array.isArray(data[f]) && data[f].length === 0)) {
      pmbokHitCount[f] += 1;
    }
  });
});

console.log("");
console.log("=== PMBOK 字段落库统计 ===");
pmbokFields.forEach(f => {
  console.log(`  ${f}: ${pmbokHitCount[f]}/${tasks.length}`);
});
console.log("");

// Step 3: release（publish 流程较重，需要 previewToken，这里只做 preview 验证 draft 可发布性）
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 3: release preview（验证 draft 可发布性）");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const { createReleaseService } = await import("../src/release/release-service.mjs");
const releaseService = createReleaseService(db);
try {
  const preview = releaseService.preview(adminUser, projectId);
  console.log("✓ preview 成功!");
  console.log("  published tasks:", preview.published.tasks);
  console.log("  draft tasks:", preview.draft.tasks);
  console.log("  changes count:", preview.changes.count);
  console.log("  validation valid:", preview.validation.valid);
  if (!preview.validation.valid) {
    console.log("  validation code:", preview.validation.code);
    console.log("  validation msg:", preview.validation.message);
  }
} catch (err) {
  console.log("✗ preview 失败:", err.code || err.message);
}

db.close();
console.log("");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CRUD 层测试完成");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");
console.log("如需还原 DB: cp " + backupPath + " " + DB_PATH);
