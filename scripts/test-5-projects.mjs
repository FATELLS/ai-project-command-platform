// 全流程闭环测试：5个项目 x 完整链路
// 创建项目 → 手动创建材料 → 选模板 → 启用生成 → AI生成 → 审核 → 合并 → 发布 → 验证路线图
import { readFileSync, readdirSync } from "fs";

const BASE = "http://127.0.0.1:4173";
const MATERIALS_DIR = "/Users/mingyuzhuo/Documents/AI Project Command Platform/mock-materials";

// ====== Helpers ======
async function api(method, path, body, csrf, session) {
  const headers = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const opts = {
    method,
    headers,
    headers: { ...headers },
  };
  if (session) opts.headers["Cookie"] = session;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json, ok: res.ok };
}

function extractSession(setCookie) {
  if (!setCookie) return "";
  const match = String(setCookie).match(/platform_session=([^;]+)/);
  return match ? `platform_session=${match[1]}` : "";
}

async function waitForMaterial(session, csrf, projectId, materialId, maxWait = 30) {
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
    if (state === "succeeded" || state === "failed" || state === "failed_terminal" || state === "failed_retryable") return r.json.task;
    if (i % 10 === 0 && i > 0) console.log(`    ... 等待中 (${i}s) state=${state}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

// ====== Main ======
async function main() {
  // 1. Login
  console.log("=== 登录 ===");
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginName: "admin", password: "admin12345678" }),
  });
  const loginData = await loginRes.json();
  const csrf = loginData.csrfToken;
  const session = extractSession(loginRes.headers.get("set-cookie"));
  console.log("CSRF:", csrf?.slice(0, 16) + "...");
  console.log("Session:", session?.slice(0, 30) + "...");

  const projectConfigs = [
    {
      id: "sales-demo",
      name: "大客户销售战役模拟",
      templateId: "campaign-map-v1",
      dir: "sales",
      materialTemplate: "meeting-notes",
      versionLabel: "v1.0",
    },
    {
      id: "rd-demo",
      name: "推荐引擎2.0研发项目",
      templateId: "campaign-map-v1",
      dir: "rd",
      materialTemplate: "meeting-notes",
      versionLabel: "v1.0",
    },
    {
      id: "admin-demo",
      name: "组织效能提升变革项目",
      templateId: "campaign-map-v1",
      dir: "admin",
      materialTemplate: "meeting-notes",
      versionLabel: "v1.0",
    },
    {
      id: "market-demo",
      name: "东南亚市场进入战略",
      templateId: "campaign-map-v1",
      dir: "market",
      materialTemplate: "meeting-notes",
      versionLabel: "v1.0",
    },
    {
      id: "infra-demo",
      name: "混合云架构迁移项目",
      templateId: "campaign-map-v1",
      dir: "infra",
      materialTemplate: "meeting-notes",
      versionLabel: "v1.0",
    },
  ];

  const results = [];

  for (const config of projectConfigs) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`处理项目: ${config.name} (${config.id})`);
    console.log(`${"=".repeat(70)}`);

    const result = { name: config.name, id: config.id, steps: {} };

    try {
      // Step 1: Create project
      console.log("\n[1/8] 创建项目...");
      const createRes = await api("POST", "/api/projects", {
        id: config.id,
        name: config.name,
        templateId: config.templateId,
      }, csrf, session);
      if (createRes.ok) {
        console.log("  ✅ 项目创建成功");
        result.steps.create = "PASS";
      } else {
        // 可能已存在
        if (createRes.json?.code === "PROJECT_EXISTS") {
          console.log("  ⚠️ 项目已存在，继续使用");
          result.steps.create = "EXISTS";
        } else {
          console.log("  ❌ 创建失败:", createRes.json?.error || createRes.json?.message);
          result.steps.create = "FAIL";
          results.push(result);
          continue;
        }
      }

      // Step 2: Create materials (manual) — skip if already exists
      console.log("\n[2/8] 创建材料...");
      const files = readdirSync(`${MATERIALS_DIR}/${config.dir}`).filter(f => f.endsWith(".md"));
      const materialIds = [];
      let existingCount = 0;
      for (const file of files) {
        const content = readFileSync(`${MATERIALS_DIR}/${config.dir}/${file}`, "utf8");
        const title = file.replace(/^\d+-/, "").replace(/\.md$/, "");
        const matRes = await api("POST", `/api/projects/${config.id}/materials/manual`, {
          title,
          body: content,
          updateTemplateId: config.materialTemplate,
          updateTemplateVersion: "1.0.0",
        }, csrf, session);
        if (matRes.ok) {
          const mid = matRes.json.material.id;
          materialIds.push(mid);
          console.log(`  ✅ ${title} (${mid.slice(0, 8)}...)`);
        } else if (matRes.json?.code === "DUPLICATE_MATERIAL" || matRes.json?.error?.includes("已归档")) {
          existingCount++;
          console.log(`  ⏭️ ${title} (已存在)`);
        } else {
          console.log(`  ❌ ${title}:`, matRes.json?.error || matRes.status);
        }
      }
      // If materials already exist, fetch them from the materials list
      if (materialIds.length === 0 && existingCount > 0) {
        console.log("  📋 从已有材料列表获取...");
        const listRes = await api("GET", `/api/projects/${config.id}/materials`, undefined, undefined, session);
        const existingMaterials = listRes.json?.materials || listRes.json?.items || [];
        for (const m of existingMaterials) {
          if (m.status === "ready") {
            materialIds.push(m.id);
            console.log(`  📋 ${m.name || m.title} (${m.id.slice(0, 8)}...)`);
          }
        }
      }
      result.steps.materials = materialIds.length > 0 ? "PASS" : "FAIL";
      result.materialCount = materialIds.length;

      if (materialIds.length === 0) {
        console.log("  ⛔ 无材料，跳过");
        results.push(result);
        continue;
      }

      // Step 3: Ensure materials are ready + Enable generation (skip if already ready)
      console.log("\n[3/8] 确认材料就绪...");
      let readyCount = 0;
      for (const mid of materialIds) {
        // Check current status first
        const matInfo = await api("GET", `/api/projects/${config.id}/materials/${mid}`, undefined, undefined, session);
        let status = matInfo.json?.material?.status;
        if (status !== "ready") {
          const ready = await waitForMaterial(session, csrf, config.id, mid);
          if (ready) status = "ready";
        }
        if (status === "ready") {
          readyCount++;
          // Enable generation for each material (idempotent)
          await api("PATCH", `/api/projects/${config.id}/materials/${mid}/generation`, { enabled: true }, csrf, session);
        } else {
          console.log(`  ⚠️ 材料 ${mid.slice(0, 8)} 未就绪 (${status})`);
        }
      }
      console.log(`  ${readyCount}/${materialIds.length} 材料就绪`);
      result.steps.ready = readyCount > 0 ? "PASS" : "FAIL";

      if (readyCount === 0) {
        results.push(result);
        continue;
      }

      // Step 4: Get capabilities + Generate proposals
      console.log("\n[4/8] AI 生成提案...");

      // Check if there's already a successful proposal
      const existingPropRes = await api("GET", `/api/projects/${config.id}/change-proposals`, undefined, undefined, session);
      const existingProposals = existingPropRes.json?.items || [];
      const pendingProposal = existingProposals.find(p => p.status === "pending");

      if (pendingProposal) {
        const propId = pendingProposal.proposalId || pendingProposal.id;
        const changeCount = (pendingProposal.changes || []).length;
        console.log(`  ⏭️ 已有提案 (${propId?.slice(0, 8)}... ${changeCount} 条变更), 跳过生成`);
        result.steps.generate = "PASS";
      } else {
        const capRes = await api("GET", `/api/projects/${config.id}/generation-tasks/capabilities`, undefined, undefined, session);
        const baseVersionId = capRes.json?.baseVersionId;
        const eligibleMaterials = capRes.json?.eligibleMaterials || [];
        console.log(`  baseVersionId: ${baseVersionId}`);
        console.log(`  eligibleMaterials: ${eligibleMaterials.length}`);

        if (eligibleMaterials.length === 0 || !baseVersionId) {
          console.log("  ⛔ 无可用材料或版本，跳过生成");
          result.steps.generate = "SKIP";
          results.push(result);
          continue;
        }

        // Use first eligible material
        const firstMat = eligibleMaterials[0];
        const genRes = await api("POST", `/api/projects/${config.id}/generation-tasks`, {
          materialIds: [firstMat.id],
          baseVersionId,
          idempotencyKey: `${config.id}-${Date.now()}`,
        }, csrf, session);
        if (!genRes.ok) {
          console.log("  ❌ 生成失败:", genRes.json?.error || genRes.status);
          result.steps.generate = "FAIL";
          results.push(result);
          continue;
        }
        const taskId = genRes.json.task?.id;
        console.log(`  生成任务: ${taskId?.slice(0, 8)}...`);
        let genResult = await waitForGeneration(session, csrf, config.id, taskId);

        // Retry up to 3 times if failed_retryable (LLM provider may be intermittently unstable)
        let retryCount = 0;
        while (genResult?.state === "failed_retryable" && retryCount < 3) {
          retryCount++;
          console.log(`  🔄 第 ${retryCount} 次重试（LLM 网络可能不稳定）...`);
          await new Promise(r => setTimeout(r, 3000)); // wait 3s between retries
          const retryRes = await api("POST", `/api/projects/${config.id}/generation-tasks/${taskId}/retry`, {
            idempotencyKey: `${config.id}-retry-${Date.now()}`,
          }, csrf, session);
          if (retryRes.ok) {
            const retryTaskId = retryRes.json.task?.id || taskId;
            genResult = await waitForGeneration(session, csrf, config.id, retryTaskId);
          } else {
            console.log(`  ⚠️ 重试请求失败:`, retryRes.json?.error || retryRes.status);
            break;
          }
        }

        if (genResult?.state === "succeeded") {
          console.log("  ✅ 生成成功");
          result.steps.generate = "PASS";
        } else {
          console.log("  ❌ 生成失败/超时:", genResult?.state || "TIMEOUT");
          result.steps.generate = "FAIL";
          if (genResult?.validation) console.log("  校验:", JSON.stringify(genResult.validation).slice(0, 200));
          results.push(result);
          continue;
        }
      }

      // Step 5: Review proposals
      console.log("\n[5/8] 审核提案...");
      const propRes = await api("GET", `/api/projects/${config.id}/change-proposals`, undefined, undefined, session);
      const proposals = propRes.json?.items || [];
      if (proposals.length === 0) {
        console.log("  ⛔ 无提案");
        result.steps.review = "FAIL";
        results.push(result);
        continue;
      }
      const proposal = proposals[0];
      const proposalId = proposal.proposalId || proposal.id;
      const changes = proposal.changes || [];
      console.log(`  提案: ${proposalId?.slice(0, 8)}... (${changes.length} 条变更)`);

      // Get review view to see all changes
      const reviewRes = await api("GET", `/api/projects/${config.id}/change-proposals/${proposalId}/review`, undefined, undefined, session);
      const reviewItems = reviewRes.json?.proposal?.changes || reviewRes.json?.items || [];
      const modules = [...new Set(reviewItems.map(i => i.module || i.change?.module).filter(Boolean))];
      console.log(`  模块: ${modules.join(", ")}`);

      // Accept all changes per module
      let acceptedCount = 0;
      for (const mod of modules) {
        const acceptRes = await api("POST", `/api/projects/${config.id}/change-proposals/${proposalId}/review/modules/${mod}`, undefined, csrf, session);
        if (acceptRes.ok) {
          const modItems = reviewItems.filter(i => (i.module || i.change?.module) === mod);
          acceptedCount += modItems.length;
          console.log(`  ✅ 接受 ${mod} (${modItems.length} 条)`);
        } else {
          console.log(`  ⚠️ ${mod} 接受失败:`, acceptRes.json?.error);
        }
      }
      result.steps.review = acceptedCount > 0 ? "PASS" : "FAIL";
      result.acceptedChanges = acceptedCount;

      if (acceptedCount === 0) {
        results.push(result);
        continue;
      }

      // Step 6: Merge to draft
      console.log("\n[6/8] 合并到草稿...");
      const mergeRes = await api("POST", `/api/projects/${config.id}/change-proposals/${proposalId}/merge`, undefined, csrf, session);
      if (mergeRes.ok) {
        console.log("  ✅ 合并成功");
        result.steps.merge = "PASS";
      } else {
        console.log("  ❌ 合并失败:", mergeRes.json?.error || mergeRes.status);
        result.steps.merge = "FAIL";
        results.push(result);
        continue;
      }

      // Step 7: Publish
      console.log("\n[7/8] 发布...");
      const previewRes = await api("GET", `/api/projects/${config.id}/release/preview`, undefined, undefined, session);
      const previewToken = previewRes.json?.previewToken;
      if (!previewToken) {
        console.log("  ❌ 无 previewToken");
        result.steps.publish = "FAIL";
        results.push(result);
        continue;
      }
      // Use unique version label (with timestamp to avoid conflicts)
      const versionLabel = `v${Date.now().toString(36)}`;
      const pubRes = await api("POST", `/api/projects/${config.id}/release/publish`, {
        previewToken,
        versionLabel,
        acknowledged: true,
      }, csrf, session);
      if (pubRes.ok) {
        console.log(`  ✅ 发布成功 (${versionLabel})`);
        result.steps.publish = "PASS";
      } else {
        console.log("  ❌ 发布失败:", pubRes.json?.error || pubRes.status);
        result.steps.publish = "FAIL";
        results.push(result);
        continue;
      }

      // Step 8: Verify roadmap
      console.log("\n[8/8] 验证路线图...");
      const rmRes = await api("GET", `/api/projects/${config.id}/public/modules/roadmap`, undefined, undefined, session);
      const stages = rmRes.json?.data?.stages || [];
      const tasks = rmRes.json?.data?.tasks || [];
      if (stages.length > 0) {
        console.log(`  ✅ 路线图有内容: ${stages.length} 阶段, ${tasks.length} 任务`);
        result.steps.roadmap = "PASS";
        result.stageCount = stages.length;
        result.taskCount = tasks.length;
        result.stageTitles = stages.map(s => s.title).join(" → ");
      } else {
        console.log("  ❌ 路线图为空");
        result.steps.roadmap = "FAIL";
      }

      // Also check gantt
      const ganttRes = await api("GET", `/api/projects/${config.id}/public/modules/gantt`, undefined, undefined, session);
      const ganttTasks = ganttRes.json?.data?.tasks || [];
      if (ganttTasks.length > 0) {
        console.log(`  ✅ 甘特图: ${ganttTasks.length} 任务`);
      }

    } catch (err) {
      console.log(`  💥 异常: ${err.message}`);
      result.steps.error = err.message;
    }

    results.push(result);
  }

  // ====== Summary ======
  console.log(`\n${"=".repeat(70)}`);
  console.log("总结报告");
  console.log(`${"=".repeat(70)}`);
  console.log("项目\t\t\t创建\t材料\t就绪\t生成\t审核\t合并\t发布\t路线图");
  console.log("-".repeat(90));
  for (const r of results) {
    const s = r.steps;
    const fmt = v => v === "PASS" ? "✅" : v === "FAIL" ? "❌" : v === "EXISTS" ? "⚠️" : v === "SKIP" ? "⏭️" : "—";
    console.log(`${r.id.padEnd(16)}\t${fmt(s.create)}\t${fmt(s.materials)}\t${fmt(s.ready)}\t${fmt(s.generate)}\t${fmt(s.review)}\t${fmt(s.merge)}\t${fmt(s.publish)}\t${fmt(s.roadmap)}`);
  }
  console.log("-".repeat(90));

  let allPass = true;
  for (const r of results) {
    const steps = Object.values(r.steps);
    if (steps.some(s => s === "FAIL")) allPass = false;
  }
  console.log(allPass ? "\n🎉 全部项目闭环成功！" : "\n⚠️ 部分项目未完全闭环，请检查上方详情。");

  // Detailed results
  for (const r of results) {
    if (r.stageTitles) {
      console.log(`\n${r.name}:`);
      console.log(`  路线: ${r.stageTitles}`);
      console.log(`  任务: ${r.taskCount}, 变更: ${r.acceptedChanges}`);
    }
  }
}

main().catch(console.error);
