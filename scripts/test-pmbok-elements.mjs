// PMBOK 元素端到端验证脚本
// 重点：验证新提示词下，LLM 输出的 task-network 变更是否包含 objective/health/deliverables/stakeholders/risks 等字段
import { readFileSync, readdirSync } from "fs";

const BASE = "http://127.0.0.1:4173";
const MATERIALS_DIR = "/Users/mingyuzhuo/Documents/AI Project Command Platform/mock-materials";

// 用一份内容丰富的销售材料测试——确保有目标、人员、时间、风险
const PROJECT_ID = `pmbok-${Date.now().toString(36)}`;
const PROJECT_NAME = "PMBOK 元素验证 - 智能制造销售战役";

async function api(method, path, body, csrf, session) {
  const headers = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  if (session) headers["Cookie"] = session;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json, ok: res.ok };
}

function extractSession(setCookie) {
  const match = String(setCookie || "").match(/platform_session=([^;]+)/);
  return match ? `platform_session=${match[1]}` : "";
}

async function waitForMaterial(session, csrf, projectId, materialId, maxWait = 40) {
  for (let i = 0; i < maxWait; i++) {
    const r = await api("GET", `/api/projects/${projectId}/materials/${materialId}`, undefined, undefined, session);
    if (r.json?.material?.status === "ready") return true;
    if (r.json?.material?.status === "failed") return false;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function waitForGeneration(session, csrf, projectId, taskId, maxWait = 300) {
  for (let i = 0; i < maxWait; i++) {
    const r = await api("GET", `/api/projects/${projectId}/generation-tasks/${taskId}`, undefined, undefined, session);
    const state = r.json?.task?.state;
    if (state === "succeeded" || state === "failed_terminal" || state === "failed_retryable") return r.json?.task;
    if (i % 15 === 0) console.log(`  ⏳ 生成中 (${i}s) state=${state || "?"}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

console.log("=".repeat(70));
console.log("PMBOK 元素端到端验证");
console.log(`项目: ${PROJECT_NAME} (${PROJECT_ID})`);
console.log("=".repeat(70));

// 1. Login
console.log("\n[1] 登录...");
const loginRes = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ loginName: "admin", password: "admin12345678" }),
});
const loginData = await loginRes.json();
const csrf = loginData.csrfToken;
const session = extractSession(loginRes.headers.get("set-cookie"));
console.log(`  ✅ CSRF: ${csrf?.slice(0, 16)}...`);

// 2. Create project
console.log("\n[2] 创建项目...");
const createRes = await api("POST", "/api/projects", {
  id: PROJECT_ID,
  name: PROJECT_NAME,
  templateId: "campaign-map-v1",
}, csrf, session);
if (createRes.ok) {
  console.log(`  ✅ 项目创建成功`);
} else {
  console.log(`  ❌ 创建失败:`, createRes.json?.error || createRes.status);
  process.exit(1);
}

// 3. Upload 2 materials (启动会纪要 + 进展会纪要) - 内容丰富，包含目标/人员/时间/风险
console.log("\n[3] 创建材料...");
const salesDir = `${MATERIALS_DIR}/sales`;
const files = readdirSync(salesDir).filter(f => f.endsWith(".md")).slice(0, 2);
const materialIds = [];
for (const file of files) {
  const content = readFileSync(`${salesDir}/${file}`, "utf8");
  const title = file.replace(/^\d+-/, "").replace(/\.md$/, "");
  const matRes = await api("POST", `/api/projects/${PROJECT_ID}/materials/manual`, {
    title,
    body: content,
    updateTemplateId: "meeting-notes",
    updateTemplateVersion: "1.0.0",
  }, csrf, session);
  if (matRes.ok) {
    const mid = matRes.json.material.id;
    materialIds.push(mid);
    console.log(`  ✅ ${title} (${mid.slice(0, 8)}...)`);
  } else {
    console.log(`  ❌ ${title}:`, matRes.json?.error);
  }
}

// 4. Wait for materials ready + enable generation
console.log("\n[4] 等待材料就绪...");
for (const mid of materialIds) {
  const ready = await waitForMaterial(session, csrf, PROJECT_ID, mid);
  if (ready) {
    await api("PATCH", `/api/projects/${PROJECT_ID}/materials/${mid}/generation`, { enabled: true }, csrf, session);
    console.log(`  ✅ ${mid.slice(0, 8)}... ready`);
  } else {
    console.log(`  ⚠️ ${mid.slice(0, 8)}... 未就绪`);
  }
}

// 5. Generate proposals
console.log("\n[5] AI 生成（新提示词 + PMBOK 元素引导）...");
const capRes = await api("GET", `/api/projects/${PROJECT_ID}/generation-tasks/capabilities`, undefined, undefined, session);
const baseVersionId = capRes.json?.baseVersionId;
const eligibleMaterials = capRes.json?.eligibleMaterials || [];
console.log(`  baseVersionId: ${baseVersionId}, eligibleMaterials: ${eligibleMaterials.length}`);

if (!baseVersionId || eligibleMaterials.length === 0) {
  console.log("  ⛔ 无可用材料或版本");
  process.exit(1);
}

const genRes = await api("POST", `/api/projects/${PROJECT_ID}/generation-tasks`, {
  materialIds: eligibleMaterials.map(m => m.id),
  baseVersionId,
  idempotencyKey: `${PROJECT_ID}-${Date.now()}`,
}, csrf, session);
if (!genRes.ok) {
  console.log("  ❌ 生成请求失败:", genRes.json?.error);
  process.exit(1);
}
const taskId = genRes.json.task?.id;
console.log(`  生成任务: ${taskId?.slice(0, 8)}... (LLM 需要输出新 PMBOK 元素，可能 1-3 分钟)`);

let genResult = await waitForGeneration(session, csrf, PROJECT_ID, taskId);

// Retry logic
let retryCount = 0;
while (genResult?.state === "failed_retryable" && retryCount < 3) {
  retryCount++;
  console.log(`  🔄 第 ${retryCount} 次重试...`);
  await new Promise(r => setTimeout(r, 3000));
  const retryRes = await api("POST", `/api/projects/${PROJECT_ID}/generation-tasks/${taskId}/retry`, {
    idempotencyKey: `${PROJECT_ID}-retry-${Date.now()}`,
  }, csrf, session);
  if (retryRes.ok) {
    genResult = await waitForGeneration(session, csrf, PROJECT_ID, retryRes.json.task?.id || taskId);
  }
}

if (genResult?.state !== "succeeded") {
  console.log(`  ❌ 生成失败: ${genResult?.state}`);
  if (genResult?.validation) console.log("  校验:", JSON.stringify(genResult.validation).slice(0, 300));
  process.exit(1);
}
console.log("  ✅ 生成成功！");

// 6. ★ 核心验证：检查提案中的 PMBOK 元素
console.log("\n" + "★".repeat(70));
console.log("[6] ★ 核心验证：检查 LLM 输出的 PMBOK 元素 ★");
console.log("★".repeat(70));

const propRes = await api("GET", `/api/projects/${PROJECT_ID}/change-proposals`, undefined, undefined, session);
const proposals = propRes.json?.items || [];
if (proposals.length === 0) {
  console.log("  ⛔ 无提案！");
  process.exit(1);
}

const proposal = proposals[0];
const proposalId = proposal.proposalId || proposal.id;
const changes = proposal.changes || [];
console.log(`\n提案 ${proposalId?.slice(0, 8)}... 共 ${changes.length} 条变更\n`);

// PMBOK 元素检测
const PMBOK_FIELDS = [
  { key: "objective", label: "目标/范围", level: "P0" },
  { key: "owner", label: "负责人", level: "P0" },
  { key: "stakeholders", label: "相关方", level: "P0" },
  { key: "startDate", label: "开始时间", level: "P0" },
  { key: "endDate", label: "结束时间", level: "P0" },
  { key: "state", label: "状态", level: "P0" },
  { key: "progress", label: "进度", level: "P0" },
  { key: "health", label: "健康度", level: "P0" },
  { key: "deliverables", label: "交付物", level: "P1" },
  { key: "risks", label: "任务级风险", level: "P1" },
  { key: "acceptanceCriteria", label: "验收标准", level: "P2" },
  { key: "decisions", label: "决策记录", level: "P2" },
];

const fieldStats = {};
PMBOK_FIELDS.forEach(f => { fieldStats[f.key] = { count: 0, label: f.label, level: f.level }; });

let taskNetworkCount = 0;
const taskChanges = [];

console.log("--- 每条变更详情 ---\n");
for (let i = 0; i < changes.length; i++) {
  const change = changes[i];
  const mod = change.module || change.change?.module;
  const op = change.operation || change.change?.operation;
  const patch = change.patch || change.change?.patch || {};
  
  console.log(`[${i + 1}] module=${mod} op=${op}`);
  
  if (mod === "task-network") {
    taskNetworkCount++;
    taskChanges.push({ index: i, patch });
    console.log(`    patch keys: ${Object.keys(patch).join(", ")}`);
    
    // 检查每个 PMBOK 字段
    const foundFields = [];
    for (const f of PMBOK_FIELDS) {
      if (patch[f.key] !== undefined && patch[f.key] !== null && patch[f.key] !== "") {
        fieldStats[f.key].count++;
        foundFields.push(`${f.key}=${JSON.stringify(patch[f.key]).slice(0, 60)}`);
      }
    }
    if (foundFields.length) {
      console.log(`    PMBOK 元素: ${foundFields.join(" | ")}`);
    }
    // 打印完整 patch（前 500 字符）
    console.log(`    full patch: ${JSON.stringify(patch).slice(0, 500)}`);
  } else {
    console.log(`    (非 task-network 模块，跳过 PMBOK 检查)`);
    if (Object.keys(patch).length) console.log(`    patch: ${JSON.stringify(patch).slice(0, 200)}`);
  }
  console.log("");
}

// 统计报告
console.log("\n" + "═".repeat(70));
console.log("PMBOK 元素提取统计报告");
console.log("═".repeat(70));
console.log(`task-network 变更数: ${taskNetworkCount}`);
console.log(`总变更数: ${changes.length}\n`);

console.log("字段提取情况:");
console.log("-".repeat(50));
const grouped = { P0: [], P1: [], P2: [] };
for (const f of PMBOK_FIELDS) {
  grouped[f.level].push({ ...f, count: fieldStats[f.key].count });
}
for (const level of ["P0", "P1", "P2"]) {
  console.log(`\n【${level}】${level === "P0" ? "必选" : level === "P1" ? "条件必选" : "可选增强"}`);
  for (const f of grouped[level]) {
    const pct = taskNetworkCount > 0 ? Math.round(f.count / taskNetworkCount * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    const status = f.count > 0 ? "✅" : "❌";
    console.log(`  ${status} ${f.label.padEnd(12)} (${f.key.padEnd(20)}) ${bar} ${f.count}/${taskNetworkCount} (${pct}%)`);
  }
}

// 7. 继续走完闭环（审核→合并→发布→验证路线图）
console.log("\n" + "═".repeat(70));
console.log("[7] 继续走完闭环...");
console.log("═".repeat(70));

// Accept all
const modules = [...new Set(changes.map(c => c.module || c.change?.module).filter(Boolean))];
console.log(`模块: ${modules.join(", ")}`);
for (const mod of modules) {
  await api("POST", `/api/projects/${PROJECT_ID}/change-proposals/${proposalId}/review/modules/${mod}`, undefined, csrf, session);
}
console.log("  ✅ 全部接受");

// Merge
console.log("\n[8] 合并...");
const mergeRes = await api("POST", `/api/projects/${PROJECT_ID}/change-proposals/${proposalId}/merge`, undefined, csrf, session);
console.log(`  ${mergeRes.ok ? "✅ 合并成功" : "❌ 合并失败: " + (mergeRes.json?.error || mergeRes.status)}`);

// Publish
console.log("\n[9] 发布...");
const previewRes = await api("GET", `/api/projects/${PROJECT_ID}/release/preview`, undefined, undefined, session);
const previewToken = previewRes.json?.previewToken;
const versionLabel = `v${Date.now().toString(36)}`;
const pubRes = await api("POST", `/api/projects/${PROJECT_ID}/release/publish`, {
  previewToken,
  versionLabel,
  acknowledged: true,
}, csrf, session);
console.log(`  ${pubRes.ok ? `✅ 发布成功 (${versionLabel})` : "❌ 发布失败: " + (pubRes.json?.error || pubRes.status)}`);

// Verify roadmap with PMBOK elements
console.log("\n[10] 验证已发布版本的 task-network 数据（含 PMBOK 元素）...");
const tnRes = await api("GET", `/api/projects/${PROJECT_ID}/public/modules/task-network`, undefined, undefined, session);
const tasks = tnRes.json?.data?.tasks || tnRes.json?.snapshot?.tasks || [];
console.log(`  已发布任务数: ${tasks.length}`);
if (tasks.length > 0) {
  console.log("\n  任务 PMBOK 元素验证:");
  for (const task of tasks.slice(0, 5)) {
    console.log(`  ── ${task.title}`);
    console.log(`     objective: ${task.objective ? "✅ " + String(task.objective).slice(0, 50) : "❌ 无"}`);
    console.log(`     owner: ${task.owner ? "✅ " + task.owner : "❌ 无"}`);
    console.log(`     health: ${task.health ? "✅ " + task.health : "❌ 无"}`);
    console.log(`     stakeholders: ${Array.isArray(task.stakeholders) && task.stakeholders.length ? "✅ " + task.stakeholders.length + " 个" : "❌ 无"}`);
    console.log(`     deliverables: ${Array.isArray(task.deliverables) && task.deliverables.length ? "✅ " + task.deliverables.length + " 个" : "❌ 无"}`);
    console.log(`     risks: ${Array.isArray(task.risks) && task.risks.length ? "✅ " + task.risks.length + " 个" : "❌ 无"}`);
  }
}

console.log("\n" + "═".repeat(70));
console.log("验证完成！");
console.log("═".repeat(70));
console.log(`\n查看看板效果: http://localhost:4173/projects/${PROJECT_ID}/modules/roadmap?view=board`);
