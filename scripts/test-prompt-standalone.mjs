// 独立提示词测试：跳过整个 proposal pipeline，只验证 prompt-builder.mjs 的提示词能否驱动 LLM 输出符合契约且含 PMBOK 元素的结果。
// 用法：node scripts/test-prompt-standalone.mjs

import { buildGenerationPrompt } from "../src/proposals/prompt-builder.mjs";
import { getProposalTemplate } from "../src/proposals/catalog.mjs";

const API_URL = "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions";
const API_KEY = process.env.AI_GENERATION_API_KEY
  || "c594a0d01354421d918839109370cb03.uWAQel4YIgYiaQ88";
const MODEL = "glm-5.2";

// ====== 模拟一份会议纪要 evidence ======
const meetingNotes = `
2026年7月14日 产品周会纪要

参会人：张明（产品负责人）、李华（前端开发）、王芳（后端开发）、赵强（测试）

一、本周进展回顾
1. 推荐算法 v2 设计：张明负责，目前已完成需求文档（done），原型设计进行中（doing），进度 60%。目标是在 7 月 25 日前完成完整设计文档交付研发评审。当前 on-track，暂无阻塞。
2. 用户画像模块重构：李华负责前端，王芳负责后端。当前 at-risk——第三方数据接口未就绪（high 风险），导致后端 mock 无法替换。前端进度 70%，后端进度 40%。截止日期 8 月 10 日。
3. 性能优化专项：赵强主导，已完成首轮压测（done），发现 P99 延迟 800ms，超过 500ms 目标。决策：采用 CDN 缓存方案，张明拍板。

二、下周计划
1. 推荐算法 v2 设计进入评审（review 状态）。
2. 用户画像：李华继续做前端组件，王芳跟进第三方接口（预计 7 月 18 日就绪）。
3. 新任务：登录流程改版，张明负责，7 月 20 日启动，8 月 5 日截止，目标提升登录转化率。

三、待办
- 张明：7 月 16 日前确认推荐算法的验收标准。
- 赵强：7 月 17 日前输出压测报告 v2。
`;

// ====== 构建 context（模拟空项目首次注入） ======
const template = getProposalTemplate("meeting-notes");
const context = {
  projectId: "test-standalone-001",
  baseVersionId: 1,
  baseVersionLabel: "v1",
  templateId: "meeting-notes",
  templateVersion: "1.0.0",
  materials: [{ id: "mat-001", readiness: "ready" }],
  published: { overview: {}, units: [], roadmap: [], tasks: [], risks: [], outcomes: [], metrics: [] },
  evidence: [{
    evidenceId: "ev-001",
    materialId: "mat-001",
    materialName: "2026-07-14 产品周会纪要.txt",
    kind: "text",
    location: "full",
    text: meetingNotes
  }]
};

const { messages, responseFormat } = buildGenerationPrompt(context, template);

console.log("=== 提示词构建完成 ===");
console.log(`System prompt 长度: ${messages[0].content.length} 字符`);
console.log(`User payload 长度: ${messages[1].content.length} 字符`);
console.log(`Response format: ${JSON.stringify(responseFormat)}`);
console.log("");

// ====== 直接调 LLM ======
console.log("=== 调用 LLM (glm-5.2) ===");
console.log(`Endpoint: ${API_URL}`);
console.log(`Model: ${MODEL}`);
console.log("参数: temperature=0.1, max_tokens=8000, reasoning_effort=none, response_format=json_object");
console.log("");

const requestBody = {
  model: MODEL,
  messages,
  temperature: 0.1,
  max_tokens: 8000,
  stream: false,
  response_format: responseFormat,
  reasoning_effort: "none"
};

const startTime = Date.now();

try {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`HTTP 状态: ${response.status} | 耗时: ${elapsed}s`);

  const body = await response.text();

  if (!response.ok) {
    console.log("=== 请求失败 ===");
    console.log(body.slice(0, 2000));
    process.exit(1);
  }

  const payload = JSON.parse(body);
  const choice = payload.choices[0];

  console.log("");
  console.log("=== LLM 响应元信息 ===");
  console.log(`finish_reason: ${choice.finish_reason}`);
  console.log(`content 长度: ${choice.message?.content?.length ?? 0} 字符`);
  console.log(`token usage: input=${payload.usage?.prompt_tokens}, output=${payload.usage?.completion_tokens}, total=${payload.usage?.total_tokens}`);
  console.log(`reasoning_tokens: ${payload.usage?.completion_tokens_details?.reasoning_tokens ?? "N/A"}`);

  if (choice.finish_reason !== "stop") {
    console.log("");
    console.log("⚠️ finish_reason 不是 stop，可能被截断！");
    console.log(`reason: ${choice.finish_reason}`);
  }

  // ====== 解析输出 ======
  console.log("");
  console.log("=== 解析 LLM 输出 ===");

  let output;
  try {
    output = JSON.parse(choice.message.content);
  } catch (parseErr) {
    console.log("❌ JSON 解析失败！");
    console.log(parseErr.message);
    console.log("");
    console.log("=== 原始内容（前 3000 字符）===");
    console.log(choice.message.content.slice(0, 3000));
    process.exit(1);
  }

  console.log(`schemaVersion: ${output.schemaVersion}`);
  console.log(`projectId: ${output.projectId}`);
  console.log(`changes 数量: ${output.changes?.length ?? 0}`);
  console.log(`warnings: ${JSON.stringify(output.warnings)}`);
  console.log(`summary: ${(output.summary ?? "").slice(0, 200)}...`);
  console.log("");

  // ====== 分析 PMBOK 元素提取率 ======
  console.log("=== PMBOK 元素提取分析 ===");

  const taskChanges = (output.changes || []).filter(c => c.module === "task-network");
  console.log(`task-network 变更数: ${taskChanges.length}`);
  console.log("");

  const p0Fields = ["title", "objective", "owner", "stakeholders", "startDate", "endDate", "state", "progress", "health"];
  const p1Fields = ["deliverables", "risks"];
  const p2Fields = ["acceptanceCriteria", "decisions"];

  function countFilled(patch, field) {
    const val = patch?.[field];
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }

  taskChanges.forEach((change, i) => {
    const patch = change.patch || {};
    const op = change.operation;
    const tid = change.targetId;
    console.log(`--- Task ${i + 1}: [${op}] ${tid} ---`);

    // P0
    const p0Hit = p0Fields.filter(f => countFilled(patch, f));
    const p0Miss = p0Fields.filter(f => !countFilled(patch, f));
    console.log(`  P0 (${p0Hit.length}/${p0Fields.length}): ${p0Hit.join(", ") || "(无)"}`);
    if (p0Miss.length) console.log(`  P0 缺失: ${p0Miss.join(", ")}`);

    // P1
    const p1Hit = p1Fields.filter(f => countFilled(patch, f));
    if (p1Hit.length) {
      p1Hit.forEach(f => {
        const v = patch[f];
        console.log(`  P1 ✓ ${f}: ${JSON.stringify(v).slice(0, 120)}`);
      });
    }

    // P2
    const p2Hit = p2Fields.filter(f => countFilled(patch, f));
    if (p2Hit.length) {
      p2Hit.forEach(f => {
        const v = patch[f];
        console.log(`  P2 ✓ ${f}: ${JSON.stringify(v).slice(0, 120)}`);
      });
    }

    // health 值校验
    if (patch.health && !["on-track", "at-risk", "off-track"].includes(patch.health)) {
      console.log(`  ⚠️ health 值非法: ${patch.health}`);
    }
    // state 值校验
    if (patch.state && !["todo", "doing", "review", "done"].includes(patch.state)) {
      console.log(`  ⚠️ state 值非法: ${patch.state}`);
    }

    console.log("");
  });

  // 汇总
  console.log("=== 提取率汇总 ===");
  const allPatches = taskChanges.map(c => c.patch || {});
  p0Fields.forEach(f => {
    const hit = allPatches.filter(p => countFilled(p, f)).length;
    console.log(`  P0 ${f}: ${hit}/${allPatches.length} (${allPatches.length ? Math.round(hit / allPatches.length * 100) : 0}%)`);
  });
  p1Fields.forEach(f => {
    const hit = allPatches.filter(p => countFilled(p, f)).length;
    console.log(`  P1 ${f}: ${hit}/${allPatches.length} (${allPatches.length ? Math.round(hit / allPatches.length * 100) : 0}%)`);
  });
  p2Fields.forEach(f => {
    const hit = allPatches.filter(p => countFilled(p, f)).length;
    console.log(`  P2 ${f}: ${hit}/${allPatches.length} (${allPatches.length ? Math.round(hit / allPatches.length * 100) : 0}%)`);
  });

  // 其他 module
  const otherModules = (output.changes || []).filter(c => c.module !== "task-network");
  if (otherModules.length) {
    console.log("");
    console.log("=== 其他 module 变更 ===");
    const byModule = {};
    otherModules.forEach(c => { byModule[c.module] = (byModule[c.module] || 0) + 1; });
    Object.entries(byModule).forEach(([m, n]) => console.log(`  ${m}: ${n} 条`));
  }

  console.log("");
  console.log("=== 测试完成 ===");

} catch (err) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`=== 异常 (${elapsed}s) ===`);
  console.error(err);
  process.exit(1);
}
