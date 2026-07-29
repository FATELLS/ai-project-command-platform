// 批量端到端测试：对所有完备测试材料逐一验证"材料→生成→路线图"
// 输出覆盖率报告
//
// 测试策略：
//   - 每份材料创建独立项目（project-{materialName}），避免互相干扰
//   - 直接写 evidence_blocks（跳过提取器上传流程，聚焦于生成链路测试）
//   - 调用真实 LLM（glm-5.2）生成变更
//   - 自动接受+合并+发布
//   - 检查路线图 PMBOK 字段覆盖率
//
// 注意：此脚本消耗 LLM API 配额（每份材料约 1 次调用）

import { DatabaseSync } from "node:sqlite";
import { readFileSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { extractMaterial } from "../src/materials/extractors/index.mjs";

const DB_PATH = "data/platform.sqlite";
const MATERIALS_DIR = "mock-materials/comprehensive";

// 加载 .env.local
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

// 构建 visionConfig 给 PDF/图片提取器（走 GLM-4.6V，不依赖 pdftotext/tesseract）
const visionConfig = {
  baseUrl: process.env.AI_VISION_BASE_URL,
  apiKey: process.env.AI_GENERATION_API_KEY,
  model: process.env.AI_VISION_MODEL,
  timeoutMs: Number(process.env.AI_VISION_TIMEOUT_MS ?? 120_000),
  maxOutputTokens: Number(process.env.AI_VISION_MAX_OUTPUT_TOKENS ?? 4_000)
};
console.log("视觉提取模型:", visionConfig.model, "@", visionConfig.baseUrl);
console.log("");

// 备份 DB
const backupPath = DB_PATH + ".backup-comprehensive-" + Date.now();
copyFileSync(DB_PATH, backupPath);
console.log("DB 已备份:", backupPath);
console.log("");

// 收集所有材料文件（含 PNG 测试图片）
const materialFiles = readdirSync(MATERIALS_DIR)
  .filter(f => !f.startsWith(".") && !f.endsWith(".txt.bak") && f.startsWith("test-") === false ? true : f.startsWith("test-"))
  .sort();
console.log("发现材料:", materialFiles.length, "份");
console.log("");

// 提取所有材料（PDF/图片走 GLM-4.6V 视觉提取）
const testCases = [];
for (const filename of materialFiles) {
  const filepath = join(MATERIALS_DIR, filename);
  const ext = "." + filename.split(".").pop();
  try {
    const result = await extractMaterial(
      { path: filepath, extension: ext, projectId: "test", materialId: "test" },
      { capabilities: { visionConfig } }
    );
    testCases.push({ filename, ext, blocks: result.blocks, stats: result.stats });
    console.log(`  ✓ ${filename.padEnd(42)} ${result.blocks.length} blocks`);
  } catch (err) {
    console.log(`  ✗ ${filename.padEnd(42)} ${err.code || err.message}（跳过）`);
  }
}
console.log("");
console.log(`可测试材料: ${testCases.length} 份`);
console.log("");

// 初始化服务
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=DELETE;");  // 不用 WAL，避免 node:sqlite 实验性 bug
db.exec("PRAGMA busy_timeout=10000;");
db.exec("PRAGMA synchronous=FULL;");     // 最安全的同步模式

// 动态读取管理员 ID（避免硬编码 UUID 在不同数据库中变化）
const adminRow = db.prepare("SELECT id FROM users WHERE login_name=?").get("admin");
const ADMIN_ID = adminRow?.id;
if (!ADMIN_ID) { console.error("找不到 admin 用户，请先启动服务器初始化数据库"); db.close(); process.exit(1); }
console.log("管理员 ID:", ADMIN_ID);
console.log("");

const { createGenerationService } = await import("../src/proposals/generation-service.mjs");
const { createReviewService } = await import("../src/review/review-service.mjs");
const { createReleaseService } = await import("../src/release/release-service.mjs");
const { createProjectRepository } = await import("../src/repositories/project-repository.mjs");
const { createProjectService } = await import("../src/services/project-service.mjs");
const { loadRoadmap } = await import("../src/modules/loaders.mjs");

const adminUser = { id: ADMIN_ID, isPlatformAdmin: 1, displayName: "平台管理员", loginName: "admin" };
const projectService = createProjectService(db);
const pmbokFields = ["objective", "stakeholders", "health", "deliverables", "risks", "acceptanceCriteria", "decisions", "expectedOutput"];

// 逐份材料端到端测试
const results = [];

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const shortName = tc.filename.replace(/\.[^.]+$/, "").slice(0, 20);
  const projectId = `e2e-${shortName}-${randomUUID().slice(0, 6)}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  console.log("══════════════════════════════════════════════════════════");
  console.log(`测试 [${i+1}/${testCases.length}]: ${tc.filename}`);
  console.log(`项目 ID: ${projectId}`);
  console.log("══════════════════════════════════════════════════════════");

  const result = { filename: tc.filename, ext: tc.ext, blocks: tc.blocks.length, projectId, status: "pending", tasks: 0, pmbok: {}, errors: [] };

  try {
    // 1. 创建项目
    try {
      projectService.createProject(adminUser, {
        id: projectId,
        name: `E2E测试-${shortName}`,
        templateId: "standard-project-v1",
        summary: `测试材料: ${tc.filename}`
      });
      console.log("  ✓ 项目创建成功");
    } catch (err) {
      console.log("  ✗ 项目创建失败:", err.code || err.message);
      result.errors.push(`createProject: ${err.code || err.message}`);
      results.push(result);
      continue;
    }

    // 2. 手动写入 evidence_blocks（跳过上传+提取流程）
    const materialId = randomUUID();
    const now = new Date().toISOString();
    const templateMap = {
      ".csv": "metrics-data", ".json": "metrics-data", ".yaml": "project-plan",
      ".md": "meeting-notes", ".txt": "meeting-notes",
      ".docx": "meeting-notes", ".pptx": "meeting-notes", ".xlsx": "metrics-data",
      ".png": "meeting-notes"
    };
    const templateId = templateMap[tc.ext] || "meeting-notes";

    const fakeSha256 = createHash("sha256").update(materialId).digest("hex");
    db.prepare(`INSERT INTO project_materials (id, project_id, source_kind, display_name, canonical_extension, canonical_mime, sha256, byte_size, status, active_extraction_version, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, 1, ?, ?, ?)`)
      .run(materialId, projectId, "upload", tc.filename, tc.ext, "application/octet-stream", fakeSha256, 0, "ready", ADMIN_ID, now, now);

    const insertEvidence = db.prepare(`INSERT INTO evidence_blocks (external_id, project_id, material_id, extraction_version, ordinal, kind, location_json, text, summary, content_hash, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    // evidence_blocks.kind CHECK 只允许 text/paragraph/page/table/slide/sheet/image
    // 视觉提取返回 heading/list/note/chart 等，需要映射
    const KIND_MAP = { heading: "paragraph", list: "text", note: "text", chart: "table", paragraph: "paragraph", text: "text", table: "table", page: "page", slide: "slide", sheet: "sheet", image: "image" };
    for (const block of tc.blocks) {
      const dbKind = KIND_MAP[block.kind] || "text";
      insertEvidence.run(randomUUID(), projectId, materialId, 1, block.ordinal, dbKind, JSON.stringify(block.location), block.text, "", hashText(block.text), now);
    }

    db.prepare(`INSERT INTO material_update_selections (project_id, material_id, template_id, template_version, selected_by, selected_at)
      VALUES (?,?,?,?,?,?)`).run(projectId, materialId, templateId, "1.0.0", ADMIN_ID, now);
    db.prepare(`INSERT INTO material_generation_grants (project_id, material_id, enabled, granted_by, granted_at)
      VALUES (?,?,?,?,?)`).run(projectId, materialId, 1, ADMIN_ID, now);
    console.log("  ✓ 材料和 evidence 写入成功 (" + tc.blocks.length + " blocks)");

    // 3. 生成
    const generationService = createGenerationService(db, { quotaOptions: { perMinute: 20, daily: 500, maxConcurrency: 4 } });
    const proj = db.prepare("SELECT published_version_id AS pubVer FROM projects WHERE id=?").get(projectId);

    let job;
    try {
      job = generationService.createJob(adminUser, {
        projectId, materialIds: [materialId], baseVersionId: proj.pubVer,
        idempotencyKey: "e2e-comp-" + randomUUID().slice(0, 8)
      });
      console.log("  等待 LLM 生成...");
      const processed = await generationService.processJob(projectId, job.id, {});
      if (processed.state !== "succeeded") {
        console.log("  ✗ 生成失败:", processed.state, processed.errorCode || "");
        if (processed.validation) console.log("    validation:", JSON.stringify(processed.validation).slice(0, 150));
        result.errors.push(`generation: ${processed.state}/${processed.errorCode}`);
        result.status = "generation_failed";
        results.push(result);
        continue;
      }
      console.log("  ✓ LLM 生成成功, proposal:", processed.proposalId);
      job = processed;
    } catch (err) {
      console.log("  ✗ 生成异常:", err.code || err.message);
      result.errors.push(`generation: ${err.code || err.message}`);
      result.status = "generation_error";
      results.push(result);
      continue;
    }

    // 4. 审核 + 合并
    const reviewService = createReviewService(db);
    try {
      const review = reviewService.getReview(adminUser, projectId, job.proposalId);
      for (const change of review.proposal.changes) {
        if (change.review?.decision !== "accepted") {
          reviewService.setDecision(adminUser, projectId, job.proposalId, change.changeId, { decision: "accepted" });
        }
      }
      reviewService.merge(adminUser, projectId, job.proposalId);
      console.log("  ✓ 审核合并成功");
    } catch (err) {
      console.log("  ✗ 合并失败:", err.code || err.message);
      result.errors.push(`merge: ${err.code || err.message}`);
      result.status = "merge_failed";
      results.push(result);
      continue;
    }

    // 5. 发布
    const releaseService = createReleaseService(db);
    try {
      const preview = releaseService.preview(adminUser, projectId);
      if (preview.validation.valid) {
        releaseService.publish(adminUser, projectId, {
          previewToken: preview.previewToken, acknowledged: true,
          versionLabel: "e2e-" + Date.now().toString(36)
        });
        console.log("  ✓ 发布成功");
      } else {
        console.log("  ✗ 发布校验失败:", preview.validation.code);
        result.errors.push(`publish: ${preview.validation.code}`);
        result.status = "publish_failed";
        results.push(result);
        continue;
      }
    } catch (err) {
      console.log("  ✗ 发布异常:", err.code || err.message);
      result.errors.push(`publish: ${err.code || err.message}`);
      result.status = "publish_error";
      results.push(result);
      continue;
    }

    // 6. 检查路线图
    const repository = createProjectRepository(db);
    const graph = repository.getModuleVersionGraph(projectId, "published");
    if (!graph) {
      result.errors.push("loadRoadmap: graph is null");
      result.status = "roadmap_failed";
      results.push(result);
      continue;
    }
    const roadmap = loadRoadmap(graph);
    result.tasks = roadmap.tasks.length;

    pmbokFields.forEach(f => result.pmbok[f] = 0);
    roadmap.tasks.forEach(task => {
      pmbokFields.forEach(f => {
        const val = task[f];
        if (val !== undefined && val !== null && !(Array.isArray(val) && val.length === 0) && val !== "") {
          result.pmbok[f] += 1;
        }
      });
    });

    result.status = "success";
    console.log("  ✓ 路线图: " + roadmap.tasks.length + " 个任务");
    const hits = Object.values(result.pmbok).reduce((a, b) => a + b, 0);
    const max = pmbokFields.length * roadmap.tasks.length;
    console.log("  ✓ PMBOK 覆盖: " + Math.round(max > 0 ? hits / max * 100 : 0) + "% (" + hits + "/" + max + ")");

  } catch (err) {
    console.log("  ✗ 意外错误:", err.message);
    result.errors.push(`unexpected: ${err.message}`);
    result.status = "error";
  }

  results.push(result);
  console.log("");
}

// ═══════════════════════════════════════════════════════
// 汇总报告
// ═══════════════════════════════════════════════════════
console.log("");
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║          批量端到端测试报告：材料 → 路线图                      ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

const succeeded = results.filter(r => r.status === "success");
const failed = results.filter(r => r.status !== "success");
console.log(`总计: ${results.length} 份材料`);
console.log(`成功: ${succeeded.length} 份`);
console.log(`失败: ${failed.length} 份`);
console.log("");

if (failed.length > 0) {
  console.log("失败列表:");
  failed.forEach(r => {
    console.log(`  ✗ ${r.filename.padEnd(42)} [${r.status}] ${r.errors.join("; ")}`);
  });
  console.log("");
}

if (succeeded.length > 0) {
  console.log("PMBOK 字段覆盖率统计：");
  console.log("");
  console.log("文件".padEnd(42) + "任务数 " + pmbokFields.map(f => f.slice(0, 6).padStart(7)).join("") + "   整体");
  console.log("─".repeat(42) + " ───── " + "─".repeat(pmbokFields.length * 7) + " ──────");

  succeeded.forEach(r => {
    const totalHits = Object.values(r.pmbok).reduce((a, b) => a + b, 0);
    const max = pmbokFields.length * r.tasks;
    const pct = max > 0 ? Math.round(totalHits / max * 100) : 0;
    const vals = pmbokFields.map(f => {
      const v = r.pmbok[f] || 0;
      const cellPct = r.tasks > 0 ? Math.round(v / r.tasks * 100) : 0;
      return String(cellPct).padStart(6) + "%";
    }).join(" ");
    console.log(r.filename.padEnd(42) + " " + String(r.tasks).padStart(5) + " " + vals + "  " + String(pct).padStart(4) + "%");
  });

  console.log("");
  // 按格式汇总
  const byFormat = {};
  succeeded.forEach(r => {
    const fmt = r.ext;
    if (!byFormat[fmt]) byFormat[fmt] = { count: 0, tasks: 0, hits: 0, max: 0 };
    byFormat[fmt].count++;
    byFormat[fmt].tasks += r.tasks;
    byFormat[fmt].hits += Object.values(r.pmbok).reduce((a, b) => a + b, 0);
    byFormat[fmt].max += pmbokFields.length * r.tasks;
  });
  console.log("按格式汇总：");
  Object.entries(byFormat).sort().forEach(([fmt, d]) => {
    const pct = d.max > 0 ? Math.round(d.hits / d.max * 100) : 0;
    console.log(`  ${fmt.padEnd(8)} ${d.count}份  ${d.tasks}任务  PMBOK覆盖率: ${pct}%`);
  });
}

console.log("");
console.log("如需还原 DB: cp " + backupPath + " " + DB_PATH);

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

db.close();
