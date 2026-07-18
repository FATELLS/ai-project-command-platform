import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");const renderers=readFileSync(new URL("../public/modules/renderers.js",import.meta.url),"utf8");const css=readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");const source=`${app}\n${renderers}`;

test("proposal workspace uses canonical project-scoped task and proposal routes",()=>{for(const contract of ["/generation-tasks","/capabilities","/retry","/change-proposals","generationTaskId","proposalId"])assert.match(source,new RegExp(contract.replaceAll("/","\\/")));assert.match(app,/generationTaskMatch/);assert.match(app,/proposalMatch/);assert.match(renderers,/mutation: true/);});

test("fixed renderer exposes locked tasks, validated proposals, citations and honest usage",()=>{for(const copy of ["作战更新提案","项目更新提案","生成作战更新提案","生成项目更新提案","AI 只生成带来源的结构化建议；不会修改项目草稿或发布版本。","等待生成资源","锁定并整理证据","执行服务端校验","结构化提案已生成","发布基准已变化","服务端校验结果","结构化字段","引用证据","未配置单价，仅记录 Token","尚未写入草稿，也未发布"])assert.match(renderers,new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));assert.match(renderers,/safeText|text:/);assert.doesNotMatch(source,/innerHTML|insertAdjacentHTML|eval\(|new Function/);});

test("generation sheet enforces same-template bounded material selection and server capabilities",()=>{for(const contract of ["maxMaterialsPerTask","maxEvidenceBlocks","generationEnabled","updateTemplateKey","idempotencyKey","crypto.randomUUID","caps.create","capabilityEnvelope.provider?.enabled"])assert.match(renderers,new RegExp(contract.replace(/[.?]/g,match=>`\\${match}`)));for(const copy of ["已选择","与已选材料模板不同","暂无可用于生成的材料","正在创建生成任务…","关闭生成面板","更新生成当前未启用；材料、证据和已有提案仍可查看。"])assert.match(renderers,new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));});

test("Phase 5 UI contains no review, draft merge, publish or rollback action",()=>{for(const forbidden of [/text:\s*"接受"/,/text:\s*"驳回"/,/text:\s*"编辑提案"/,/text:\s*"合并草稿"/,/text:\s*"应用更新"/,/text:\s*"发布"/,/text:\s*"回滚"/,/\/merge-draft/,/\/publish-version/,/\/rollback/])assert.doesNotMatch(renderers,forbidden);assert.match(renderers,/不会修改项目草稿或发布版本/);});

test("proposal UI preserves desktop, tablet and mobile layouts",()=>{for(const contract of [/\.generation-sheet/,/\.proposal-workspace-header/,/\.generation-detail-layout/,/\.proposal-detail-layout/,/\.proposal-change-index/,/\.proposal-evidence-list/,/@media \(max-width: 1279px\)/,/@media \(max-width: 767px\)/])assert.match(css,contract);assert.match(css,/grid-template-columns:\s*280px minmax\(0,1fr\)/);assert.match(css,/min-height:\s*40px/);});

test("proposal evidence preserves deterministic manual, line, slide and JSON locators",()=>{for(const contract of [/人工材料/,/location\.line/,/location\.slide/,/location\.pointer/])assert.match(renderers,contract);});
