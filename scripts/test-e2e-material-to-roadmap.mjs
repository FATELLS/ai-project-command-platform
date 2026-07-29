// 端到端测试：材料 → LLM 生成 → 合并 → 发布 → 加载路线图
// 验证"解决材料现在能不能正常生成路线图"
//
// 使用 sales-demo 项目（有3份已就绪材料 + evidence + generation grant + update template）
// 完整链路：
//   1. 备份 DB
//   2. buildGenerationContext（验证 context 可构建）
//   3. generation.createJob + processJob（调用真实 LLM）
//   4. reviewService.merge（合并到 draft）
//   5. releaseService.preview + publish（发布到 published）
//   6. loadRoadmap（加载路线图，检查 PMBOK 字段）
//   7. 输出最终路线图统计

import { DatabaseSync } from "node:sqlite";
import { copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// 手动加载 .env.local
const envContent = readFileSync(".env.local", "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (key && !process.env[key]) process.env[key] = val;
}

const DB_PATH = "data/platform.sqlite";
const PROJECT_ID = "sales-demo";
const ADMIN_ID = "usr_b2f8d19d-17c5-4091-9be8-9d59a0942566";

// ─── Step 0: 备份 DB ───
const backupPath = DB_PATH + ".backup-e2e-" + Date.now();
copyFileSync(DB_PATH, backupPath);
console.log("╔══════════════════════════════════════════════════════════");
console.log("║  端到端测试：材料 → 生成 → 路线图                          ");
console.log("╚══════════════════════════════════════════════════════════");
console.log("DB 已备份:", backupPath);
console.log("");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL;");

// 动态 import 所有服务
const { createGenerationService } = await import("../src/proposals/generation-service.mjs");
const { createReviewService } = await import("../src/review/review-service.mjs");
const { createReleaseService } = await import("../src/release/release-service.mjs");
const { createProjectRepository } = await import("../src/repositories/project-repository.mjs");
const { buildGenerationContext } = await import("../src/proposals/context-builder.mjs");
const { loadRoadmap } = await import("../src/modules/loaders.mjs");
const { createAiQuota } = await import("../src/ai/quota.mjs");

const adminUser = { id: ADMIN_ID, isPlatformAdmin: 1, displayName: "平台管理员", loginName: "admin" };

// ─── 查找可用材料 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 1: 查找可用材料");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const materials = db.prepare(`
  SELECT m.id, m.display_name AS name, m.active_extraction_version AS extVer,
         (SELECT count(*) FROM evidence_blocks e WHERE e.project_id=m.project_id AND e.material_id=m.id AND e.extraction_version=m.active_extraction_version) AS evidenceCount
  FROM project_materials m
  WHERE m.project_id=? AND m.status='ready'
`).all(PROJECT_ID);
materials.forEach((m, i) => console.log(`  [${i+1}] ${m.name} (${m.evidenceCount} evidence blocks)`));
console.log("");

const materialIds = materials.map(m => m.id);
const project = db.prepare("SELECT published_version_id AS pubVer, draft_version_id AS draftVer FROM projects WHERE id=?").get(PROJECT_ID);
console.log("当前 published_version_id:", project.pubVer);
console.log("当前 draft_version_id:", project.draftVer);
console.log("");

// ─── Step 2: 构建 Generation Context ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 2: buildGenerationContext");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
let context;
try {
  context = buildGenerationContext(db, {
    projectId: PROJECT_ID,
    materialIds,
    baseVersionId: project.pubVer
  });
  console.log("✓ context 构建成功");
  console.log("  baseVersionId:", context.baseVersionId);
  console.log("  template:", context.templateId + "@" + context.templateVersion);
  console.log("  evidence blocks:", context.evidence.length);
  console.log("  published tasks:", context.published.tasks.length);
} catch (err) {
  console.log("✗ context 构建失败:", err.code || err.message);
  if (err.details) console.log("  details:", JSON.stringify(err.details));
  db.close();
  process.exit(1);
}
console.log("");

// ─── Step 3: 调用 LLM 生成 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 3: generation.createJob + processJob（调用 LLM）");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const generationService = createGenerationService(db, {
  quotaOptions: { perMinute: 10, daily: 100, maxConcurrency: 2 }
});

const idempotencyKey = "e2e-test-" + randomUUID().slice(0, 8);
let job;
try {
  job = generationService.createJob(adminUser, {
    projectId: PROJECT_ID,
    materialIds,
    baseVersionId: project.pubVer,
    idempotencyKey
  });
  console.log("  job created:", job.id);
  console.log("  state:", job.state);
  console.log("  等待 LLM 生成... (最长 5 分钟)");
} catch (err) {
  console.log("✗ createJob 失败:", err.code || err.message);
  db.close();
  process.exit(1);
}

// processJob 会调用真实 LLM
let processedJob;
try {
  processedJob = await generationService.processJob(PROJECT_ID, job.id, {});
  console.log("✓ processJob 完成");
  console.log("  state:", processedJob.state);
  console.log("  proposalId:", processedJob.proposalId);
  if (processedJob.errorCode) {
    console.log("  errorCode:", processedJob.errorCode);
    if (processedJob.validation) {
      console.log("  validation:", JSON.stringify(processedJob.validation).slice(0, 200));
    }
  }
} catch (err) {
  console.log("✗ processJob 失败:", err.code || err.message);
  console.log(err.stack);
  db.close();
  process.exit(1);
}

if (processedJob.state !== "succeeded") {
  console.log("");
  console.log("⚠️ 生成未成功，state =", processedJob.state);
  console.log("  停止后续测试");
  db.close();
  process.exit(1);
}
console.log("");

// ─── Step 4: 审核合并 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 4: review accept → merge");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const reviewService = createReviewService(db);
const proposalId = processedJob.proposalId;

// 先查看 proposal review 状态
const reviewInfo = reviewService.getReview(adminUser, PROJECT_ID, proposalId);
console.log("  proposal changes:", reviewInfo.proposal.changes.length);
console.log("  capabilities:", JSON.stringify(reviewInfo.capabilities));
console.log("  pending:", reviewInfo.capabilities.pending, "accepted:", reviewInfo.capabilities.accepted);

// 逐个接受所有变更项
if (reviewInfo.capabilities.pending > 0 || reviewInfo.capabilities.accepted === 0) {
  console.log("  自动接受所有变更项...");
  for (const change of reviewInfo.proposal.changes) {
    if (change.review?.decision !== "accepted") {
      reviewService.setDecision(adminUser, PROJECT_ID, proposalId, change.changeId, { decision: "accepted" });
      console.log("    ✓ accepted:", change.changeId, "(" + change.module + "/" + change.operation + ")");
    }
  }
}

try {
  const mergeResult = reviewService.merge(adminUser, PROJECT_ID, proposalId);
  console.log("✓ merge 成功");
  console.log("  resultDraftVersionId:", mergeResult.merge?.resultDraftVersionId);
} catch (err) {
  console.log("✗ merge 失败:", err.code || err.message);
  console.log(err.stack);
  db.close();
  process.exit(1);
}
console.log("");

// ─── Step 5: 发布 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 5: releaseService.preview + publish");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const releaseService = createReleaseService(db);

let preview;
try {
  preview = releaseService.preview(adminUser, PROJECT_ID);
  console.log("✓ preview 成功");
  console.log("  published tasks:", preview.published.tasks);
  console.log("  draft tasks:", preview.draft.tasks);
  console.log("  changes:", preview.changes.count);
  console.log("  validation valid:", preview.validation.valid);
  if (!preview.validation.valid) {
    console.log("  validation code:", preview.validation.code);
    console.log("  validation msg:", preview.validation.message);
  }
} catch (err) {
  console.log("✗ preview 失败:", err.code || err.message);
  db.close();
  process.exit(1);
}

if (preview.validation.valid) {
  try {
    const versionLabel = "e2e-" + Date.now().toString(36);
    const pubResult = releaseService.publish(adminUser, PROJECT_ID, {
      previewToken: preview.previewToken,
      acknowledged: true,
      versionLabel
    });
    console.log("✓ publish 成功");
    console.log("  version label:", versionLabel);
  } catch (err) {
    console.log("✗ publish 失败:", err.code || err.message);
    console.log(err.stack);
    db.close();
    process.exit(1);
  }
} else {
  console.log("⚠️ validation 失败，跳过 publish");
}
console.log("");

// ─── Step 6: 加载路线图 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 6: loadRoadmap（加载路线图）");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const repository = createProjectRepository(db);
const graph = repository.getModuleVersionGraph(PROJECT_ID, "published");
if (!graph) {
  console.log("✗ getModuleVersionGraph 返回 null");
  db.close();
  process.exit(1);
}
console.log("✓ graph 加载成功");
console.log("  versionId:", graph.versionId);
console.log("  units:", graph.units.length);
console.log("  tasks:", graph.tasks.length);
console.log("  stages:", graph.stages.length);

const roadmap = loadRoadmap(graph);
console.log("✓ loadRoadmap 成功");
console.log("  roadmap.stages:", roadmap.stages.length);
console.log("  roadmap.tasks:", roadmap.tasks.length);
console.log("  roadmap.units:", roadmap.units.length);
console.log("");

// ─── Step 7: PMBOK 字段检查 ───
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Step 7: PMBOK 字段检查");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const pmbokFields = ["objective", "stakeholders", "health", "deliverables", "risks", "acceptanceCriteria", "decisions", "expectedOutput"];
const stats = {};
pmbokFields.forEach(f => stats[f] = 0);

roadmap.tasks.forEach((task, i) => {
  console.log(`  [${i+1}] ${task.id}: ${task.title}`);
  pmbokFields.forEach(f => {
    const val = task[f];
    if (val !== undefined && val !== null && !(Array.isArray(val) && val.length === 0) && val !== "") {
      stats[f] += 1;
      const preview = typeof val === "string" ? val.slice(0, 60) : JSON.stringify(val).slice(0, 60);
      console.log(`       ${f}: ${preview}`);
    }
  });
});

console.log("");
console.log("=== PMBOK 字段覆盖率 ===");
pmbokFields.forEach(f => {
  const pct = roadmap.tasks.length > 0 ? Math.round(stats[f] / roadmap.tasks.length * 100) : 0;
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  console.log(`  ${f.padEnd(22)} ${bar} ${stats[f]}/${roadmap.tasks.length} (${pct}%)`);
});
console.log("");

// ─── 结论 ───
console.log("╔══════════════════════════════════════════════════════════");
const totalHits = Object.values(stats).reduce((a, b) => a + b, 0);
const maxHits = pmbokFields.length * roadmap.tasks.length;
const overall = maxHits > 0 ? Math.round(totalHits / maxHits * 100) : 0;
if (roadmap.tasks.length > 0 && overall > 30) {
  console.log("║  ✓ 端到端测试通过：材料能正常生成路线图                     ");
} else if (roadmap.tasks.length > 0) {
  console.log("║  ⚠️ 路线图已生成但 PMBOK 覆盖率偏低 (" + overall + "%)             ");
} else {
  console.log("║  ✗ 路线图没有任务，生成失败                                ");
}
console.log(`║  PMBOK 整体覆盖率: ${overall}% (${totalHits}/${maxHits})`);
console.log(`║  路线图任务数: ${roadmap.tasks.length}`);
console.log("╚══════════════════════════════════════════════════════════");
console.log("");
console.log("如需还原 DB: cp " + backupPath + " " + DB_PATH);

db.close();
