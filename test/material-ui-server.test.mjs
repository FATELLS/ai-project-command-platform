import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const renderers = readFileSync(new URL("../public/modules/renderers.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = `${html}\n${app}\n${renderers}`;

test("materials use canonical project-scoped ledger, detail, evidence and chat APIs", () => {
  for (const contract of [
    "/materials", "/capabilities", "/manual", "/upload", "/update-template", "/qa", "/retry", "/evidence", "/chat", "/quota"
  ]) assert.match(renderers, new RegExp(contract.replace("/", "\\/")));
  assert.match(app, /rawBody/);
  assert.match(renderers, /"x-file-name": encodeURIComponent\(file\.name\)/);
  assert.match(renderers, /method: "(?:POST|PATCH)", mutation: true/);
  assert.match(app, /modules\\\/materials\\\/\(\[a-zA-Z0-9\]/);
  assert.match(app, /materialId, generationTaskId: materialRoute\.generationTaskId/);
});

test("campaign and standard workspaces share a fixed renderer with resolved terminology", () => {
  for (const copy of [
    "BATTLE MATERIAL INTAKE", "PROJECT MATERIAL INTAKE", "上传作战材料", "上传项目材料",
    "战情问答", "项目问答", "作战参谋", "项目助手", "尚未归档项目材料"
  ]) assert.match(renderers, new RegExp(copy));
  assert.match(renderers, /context\.presentation\.kind === "campaign"/);
  assert.doesNotMatch(renderers, /xugu-agentic-group|XUGU AGENTIC/);
  assert.doesNotMatch(renderers, /project\.name\s*===/);
});

test("ledger exposes server-authoritative quotas, gates, persistent states and role-gated actions", () => {
  for (const copy of [
    "材料总数", "证据已就绪", "已授权问答", "存储用量", "项目配额", "剩余问答",
    "门阀校验中", "等待上传", "上传中", "预处理中", "需人工确认", "处理失败",
    "文件内容与扩展名不一致", "不支持此文件类型", "项目材料配额已用完", "相同内容已归档",
    "上传过于频繁", "已有材料正在上传或预处理", "文件展开后超过安全限制"
  ]) assert.match(renderers, new RegExp(copy));
  for (const flag of ["caps.upload", "caps.manual", "caps.retry", "caps.selectUpdateTemplate", "caps.manageQa"]) assert.match(renderers, new RegExp(flag.replace(".", "\\.")));
  assert.match(renderers, /ledger\.limits/);
  assert.match(renderers, /ledger\.usage/);
  assert.doesNotMatch(renderers, /200\s*\*\s*1024|300\s*\*\s*1024|maxMaterials\s*:\s*100/);
});

test("intake sheets are accessible, bounded and preserve the proposal-only boundary", () => {
  for (const copy of [
    "选择文件", "选择或拖入文件到当前项目", "松开以上传到当前项目", "更新模板", "材料备注",
    "填写人工材料", "来源 / 发生日期", "贡献人", "正文（纯文本）", "归档人工材料",
    "材料归档后可按版本化模板生成带来源的结构化提案；不会直接修改项目草稿或发布版本。",
    "开始上传", "正在上传…", "关闭上传面板"
  ]) assert.match(renderers, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(renderers, /role: "dialog", ariaModal: "true"/);
  assert.match(renderers, /event\.key === "Escape"/);
  assert.match(renderers, /event\.key !== "Tab"/);
  assert.match(renderers, /maxLength: 500/);
  assert.match(renderers, /maxLength: 1000/);
  assert.doesNotMatch(renderers, /merge-draft|publish-version|model selector|prompt editor/i);
});

test("detail and Q&A preserve exact evidence locators, citations and honest refusal states", () => {
  for (const copy of [
    "返回材料台账", "选择证据位置", "证据块", "未提供精确区域", "查看提取文本",
    "第 ", "张幻灯片", "工作表", "材料不存在或你无权访问", "更新模板已记录",
    "只读取当前项目已发布状态和已授权材料；回答不会修改项目数据。", "引用来源",
    "现有资料不足以回答这个问题。", "暂无可用于问答的授权材料", "发送问题",
    "正在查找依据…", "暂时无法完成项目问答。已保留你的问题，请稍后重试。"
  ]) assert.match(renderers, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(renderers, /\?evidence=\$\{encodeURIComponent\(citation\.evidenceId\)\}/);
  assert.match(renderers, /event\.ctrlKey \|\| event\.metaKey/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
});

test("safe DOM and responsive CSS cover the accepted desktop, tablet and mobile workspace", () => {
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML|document\.write|eval\(|new Function|javascript:/);
  assert.doesNotMatch(source, /https?:\/\//);
  for (const contract of [
    /\.material-summary-grid/, /\.material-table/, /\.material-sheet\s*\{[^}]*width:\s*min\(640px,100%\)/,
    /\.evidence-layout\s*\{[^}]*grid-template-columns:\s*300px minmax\(0,1fr\)/,
    /\.qa-layout\s*\{[^}]*grid-template-columns:\s*280px minmax\(0,1fr\)/,
    /@media \(max-width: 1279px\)/, /@media \(max-width: 899px\)/, /@media \(max-width: 767px\)/,
    /\.mobile-evidence-select\s*\{[^}]*display:\s*block/,
    /\.material-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/
  ]) assert.match(css, contract);
  assert.match(css, /min-height:\s*40px/);
  assert.doesNotMatch(css, /@import|url\(["']?https?:/);
});
