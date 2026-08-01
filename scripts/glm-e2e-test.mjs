#!/usr/bin/env node
/**
 * GLM 全流程 E2E 测试
 * 在一个 node 进程里完成：启动服务 → 登录 → 上传材料 → 生成 → 报告结果
 */
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

const BASE = "http://127.0.0.1:4173";
const PROJ_ID = "rd-glm-e2e";
const MAT_DIR = "/Users/mingyuzhuo/Documents/AI Project Command Platform/mock-materials/rd";
const DEV_DIR = "/Users/mingyuzhuo/Documents/AI Project Command Platform";
const TEST_DATA_DIR = "/tmp/glm-e2e-data";  // 独立数据目录避免本地数据干扰

let cookie = "";
let csrf = "";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, body) {
  const url = new URL(BASE + path);
  const headers = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  if (cookie) headers["cookie"] = cookie;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  // 保存 cookie
  const setCookie = resp.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return resp.json();
}

async function uploadFile(filepath, projectId) {
  const fname = filepath.split("/").pop();
  const data = readFileSync(filepath);
  const url = new URL(`${BASE}/api/projects/${projectId}/materials/upload`);
  // 按扩展名映射 content-type
  const ext = extname(filepath).toLowerCase();
  const mimeMap = {
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".json": "application/json",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
  };
  const mime = mimeMap[ext] || "application/octet-stream";
  const headers = {
    "content-type": mime,
    "x-file-name": encodeURIComponent(fname),
  };
  if (csrf) headers["x-csrf-token"] = csrf;
  if (cookie) headers["cookie"] = cookie;

  const resp = await fetch(url, { method: "POST", headers, body: data });
  // 保存 cookie
  const setCookie = resp.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return resp.json();
}

async function waitForState(jobId, maxIter = 36) {
  for (let i = 0; i < maxIter; i++) {
    await sleep(5000);
    const r = await api("GET", `/api/projects/${PROJ_ID}/generation-tasks/${jobId}`);
    const state = r.task?.state || "";
    console.log(`  [${(i+1)*5}s] ${state}`);
    if (["completed", "succeeded", "failed_terminal", "failed_retryable"].includes(state)) return r;
  }
  return null;
}

// ===== main =====
console.log("=".repeat(60));
console.log("  GLM 全流程 E2E 测试（Node.js 单进程）");
console.log("=".repeat(60));

// 1. 启动服务
console.log("\n=== 1. 启动服务（独立数据目录）===");
import { mkdirSync, rmSync } from "node:fs";
rmSync(TEST_DATA_DIR, { recursive: true, force: true });
mkdirSync(TEST_DATA_DIR, { recursive: true });

const server = spawn("node", ["--env-file=.env.local", "server.mjs"], {
  cwd: DEV_DIR,
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    PLATFORM_DATA_DIR: TEST_DATA_DIR,
    PLATFORM_BOOTSTRAP_PASSWORD: "", // 使用默认 admin123
  },
});
server.stdout.on("data", d => process.stdout.write(d));
server.stderr.on("data", d => process.stderr.write(d));

// 等服务启动
for (let i = 0; i < 15; i++) {
  await sleep(1000);
  try {
    const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(1000) });
    if (r.ok) { console.log(`✅ ${i+1}s 启动`); break; }
  } catch {}
}

// 2. 登录
console.log("\n=== 2. 登录 ===");
const loginResp = await api("POST", "/api/login", { loginName: "admin", password: "admin123" });
if (!loginResp.csrfToken) {
  console.log("admin123 失败，尝试 Mingyuzhuo123...");
  cookie = "";
  const r2 = await api("POST", "/api/login", { loginName: "admin", password: "Mingyuzhuo123" });
  if (!r2.csrfToken) {
    console.log("登录都失败:", JSON.stringify(r2));
    server.kill();
    process.exit(1);
  }
  csrf = r2.csrfToken;
  console.log(`✅ 登录(Mingyuzhuo123): CSRF=${csrf.slice(0,15)}...`);
} else {
  csrf = loginResp.csrfToken;
  console.log(`✅ 登录: CSRF=${csrf.slice(0,15)}...`);
}

// 3. AI 配置状态
console.log("\n=== 3. AI 配置 ===");
const settings = await api("GET", "/api/settings");
const gen = settings.aiGeneration || {};
console.log(`Gen: provider=${gen.provider} model=${gen.model} hosts=${gen.allowedHosts} key=${!!(gen.hasApiKey || gen.apiKey)}`);

// 4. 创建项目
console.log("\n=== 4. 创建项目 ===");
const proj = await api("POST", "/api/projects", {
  id: PROJ_ID,
  name: "研发-智能交通GLM-E2E",
  description: "GLM 全流程测试",
  templateId: "standard-project-v1"
});
if (proj.project) console.log(`✅ ${proj.project.id}`);
else console.log(`⚠️ ${proj.error}`);

// 5. 上传材料
console.log("\n=== 5. 上传材料 ===");
const files = readdirSync(MAT_DIR).filter(f => statSync(join(MAT_DIR, f)).isFile()).sort();
const matIds = [];
for (const fname of files) {
  const fpath = join(MAT_DIR, fname);
  process.stdout.write(`  ${fname}...`);
  const r = await uploadFile(fpath, PROJ_ID);
  const mid = r.material?.id || "";
  if (mid) {
    console.log(` ✅ ${mid.slice(0,8)} status=${r.material.status}`);
    matIds.push(mid);
  } else {
    console.log(` ❌ ${JSON.stringify(r).slice(0, 80)}`);
  }
}
console.log(`共 ${matIds.length} 份`);

// 6. 等处理
console.log("\n=== 6. 等待处理 (6s) ===");
await sleep(6000);

// 7. 检查 readiness
console.log("\n=== 7. Readiness ===");
const readyIds = [];
for (const mid of matIds) {
  const r = await api("GET", `/api/projects/${PROJ_ID}/materials/${mid}`);
  const mat = r.material || {};
  const rd = mat.readiness || {};
  const status = rd.status;
  const missing = (rd.missing || []).map(m => m.label);
  if (status === "ready") {
    console.log(`  ✅ ${mat.name}`);
    readyIds.push(mid);
  } else {
    console.log(`  ⚠️ ${mat.name}: ${status} 缺${missing}`);
  }
}
console.log(`就绪: ${readyIds.length}/${matIds.length}`);

if (readyIds.length === 0) {
  console.log("\n❌ 无就绪材料");
  server.kill();
  process.exit(1);
}

// 8. 生成任务
console.log("\n=== 8. 创建生成任务（真实 GLM-5.2）===");
const idem = randomUUID();
const genResp = await api("POST", `/api/projects/${PROJ_ID}/generation-tasks`, {
  materialIds: readyIds,
  idempotencyKey: idem
});
const jobId = genResp.task?.id || "";
console.log(`任务: ${jobId}`);
console.log(`初始: state=${genResp.task?.state} code=${genResp.task?.errorCode || ""}`);
console.log(`开始: ${new Date().toTimeString().slice(0,8)}`);

// 9. 等待结果
console.log("\n=== 9. 等待 GLM 生成 ===");
const result = await waitForState(jobId);

// 10. 输出结果
console.log("\n" + "=".repeat(60));
console.log("  最终结果");
console.log("=".repeat(60));

if (result?.task) {
  const t = result.task;
  console.log(`状态: ${t.state}`);
  console.log(`错误码: ${t.errorCode || "(无)"}`);
  console.log(`proposalId: ${t.proposalId || "(无)"}`);
  for (const a of (t.attempts || [])) {
    console.log(`  #${a.attemptNumber}: ${a.outcome} | ${a.resultCode} | ${a.providerLabel} | ${a.latencyMs}ms | in=${a.inputTokens} out=${a.outputTokens}`);
  }
  console.log();
  if (t.state === "completed" || t.state === "succeeded") console.log("🎉 成功！GLM 全流程正常！");
  else if (t.state === "failed_terminal") console.log(`❌ 失败: ${t.errorCode}`);
  else if (t.state === "failed_retryable") console.log(`⚠️ 可重试: ${t.errorCode}`);
  else console.log(`⏳ ${t.state}`);
} else {
  console.log("❌ 超时无结果");
}

console.log(`\n完成: ${new Date().toTimeString().slice(0,8)}`);
server.kill();
