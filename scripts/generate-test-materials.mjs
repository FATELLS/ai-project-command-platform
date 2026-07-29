// 生成完备测试材料——覆盖所有格式和内容丰富度场景
// 输出目录: mock-materials/comprehensive/
//
// 格式覆盖：.txt .json .yaml .docx .xlsx .pptx .pdf .md .csv
// 内容覆盖：极简 / 中等 / 超长多主题 / 纯数据 / 跨领域术语 / 项目计划 / 进度汇报 / 成果归档

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(".");
const OUT_DIR = join(ROOT, "mock-materials/comprehensive");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════
// 辅助：用 zip 命令生成 docx/xlsx/pptx（纯 shell，不依赖 npm 库）
// ═══════════════════════════════════════════════════════

function makeDocx(outputPath, paragraphs) {
  // 最小化 docx 结构：[Content_Types].xml + word/document.xml
  const tmpDir = `/tmp/docx-gen-${Date.now()}`;
  mkdirSync(join(tmpDir, "_rels"), { recursive: true });
  mkdirSync(join(tmpDir, "word"), { recursive: true });

  const bodyXml = paragraphs.map(p => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join("\n");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
</w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  writeFileSync(join(tmpDir, "[Content_Types].xml"), contentTypes);
  writeFileSync(join(tmpDir, "_rels/.rels"), rels);
  writeFileSync(join(tmpDir, "word/document.xml"), documentXml);

  execSync(`cd "${tmpDir}" && zip -r -X "${outputPath}" "[Content_Types].xml" _rels word`);
  execSync(`rm -rf "${tmpDir}"`);
}

function makeXlsx(outputPath, sheets) {
  // sheets = [{ name, rows: [[cell, cell, ...], ...] }]
  const tmpDir = `/tmp/xlsx-gen-${Date.now()}`;
  mkdirSync(join(tmpDir, "_rels"), { recursive: true });
  mkdirSync(join(tmpDir, "xl"), { recursive: true });
  mkdirSync(join(tmpDir, "xl/_rels"), { recursive: true });
  mkdirSync(join(tmpDir, "xl/worksheets"), { recursive: true });

  // sharedStrings
  const strings = [];
  const stringMap = new Map();
  function sharedStr(val) {
    if (stringMap.has(val)) return stringMap.get(val);
    const idx = strings.length;
    strings.push(`<si><t xml:space="preserve">${escapeXml(val)}</t></si>`);
    stringMap.set(val, idx);
    return idx;
  }

  let sheetNum = 0;
  const sheetXmls = [];
  const sheetRels = [];
  const sheetTargets = [];
  for (const sheet of sheets) {
    sheetNum++;
    const rowsXml = sheet.rows.map((row, ri) => {
      const cellsXml = row.map((val, ci) => {
        const cellRef = colLetter(ci) + (ri + 1);
        if (typeof val === "number") {
          return `<c r="${cellRef}"><v>${val}</v></c>`;
        }
        const idx = sharedStr(String(val));
        return `<c r="${cellRef}" t="s"><v>${idx}</v></c>`;
      }).join("");
      return `<row r="${ri+1}">${cellsXml}</row>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${rowsXml}
</sheetData>
</worksheet>`;
    writeFileSync(join(tmpDir, `xl/worksheets/sheet${sheetNum}.xml`), xml);
    sheetXmls.push(`<sheet name="${escapeXml(sheet.name)}" sheetId="${sheetNum}" r:id="rId${sheetNum}"/>`);
    sheetRels.push(`<Relationship Id="rId${sheetNum}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNum}.xml"/>`);
    sheetTargets.push(`<Override PartName="/xl/worksheets/sheet${sheetNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  }

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.join("\n")}
</sst>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheetXmls.join("\n")}
</sheets>
</workbook>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
${sheetTargets.join("\n")}
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels.join("\n")}
<Relationship Id="rId${sheetNum+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  writeFileSync(join(tmpDir, "[Content_Types].xml"), contentTypes);
  writeFileSync(join(tmpDir, "_rels/.rels"), rels);
  writeFileSync(join(tmpDir, "xl/workbook.xml"), workbookXml);
  writeFileSync(join(tmpDir, "xl/_rels/workbook.xml.rels"), workbookRels);
  writeFileSync(join(tmpDir, "xl/sharedStrings.xml"), sharedStringsXml);

  execSync(`cd "${tmpDir}" && zip -r -X "${outputPath}" "[Content_Types].xml" _rels xl`);
  execSync(`rm -rf "${tmpDir}"`);
}

function makePptx(outputPath, slides) {
  // slides = [{ title, bullets: [string, ...] }]
  const tmpDir = `/tmp/pptx-gen-${Date.now()}`;
  mkdirSync(join(tmpDir, "_rels"), { recursive: true });
  mkdirSync(join(tmpDir, "ppt"), { recursive: true });
  mkdirSync(join(tmpDir, "ppt/slides"), { recursive: true });
  mkdirSync(join(tmpDir, "ppt/_rels"), { recursive: true });

  const slideParts = [];
  const slideRels = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideNum = i + 1;
    const titleXml = `<a:p><a:r><a:rPr b="1" sz="2800"/><a:t>${escapeXml(slide.title)}</a:t></a:r></a:p>`;
    const bulletXml = slide.bullets.map(b => `<a:p><a:r><a:rPr sz="1800"/><a:t>${escapeXml(b)}</a:t></a:r></a:p>`).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:cNvPr id="1" name=""/><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/>${titleXml}${bulletXml}</p:txBody></p:sp>
</p:spTree></p:cSld>
</p:sld>`;
    writeFileSync(join(tmpDir, `ppt/slides/slide${slideNum}.xml`), xml);
    slideParts.push(`<p:sldIdLst><p:sldId id="${slideNum}" r:id="rId${slideNum}"/></p:sldIdLst>`);
    slideRels.push(`<Relationship Id="rId${slideNum}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`);
  }

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${slideParts.join("\n")}
</p:presentation>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n")}
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRels.join("\n")}
</Relationships>`;

  writeFileSync(join(tmpDir, "[Content_Types].xml"), contentTypes);
  writeFileSync(join(tmpDir, "_rels/.rels"), rels);
  writeFileSync(join(tmpDir, "ppt/presentation.xml"), presentationXml);
  writeFileSync(join(tmpDir, "ppt/_rels/presentation.xml.rels"), presentationRels);

  execSync(`cd "${tmpDir}" && zip -r -X "${outputPath}" "[Content_Types].xml" _rels ppt`);
  execSync(`rm -rf "${tmpDir}"`);
}

function makePdf(outputPath, text) {
  // 用 textutil + cupsfilter 生成 PDF（macOS 原生工具链）
  const tmpDir = `/tmp/pdf-gen-${Date.now()}`;
  mkdirSync(tmpDir, { recursive: true });
  const txtPath = join(tmpDir, "source.txt");
  const htmlPath = join(tmpDir, "source.html");
  writeFileSync(txtPath, text);
  try {
    execSync(`textutil -convert html "${txtPath}" -output "${htmlPath}"`);
    execSync(`cupsfilter -i text/html "${htmlPath}" > "${outputPath}"`);
    execSync(`rm -rf "${tmpDir}"`);
    return true;
  } catch {
    try {
      execSync(`pandoc "${txtPath}" -o "${outputPath}"`);
      execSync(`rm -rf "${tmpDir}"`);
      return true;
    } catch {
      // 最终回退：写 txt 文件替代
      writeFileSync(outputPath.replace(/\.pdf$/, ".txt"), text);
      execSync(`rm -rf "${tmpDir}"`);
      console.log("  (PDF生成失败，已输出.txt替代)");
      return false;
    }
  }
}

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function colLetter(n) {
  let s = "";
  n = n + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function save(filename, content) {
  const path = join(OUT_DIR, filename);
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  console.log(`  ✓ ${filename}`);
}

// ═══════════════════════════════════════════════════════
// 1. 极简材料（测试 LLM 从碎片化信息推断卡片）
// ═══════════════════════════════════════════════════════
console.log("生成极简材料...");

save("01-minimal-wechat-brief.txt", `下周二要开会，讨论新版本上线的事。
王总说这个版本必须周五之前发布，不能延期。
张工负责后端接口，李工负责前端页面。
目前还有两个bug没修完，风险比较大。
测试那边刘姐说至少需要两天回归测试。`);

save("02-minimal-voice-note.txt", `今天和客户开了个会
客户叫陈总，是华泰科技的
他们想做一个智能质检系统
预算大概300万
让我们下周三之前出一个方案
我和老赵分工，我写需求他写技术架构
deadline是12月底`);

save("03-minimal-task-note.txt", `紧急：官网改版
- 老板催了好几次了
- 设计稿周三给
- 开发下周五上线
- 注意兼容IE11（还有10%用户）
- 赵磊负责`);

// ═══════════════════════════════════════════════════════
// 2. 超长多主题材料（测试分块上限和多作战单元）
// ═══════════════════════════════════════════════════════
console.log("生成超长多主题材料...");

const longMeeting = `# 2026年Q3全员季度总结大会纪要

**会议时间**：2026-09-30 14:00-18:00
**参会人员**：张伟（CEO）、李明（CTO）、王芳（CFO）、赵刚（COO）、陈雪（CMO）、刘洋（CHRO）、各部门负责人共22人
**会议地点**：总部A栋大会议厅

## 一、Q3整体经营回顾

王芳（CFO）汇报Q3财务数据：
- 总营收：4.2亿元（同比+18.5%，完成季度目标的103%）
- 净利润：6800万元（同比+22%，利润率16.2%）
- 研发投入：5200万元（占营收12.4%，同比+2.1pp）
- 现金储备：3.8亿元

陈雪（CMO）汇报市场进展：
- 新签客户：87家（目标80家），合同金额1.2亿元
- 续约率：94.5%（目标92%）
- NPS：62分（Q2为58分，提升4分）
- 品牌曝光：行业媒体提及次数同比增长3倍

## 二、产品研发线（李明-CTO）

### 2.1 核心平台迭代
1. **AI中台2.0上线**：9月15日正式发布，支持多模态理解（文本+图像+语音），已接入6个业务线
   - 负责人：吴志远（AI平台负责人）
   - 团队：12人
   - 关键指标：模型推理延迟从800ms降至320ms（降60%），GPU利用率从45%提升到72%
   - 风险：新架构对老旧GPU（Tesla T4）不兼容，需要50块A10替代，预算追加200万
   - 交付物：AI中台2.0技术白皮书、开源SDK v1.0、迁移文档

2. **推荐引擎优化**：CTR从4.2%提升至5.1%（目标5.5%），实时特征延迟<5分钟
   - 负责人：周小燕（算法负责人）
   - 状态：进行中，核心模块完成85%
   - 依赖：AI中台2.0的实时特征服务
   - 预计Q4第一周全量上线

3. **数据中台升级**：完成数据治理1.0，统一指标口径300+个
   - 负责人：孙明（数据负责人）
   - 状态：已完成，进入维护阶段
   - 成果：数据质量评分从68分提升到89分，BI报表产出效率提升40%

### 2.2 安全合规
4. **等保三级复测**：9月28日通过现场测评，获得证书
   - 负责人：张志强（安全负责人）
   - 团队：5人+外部测评机构
   - 发现问题：3个中风险项，已全部整改
   - 交付物：等保三级测评报告（编号DJ2026-0347）、整改清单

5. **数据安全体系建设**：启动数据分级分类，覆盖核心系统12个
   - 负责人：张志强
   - 状态：进行中，完成60%
   - 风险：业务部门配合度不高（数据owner不明确），需要高层推动

### 2.3 基础设施
6. **混合云迁移**：自建机房老化，计划12个月内迁移至混合云
   - 负责人：李娜（基础设施PM）
   - 预算：2500万
   - 状态：评估阶段完成（M0里程碑），126个应用按6R分类完毕
   - 风险：核心交易系统迁移窗口只有4小时（凌晨2:00-6:00），回滚方案是关键

## 三、销售与客户成功线（赵刚-COO）

### 3.1 大客户
7. **华通金控智能客服项目**：合同2580万，已签约
   - 负责人：陈雪梅（大客户经理）
   - 交付周期：90天（客户要求压缩，原计划120天）
   - 状态：交付启动阶段，kickoff已召开
   - 风险：90天交付周期紧张，灾备方案和等保合规需要并行推进
   - 关键决策：是否采用第三方灾备服务商（成本+180万 vs 自建+3周工期）

8. **中石油数字化油田项目**：投标阶段
   - 负责人：王建国（销售VP）
   - 预计合同金额：4500万
   - 竞争对手：华为、阿里云
   - 状态：已入围前三，11月15日现场讲标
   - 交付物：投标方案、POC环境

### 3.2 渠道生态
9. **东南亚渠道拓展**：已签约3家渠道伙伴
   - 负责人：马攀（国际业务负责人）
   - 状态：新加坡+马来西亚渠道已运营，印尼渠道建设中
   - Q3渠道ARR：$85万（目标$120万，差25%）
   - 风险：印尼数据中心PDP审批延迟，预计Q4才能拿到

### 3.3 客户成功
10. **客户健康度体系**：建立NPS+续约率+使用深度三维评分
    - 负责人：赵磊（客户成功负责人）
    - 状态：已完成，系统已上线
    - Q3客户健康分布：健康72%、关注18%、风险10%
    - 行动：10%风险客户已分配 CSM 一对一跟进

## 四、财务与运营线（王芳-CFO）

11. **全面预算管理升级**：从年度预算转为滚动预算
    - 负责人：孙颖（财务经理）
    - 状态：Q4启动，预计2027年Q1上线
    - 目标：预算偏差率从15%降至8%以内
    - 依赖：数据中台的实时经营看板

12. **供应链成本优化**：Q3完成供应商集中采购谈判
    - 负责人：陈文斌（供应链负责人）
    - 成果：服务器采购成本降低12%，云服务成本降低8%
    - 预计年化节约：380万元
    - 下一步：建立动态比价机制

## 五、组织与人才线（刘洋-CHRO）

13. **组织效能提升**：人均产出从165万提升至178万
    - 负责人：谢莅（HR负责人）
    - 目标：2027年达到200万/人
    - 状态：第一批试点完成，人均提升7-15%
    - 关键决策：是否在Q4启动第二批推广（涉及200人组织调整）

14. **人才引进**：Q3引进高级人才8人
    - 负责人：谢莅
    - 包括：AI科学家2人、架构师3人、产品总监1人、销售总监2人
    - 预算执行：猎头费用85万（预算100万）
    - 风险：核心算法岗位仍有3个空缺，市场上人才稀缺

15. **企业文化刷新**：完成价值观升级V2.0
    - 负责人：谢莅
    - 状态：已发布，正在落地
    - eNPS：27分（目标30分，差距3分）
    - 下一步：Q4开展全员价值观工作坊

## 六、Q4重点决策事项

1. 混合云迁移是否启动（2500万预算审批）
2. 华通金控灾备方案选择（第三方 vs 自建）
3. 组织效能第二批推广范围（200人 vs 500人）
4. 东南亚市场追加投入（80万美元 vs 150万美元）
5. AI中台3.0是否立项（预计投入1500万）

## 七、风险看板

| 风险 | 严重度 | 负责人 | 状态 |
|------|--------|--------|------|
| 华通90天交付周期 | 高 | 陈雪梅 | 需高层介入 |
| 核心交易迁移窗口 | 高 | 李娜 | 需回滚演练 |
| 印尼PDP审批 | 中 | 马攀 | 跟进中 |
| 数据owner不明确 | 中 | 张志强 | 需高层推动 |
| 算法人才空缺 | 中 | 谢莅 | 持续招聘 |
| 预算偏差15% | 中 | 孙颖 | 滚动预算解决 |`;

save("04-long-quarterly-review.md", longMeeting);

// ═══════════════════════════════════════════════════════
// 3. 纯数据型材料（测试 metrics-data 模板触发）
// ═══════════════════════════════════════════════════════
console.log("生成纯数据型材料...");

const metricsData = [
  ["指标名称", "当前值", "单位", "目标值", "状态", "时间"],
  ["系统可用性", "99.97", "%", "99.95", "达标", "2026-09-30"],
  ["平均响应延迟", "320", "ms", "500", "达标", "2026-09-30"],
  ["GPU利用率", "72", "%", "70", "达标", "2026-09-30"],
  ["模型推理QPS", "18000", "次/秒", "20000", "接近目标", "2026-09-30"],
  ["数据质量评分", "89", "分", "85", "超标", "2026-09-30"],
  ["月活用户", "1250000", "人", "1200000", "达标", "2026-09-30"],
  ["客户NPS", "62", "分", "60", "达标", "2026-09-30"],
  ["续约率", "94.5", "%", "92", "达标", "2026-09-30"],
  ["人均产出", "178", "万元", "175", "达标", "2026-09-30"],
  ["eNPS", "27", "分", "30", "未达标", "2026-09-30"],
  ["BUG密度", "0.8", "个/千行", "1.0", "达标", "2026-09-30"],
  ["自动化测试覆盖率", "87", "%", "85", "达标", "2026-09-30"],
  ["P0故障数", "0", "次", "0", "达标", "2026-09-30"],
  ["安全事件数", "2", "次", "0", "未达标", "2026-09-30"],
];

save("05-metrics-dashboard.csv", metricsData.map(r => r.join(",")).join("\n"));

// JSON 格式
save("06-api-metrics.json", {
  service: "ai-platform",
  period: "2026-09",
  metrics: {
    requestVolume: { total: 18500000, daily: 616666, peak: 890000 },
    latency: { p50: 280, p90: 450, p99: 1200, unit: "ms" },
    errorRate: { "4xx": 0.32, "5xx": 0.08, unit: "%" },
    throughput: { current: 18000, capacity: 25000, unit: "QPS" },
    gpuUtilization: { average: 72, peak: 89, idle: 12, unit: "%" }
  },
  tasks: [
    { id: "TASK-001", title: "GPU资源池化", owner: "吴志远", progress: 60, dueDate: "2026-11-15", status: "at-risk", risk: "GPU供应周期8周，可能影响双十一" },
    { id: "TASK-002", title: "推理引擎优化", owner: "周小燕", progress: 85, dueDate: "2026-10-20", status: "on-track" },
    { id: "TASK-003", title: "监控告警体系", owner: "李娜", progress: 100, dueDate: "2026-09-30", status: "done" }
  ],
  risks: [
    { id: "RISK-001", title: "双十一流量洪峰", severity: "high", mitigation: "扩容至25000 QPS，预案已演练", owner: "吴志远" },
    { id: "RISK-002", title: "模型版本回退", severity: "medium", mitigation: "灰度发布+AB测试+自动回退机制", owner: "周小燕" }
  ]
});

// YAML 格式
save("07-project-config.yaml", `project:
  id: smart-qa-platform
  name: 智能质检平台
  status: active
  startDate: 2026-10-01
  endDate: 2026-12-31
  budget: 320
  
milestones:
  - id: M1
    title: 需求确认
    date: 2026-10-15
    state: done
  - id: M2
    title: 原型评审
    date: 2026-10-31
    state: doing
  - id: M3
    title: 开发完成
    date: 2026-11-30
    state: todo
  - id: M4
    title: 上线交付
    date: 2026-12-28
    state: todo

team:
  - name: 王建国
    role: 项目发起人
    department: 销售VP
  - name: 刘浩
    role: 技术负责人
    department: 架构部
  - name: 陈雪梅
    role: 客户对接
    department: 客户成功
  - name: 张志强
    role: 安全合规
    department: 安全部

tasks:
  - id: T1
    title: 质检规则引擎开发
    owner: 刘浩
    start: 2026-10-20
    end: 2026-11-15
    progress: 30
    depends_on: [T0]
    deliverable: 质检规则引擎v1.0
  - id: T2
    title: AI模型训练数据准备
    owner: 周小燕
    start: 2026-10-15
    end: 2026-10-30
    progress: 80
    deliverable: 标注数据集5000条
  - id: T3
    title: 等保二级备案
    owner: 张志强
    start: 2026-11-01
    end: 2026-11-20
    progress: 0
    risk: 需要客户配合提供系统架构材料`);

// ═══════════════════════════════════════════════════════
// 4. 项目计划模板（触发 project-plan 模板）
// ═══════════════════════════════════════════════════════
console.log("生成项目计划材料...");

const projectPlan = `# 智慧城市交通AI优化项目计划书

**项目编号**：TRAFFIC-AI-2026
**编制日期**：2026-08-01
**项目负责人**：赵伟（智慧城市事业部总监）

## 1. 项目背景

XX市交通拥堵指数连续3年上升（2023年3.2→2024年3.8→2025年4.5），传统信号灯控制系统已无法满足需求。市政府决定引入AI技术进行交通信号优化，预算1200万元，工期8个月。

## 2. 项目目标

### 2.1 业务目标
- 主干道平均通行时间降低 20%（从12分钟降至9.6分钟以内）
- 高峰期拥堵指数从 4.5 降至 3.5 以下
- 交通事故响应时间缩短至 5 分钟以内

### 2.2 技术目标
- 完成 500 个路口的 AI 信号灯改造
- 建设交通大数据平台，日处理数据量 10TB
- 建立 3 套交通优化算法模型（高峰/平峰/应急）

## 3. 项目范围

### 3.1 作战单元划分

**单元 A - 感知层建设**
- 负责：摄像头、雷达、地磁传感器的安装与调试
- 负责人：陈工（物联网工程师）
- 团队：8人
- 预算：350万

**单元 B - 算法与平台**
- 负责：AI信号优化算法开发与大数据平台搭建
- 负责人：林博（算法架构师）
- 团队：12人
- 预算：500万

**单元 C - 集成与交付**
- 负责：系统联调、用户培训、运维移交
- 负责人：赵伟
- 团队：5人
- 预算：350万

### 3.2 关键里程碑

| 里程碑 | 日期 | 验收标准 |
|--------|------|---------|
| M1 感知设备部署完成 | 2026-10-31 | 500个路口设备上线，在线率≥99% |
| M2 算法模型初版 | 2026-12-15 | 3套模型完成离线训练，AUC≥0.85 |
| M3 系统联调完成 | 2027-01-31 | 全链路联调通过，延迟<2秒 |
| M4 试运行 | 2027-02-28 | 选择3条主干道试运行2周 |
| M5 正式交付 | 2027-03-31 | 全面上线，通过市政府验收 |

### 3.3 任务分解

**感知层（单元 A）：**
1. 现场勘测与方案设计（陈工，2026-08-15~08-31）
2. 设备采购与到货（采购部，2026-08-15~09-15）
3. 分批安装调试（陈工团队，2026-09-01~10-20，分5批次）
4. 设备联调与在线率验证（陈工，2026-10-20~10-31）

**算法与平台（单元 B）：**
5. 数据采集管道搭建（林博，2026-08-15~09-15）
6. 历史数据导入与清洗（数据团队，2026-09-01~09-30）
7. 高峰优化算法训练（林博，2026-10-01~11-15）
8. 平峰与应急算法训练（林博，2026-11-01~12-01）
9. 大数据平台部署（平台团队，2026-11-15~12-15）
10. 算法AB测试（林博，2026-12-15~12-31）

**集成与交付（单元 C）：**
11. 系统联调方案编写（赵伟，2027-01-05~01-10）
12. 全链路联调执行（赵伟团队，2027-01-10~01-31）
13. 试运行准备（赵伟，2027-02-01~02-10）
14. 3条主干道试运行（全体，2027-02-10~02-28）
15. 运维培训与文档交付（赵伟，2027-03-01~03-15）
16. 正式验收交付（赵伟，2027-03-20~03-31）

## 4. 风险评估

| 风险 | 严重度 | 应对策略 | 负责人 |
|------|--------|---------|--------|
| 路口施工审批延迟 | 高 | 提前2个月报批，设专人与交管局对接 | 赵伟 |
| 算法模型精度不达标 | 高 | 备选方案：采购成熟商业模型 | 林博 |
| 极端天气影响施工 | 中 | 预留10天缓冲期，分批施工降低风险 | 陈工 |
| 数据质量问题 | 中 | 建立6σ数据质量监控体系 | 数据团队 |
| 市政府领导更换 | 低 | 保持多方关系维护，不依赖单一渠道 | 赵伟 |

## 5. 质量管理

- 每两周一次项目评审会
- 关键里程碑引入第三方评估
- 建立 BUG 跟踪系统，P0/P1 问题 24 小时内解决
- 试运行期间每日输出优化效果报告`;

save("08-project-plan-smart-traffic.md", projectPlan);

// ═══════════════════════════════════════════════════════
// 5. 进度汇报材料（触发 progress-report 模板）
// ═══════════════════════════════════════════════════════
console.log("生成进度汇报材料...");

const progressReport = `# 医疗信息化项目周报 - 第12周

**项目名称**：区域医疗影像AI辅助诊断平台
**汇报周期**：2026-09-23 至 2026-09-29
**汇报人**：刘医生（项目执行经理）

## 本周进展

### 已完成任务
1. **DICOM影像接入模块开发** - 进度100%
   - 完成人：张工（后端开发）
   - 完成内容：支持DICOM 3.0标准全协议解析，兼容PACS系统对接
   - 验收标准：通过2000例样本测试，解析准确率100%

2. **AI诊断模型V1训练** - 进度100%
   - 完成人：陈博士（AI算法工程师）
   - 完成内容：肺结节检测模型训练完成，灵敏度93.2%（目标90%）
   - 验收标准：在开源数据集LIDC-IDRI上AUC=0.91

3. **前端阅片界面原型** - 进度100%
   - 完成人：李设计（UI/UX设计师）
   - 完成内容：完成Web端和iPad端阅片界面原型设计
   - 交付物：Figma原型稿、交互说明文档

### 进行中任务
4. **模型推理服务部署** - 进度65%
   - 负责人：王运维（DevOps工程师）
   - 当前状态：GPU服务器已到位，Docker容器化完成，正在进行性能压测
   - 预计完成：2026-10-05
   - 风险：单卡推理QPS只有15（目标30），需要做模型蒸馏优化

5. **HL7接口适配** - 进度40%
   - 负责人：张工
   - 当前状态：HIS系统集成方案已确认，接口开发中
   - 预计完成：2026-10-12
   - 阻塞：需要医院IT科配合开放测试环境，目前等待审批

### 下周计划
6. **三甲医院Pilot对接** - 新启动
   - 负责人：刘医生
   - 目标：完成协和医院放射科试点对接
   - 关键里程碑：10月10日完成第一例真实临床影像AI辅助诊断

7. **模型蒸馏优化** - 新启动
   - 负责人：陈博士
   - 目标：QPS从15提升到30以上
   - 方法：知识蒸馏+TensorRT推理加速

## 风险与问题

### 本周新增风险
- **风险等级：高** - 医院PACS系统版本老旧（v2.1），可能不兼容新接口
  - 应对：安排技术团队下周二去现场评估，备选方案是开发适配层
  - 负责人：张工

- **风险等级：中** - 医疗数据脱敏流程复杂，审批周期长
  - 应对：提前启动伦理委员会审批流程，预计2周
  - 负责人：刘医生

### 持续关注问题
- GPU推理性能优化（跟踪中）
- 临床医生使用习惯调研（下周启动）

## 关键决策记录

**决策 #2026-09-28-01**：模型部署采用本地化方案（不部署到云端）
- 决策人：刘医生 + 医院信息科主任
- 原因：医疗数据不出院的安全合规要求
- 影响：需要追加2台GPU服务器（预算+48万），运维复杂度增加

## 质量指标

| 指标 | 本周值 | 目标值 | 趋势 |
|------|--------|--------|------|
| 代码覆盖率 | 82% | 85% | ↑ |
| 单元测试通过率 | 96% | 98% | → |
| 模型AUC | 0.91 | 0.90 | ↑ |
| BUG修复周期 | 1.8天 | 2.0天 | ↑ |
| 接口响应时间 | 120ms | 200ms | ↑ |

## 资源消耗

- 本周工时投入：320人时（计划350人时）
- 预算消耗：累计185万/总预算320万（57.8%）
- 下周关键资源：GPU服务器压测（周二-周四）、协和医院现场支持（周二全天）`;

save("09-progress-report-medical.md", progressReport);

// ═══════════════════════════════════════════════════════
// 6. 成果归档材料（触发 outcome-archive 模板）
// ═══════════════════════════════════════════════════════
console.log("生成成果归档材料...");

const outcomeArchive = `# Q3 数字化转型成果归档报告

**归档日期**：2026-10-08
**归档人**：王芳（数字化办公室主任）

## 成果一：智能客服系统上线

**成果编号**：OUTCOME-2026-Q3-001
**完成日期**：2026-09-20
**状态**：已验收交付

### 成果描述
完成全渠道智能客服系统部署，覆盖官网、APP、微信、电话四个渠道，实现 7x24 小时智能应答。

### 量化成果
- 客服人力节约：从42人缩减到18人（-57%），年化节约人力成本 286 万元
- 首次响应时间：从平均45秒降至8秒（-82%）
- 客户满意度：从78分提升到89分（CSAT）
- 意图识别准确率：91.5%（目标90%）

### 关键决策
- 采购了智谱AI的 GLM 大模型作为底层引擎（年费80万）
- 采用混合云部署，敏感数据走私有化，普通查询走公有云
- 保留 18 人人工坐席处理复杂问题（保留率43%）

### 经验教训
- 初期意图识别准确率只有 72%，通过 3 轮 fine-tuning 提升到 91.5%
- 知识库维护是持续投入，需要专职知识工程师
- 客户接受度比预期高，NPS 从 52 提升到 67

## 成果二：供应链数字化平台

**成果编号**：OUTCOME-2026-Q3-002
**完成日期**：2026-09-15
**状态**：已验收交付

### 成果描述
搭建供应链全链路可视化平台，覆盖从采购到交付的 12 个环节，实现实时追踪和预警。

### 量化成果
- 采购周期缩短：从平均28天降至19天（-32%）
- 库存周转率：从4.2次/年提升到5.8次/年（+38%）
- 供应商准时交付率：从82%提升到94%
- 年化节约成本：420万元（采购降本+库存优化）

### 关键决策
- 选择了自建而非SaaS方案，数据安全可控
- 供应商接入采用标准化API，3周内完成47家接入
- 预警阈值设置经过2轮校准，误报率从35%降至8%`;

save("10-outcome-archive-digital.md", outcomeArchive);

// ═══════════════════════════════════════════════════════
// 7. 跨领域术语材料（测试 LLM 理解力）
// ═══════════════════════════════════════════════════════
console.log("生成跨领域术语材料...");

save("11-cross-domain-fintech.txt", `金融科技合规改造项目会议纪要

时间：2026-10-12
参会：风控总监李明、合规官张华、CTO王磊、数据治理负责人赵芳

议题：Basel III 信用风险IRB法内部评级体系升级

李明（风控）：
目前我们的PD模型（Probability of Default）还是基于 logistic regression，
监管要求 2027 年之前必须升级到 IRB Advanced Approach。
LGD（Loss Given Default）和 EAD（Exposure at Default）也需要重新校准。
回测显示当前模型的 discriminatory power 只有 0.68（Gini coefficient），
目标要达到 0.75 以上。

张华（合规）：
CBIRC（银保监会）最新的《商业银行资本管理办法》要求
内部模型必须通过独立验证，包括：
1. 模型开发文档完整性
2. 数据质量评估
3. 模型方法论合理性
4. 返回检验结果
验证报告需要每季度提交给监管。

王磊（CTO）：
技术方案上，建议从 logistic regression 迁移到 XGBoost + Neural Network 的 ensemble。
需要标注团队重新标注历史违约样本（约 50000 条）。
GPU 集群需要扩容（预算 200 万，4 台 A100 服务器）。
数据管道需要对接央行征信系统和百行征信。
模型上线后需要做 champion-challenger framework 持续监控。

赵芳（数据治理）：
数据质量是大问题，目前存量贷款数据有 15% 缺失关键字段
（主要是企业财务报表数据和抵押物评估值）。
建议分两步走：
1. 先用现有数据做模型 prototype，Q4 完成
2. Q1 做数据补录和清洗，Q2 拿到完整数据后做正式模型

会议决议：
1. 成立 IRB 升级专项组，李明任 PM
2. 10月31日前输出详细项目计划
3. 数据补录工作立即启动
4. 预算审批走特事特办通道（不超 350 万）`);

// ═══════════════════════════════════════════════════════
// 8. 生成 Office 格式文件（docx/xlsx/pptx）
// ═══════════════════════════════════════════════════════
console.log("生成 Office 格式材料...");

// DOCX：会议纪要
makeDocx(join(OUT_DIR, "12-meeting-notes.docx"), [
  "技术架构评审会议纪要",
  "",
  "会议时间：2026-10-15 14:00-16:30",
  "参会人员：刘浩（架构师）、赵磊（交付总监）、吴志远（AI负责人）、林小燕（安全合规）",
  "会议地点：总部8楼会议室",
  "",
  "议题：智能客服平台 V2.0 架构评审",
  "",
  "1. 整体架构方案",
  "刘浩汇报了V2.0的技术架构方案，采用微服务+事件驱动架构：",
  "- 接入层：API Gateway（Kong）+ WebSocket 长连接",
  "- AI引擎层：GLM-5 大模型 + RAG 知识检索 + 意图分类",
  "- 业务服务层：会话管理、工单流转、客户画像",
  "- 数据层：PostgreSQL（业务）+ Redis（缓存）+ ClickHouse（分析）",
  "",
  "2. 关键技术指标",
  "- 意图识别准确率：≥92%（当前89%）",
  "- 首次响应时间：≤800ms（当前1200ms）",
  "- 并发能力：5000路同时在线（当前2000路）",
  "- 系统可用性：99.95%",
  "",
  "3. 评审结论",
  "通过项（7项）：整体架构、技术选型、数据模型、安全方案、部署方案、监控方案、灾备方案",
  "待改进项（3项）：",
  "- 知识库更新机制不够完善，建议增加自动化巡检",
  "- 模型灰度发布方案缺少详细回滚步骤",
  "- 成本估算偏高（年化380万），建议优化GPU使用率",
  "",
  "4. 任务分配",
  "刘浩：完善架构设计文档，10月20日前提交（P0）",
  "吴志远：模型灰度发布方案细化，10月22日前提交（P0）",
  "林小燕：等保合规自查清单更新，10月25日前提交（P1）",
  "赵磊：成本优化方案，10月28日前提交（P1）",
  "",
  "5. 风险",
  "GPU供应周期8周，可能影响12月上线计划。需要立即下单采购。",
]);

// XLSX：项目甘特图导出
makeXlsx(join(OUT_DIR, "13-gantt-export.xlsx"), [
  {
    name: "任务进度",
    rows: [
      ["任务ID", "任务名称", "负责人", "开始日期", "结束日期", "进度", "状态", "作战单元", "前置依赖"],
      ["T001", "需求分析与确认", "陈雪梅", "2026-10-01", "2026-10-10", "100", "已完成", "销售", ""],
      ["T002", "技术方案设计", "刘浩", "2026-10-05", "2026-10-20", "100", "已完成", "研发", "T001"],
      ["T003", "UI/UX设计稿", "李设计", "2026-10-10", "2026-10-25", "100", "已完成", "产品", "T001"],
      ["T004", "后端API开发", "张工", "2026-10-20", "2026-11-15", "65", "进行中", "研发", "T002"],
      ["T005", "前端页面开发", "王工", "2026-10-25", "2026-11-20", "55", "进行中", "产品", "T003"],
      ["T006", "AI模型训练", "吴志远", "2026-10-15", "2026-11-10", "80", "进行中", "AI", "T002"],
      ["T007", "数据库设计与部署", "赵运维", "2026-10-15", "2026-10-30", "100", "已完成", "基础设施", "T002"],
      ["T008", "安全合规审查", "林小燕", "2026-11-01", "2026-11-15", "30", "进行中", "安全", "T004"],
      ["T009", "系统集成测试", "赵磊", "2026-11-15", "2026-11-30", "0", "待启动", "测试", "T004,T005"],
      ["T010", "UAT用户验收", "陈雪梅", "2026-11-25", "2026-12-05", "0", "待启动", "销售", "T009"],
      ["T011", "生产环境部署", "赵运维", "2026-12-01", "2026-12-10", "0", "待启动", "基础设施", "T010"],
      ["T012", "上线发布", "刘浩", "2026-12-10", "2026-12-15", "0", "待启动", "研发", "T011"],
    ]
  },
  {
    name: "风险登记",
    rows: [
      ["风险ID", "风险描述", "严重度", "状态", "负责人", "应对措施", "截止日期"],
      ["R001", "GPU到货延迟影响上线", "高", "跟进中", "赵运维", "已下单，加急配送", "2026-11-01"],
      ["R002", "AI模型精度不达标", "中", "已缓解", "吴志远", "增加训练数据5000条", "2026-11-10"],
      ["R003", "客户需求变更频繁", "中", "跟踪中", "陈雪梅", "建立需求变更流程", "2026-12-01"],
      ["R004", "测试资源不足", "低", "已解决", "赵磊", "调配2名测试工程师", "2026-11-15"],
    ]
  },
  {
    name: "指标看板",
    rows: [
      ["指标", "当前值", "目标值", "状态"],
      ["代码覆盖率", "82%", "85%", "接近"],
      ["BUG密度", "1.2/千行", "1.0/千行", "需改进"],
      ["需求完成率", "70%", "75%", "达标"],
      ["里程碑偏差", "0天", "≤2天", "达标"],
      ["团队工时利用率", "88%", "85%", "达标"],
    ]
  }
]);

// PPTX：项目启动演示
makePptx(join(OUT_DIR, "14-kickoff-deck.pptx"), [
  { title: "智能制造 ERP 升级项目启动会", bullets: [
    "项目代号: ERP-UPGRADE-2026",
    "启动日期: 2026年10月20日",
    "预计完成: 2027年3月30日",
    "项目预算: 850万元",
    "项目发起人: 王总(CIO)"
  ]},
  { title: "项目背景与目标", bullets: [
    "现有ERP系统已运行8年，技术栈老旧",
    "目标: 全面升级到云原生微服务架构",
    "订单处理效率提升50%",
    "库存准确率从92%提升到99%",
    "实现移动端审批和实时数据看板"
  ]},
  { title: "作战单元与团队", bullets: [
    "核心开发组: 张工(负责人) + 8名工程师",
    "数据迁移组: 李数据(负责人) + 3名DBA",
    "业务流程组: 陈业务(负责人) + 4名BA",
    "测试保障组: 赵测试(负责人) + 5名QA",
    "外部顾问: 2名SAP认证专家"
  ]},
  { title: "关键里程碑", bullets: [
    "M1 需求冻结: 2026-11-15",
    "M2 核心模块开发完成: 2026-12-31",
    "M3 数据迁移完成: 2027-01-31",
    "M4 UAT通过: 2027-02-28",
    "M5 正式上线: 2027-03-30"
  ]},
  { title: "主要风险", bullets: [
    "历史数据质量差, 迁移风险高 - 负责人: 李数据",
    "业务部门配合度不确定 - 负责人: 陈业务",
    "新旧系统并行期间效率下降 - 负责人: 王总",
    "SAP许可证费用可能超预算 - 负责人: 王总"
  ]}
]);

// ═══════════════════════════════════════════════════════
// 9. 生成 PDF（通过 txt → PDF 转换）
// ═══════════════════════════════════════════════════════
console.log("生成 PDF 材料...");
const pdfText = `项目立项报告：智能风控系统建设

报告人：风控技术总监 张明
日期：2026-10-08

一、项目概述

为满足监管要求（银保监会〔2026〕12号文）和业务发展需要，
拟建设智能风控系统，整合反欺诈、信用评估、实时监控三大模块。

项目周期：6个月（2026-11 至 2027-04）
项目预算：480万元
项目负责人：张明

二、建设目标

1. 反欺诈模块：覆盖线上线下全渠道，欺诈识别准确率≥95%
2. 信用评估模块：实现秒级授信决策，模型AUC≥0.82
3. 实时监控模块：交易级实时风控，延迟≤100ms

三、关键任务

任务1：反欺诈规则引擎建设（负责人：李工，2026-11-01至2027-01-15）
任务2：信用评分模型开发（负责人：陈博士，2026-11-15至2027-02-28）
任务3：实时风控引擎部署（负责人：王运维，2027-01-01至2027-03-15）
任务4：系统集成与联调（负责人：张明，2027-03-01至2027-04-15）

四、风险管理

风险1：模型训练数据不足（中）- 应对：采购外部数据源
风险2：监管验收不通过（高）- 应对：提前与监管沟通方案
风险3：系统性能不达标（中）- 应对：预留2周性能优化期`;
makePdf(join(OUT_DIR, "15-risk-control-report.pdf"), pdfText);

// ═══════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════
console.log("");
console.log("════════════════════════════════════════");
console.log("全部材料生成完毕！");
console.log("════════════════════════════════════════");
console.log("输出目录:", OUT_DIR);
console.log("");
console.log("覆盖矩阵：");
console.log("");
console.log("格式覆盖：");
console.log("  .txt  : 01,02,03,11 (极简/跨领域)");
console.log("  .md   : 04,08,09,10 (超长/计划/汇报/归档)");
console.log("  .csv  : 05           (纯数据指标)");
console.log("  .json : 06           (API结构化数据)");
console.log("  .yaml : 07           (项目配置)");
console.log("  .docx : 12           (会议纪要Word)");
console.log("  .xlsx : 13           (甘特图Excel)");
console.log("  .pptx : 14           (启动会PPT)");
console.log("  .pdf  : 15           (立项报告PDF)");
console.log("");
console.log("内容丰富度覆盖：");
console.log("  极简        : 01,02,03     (微信/语音/便签)");
console.log("  中等        : 12           (标准会议纪要)");
console.log("  超长多主题  : 04           (季度大会15任务)");
console.log("  纯数据型    : 05,06        (指标/JSON)");
console.log("  项目计划    : 07,08        (YAML/计划书)");
console.log("  进度汇报    : 09           (医疗周报)");
console.log("  成果归档    : 10           (数字化转型)");
console.log("  跨领域术语  : 11           (金融合规)");
console.log("  Office格式  : 12,13,14     (docx/xlsx/pptx)");
console.log("  PDF格式     : 15           (立项报告)");
