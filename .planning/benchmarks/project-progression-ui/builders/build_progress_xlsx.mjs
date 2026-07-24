import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("../fixtures/", import.meta.url);
const qaDir = new URL("../qa/xlsx/", import.meta.url);
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });

const workbook = Workbook.create();
const ledger = workbook.worksheets.add("推进台账");
const metrics = workbook.worksheets.add("指标快照");
const notes = workbook.worksheets.add("异常备注");

ledger.showGridLines = false;
ledger.getRange("A1:J1").merge();
ledger.getRange("A1").values = [["跨作战单元项目推进台账 · UI Benchmark"]];
ledger.getRange("A1:J1").format = {
  fill: "#0D3E8E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
ledger.getRange("A1:J1").format.rowHeight = 30;
ledger.getRange("A2:J2").values = [[
  "任务 ID", "任务名称", "作战单元", "负责人", "计划开始", "计划结束", "进度", "状态", "下一步行动", "日期检查"
]];
ledger.getRange("A2:J2").format = {
  fill: "#E8EEF5",
  font: { bold: true, color: "#1F3A5F" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#B9C7D8" },
};
ledger.getRange("A3:I8").values = [
  ["tech-kb-foundation", "XuguDB 技术知识库首轮", "技术服务作战单元", "冯治龙", new Date("2026-07-15"), new Date("2026-07-31"), 0.90, "进行中", "补齐 2 个知识主题并组织首轮验收"],
  ["tech-company-knowledge", "公司级知识系统方案与治理规范", "技术服务作战单元", "魏粤川", new Date("2026-07-15"), new Date("2026-08-05"), 0.55, "进行中", "形成 v0.4 评审稿并上传版本依据"],
  ["product-effect-ledger", "AI 效果台账", "产品作战单元", "王安迪", new Date("2026-07-15"), new Date("2026-08-12"), 0.60, "进行中", "统一指标口径并补齐到 20 条试点记录"],
  ["finance-data-security", "财务数据治理与安全分类", "财务作战单元", "陈文斌", new Date("2026-07-15"), new Date("2026-08-07"), 0.35, "阻塞", "提交分类审批；未批准前只用脱敏样本"],
  ["platform-plan", "平台作战单元正式规划", "平台作战单元", null, null, null, null, "待确认", "补齐负责人、开始和结束日期，禁止自动推断"],
  ["admin-compute", "可持续算力与分级调度", "行政作战单元", "谢莅", new Date("2026-07-15"), new Date("2026-07-31"), 0.40, "有风险", "确认可持续算力预算与优先级"],
];
ledger.getRange("J3").formulas = [["=IF(OR(E3=\"\",F3=\"\"),\"待补日期\",IF(AND(H3<>\"已完成\",F3<TODAY()),\"超期\",\"正常\"))"]];
ledger.getRange("J3:J8").fillDown();
ledger.getRange("E3:F8").format.numberFormat = "yyyy-mm-dd";
ledger.getRange("G3:G8").format.numberFormat = "0%";
ledger.getRange("A3:J8").format = {
  verticalAlignment: "center",
  wrapText: true,
  borders: { insideHorizontal: { style: "thin", color: "#DCE5F1" }, bottom: { style: "thin", color: "#DCE5F1" } },
};
ledger.getRange("H3:H8").dataValidation = { rule: { type: "list", values: ["待确认", "进行中", "阻塞", "有风险", "已完成"] } };
ledger.getRange("H3:H8").conditionalFormats.add("containsText", { text: "阻塞", format: { fill: "#FDE8E8", font: { color: "#9B1C1C", bold: true } } });
ledger.getRange("H3:H8").conditionalFormats.add("containsText", { text: "有风险", format: { fill: "#FFF4D6", font: { color: "#7A5A00", bold: true } } });
ledger.getRange("J3:J8").conditionalFormats.add("containsText", { text: "待补", format: { fill: "#FFF4D6", font: { color: "#7A5A00" } } });
ledger.getRange("A9:J9").merge();
ledger.getRange("A9").values = [["说明：以上为合成 Benchmark 数据；进度、负责人和日期只有经 UI 生成的结构化提案、人工审核与发布后才应改变项目。"]];
ledger.getRange("A9:J9").format = { fill: "#F4F6F9", font: { italic: true, color: "#5F7088" }, wrapText: true };
ledger.getRange("A9:J9").format.rowHeight = 34;
ledger.freezePanes.freezeRows(2);
const ledgerWidths = [19, 30, 20, 12, 13, 13, 9, 11, 38, 13];
ledgerWidths.forEach((width, index) => { ledger.getRangeByIndexes(0, index, 9, 1).format.columnWidth = width; });
ledger.getRange("2:8").format.autofitRows();

metrics.showGridLines = false;
metrics.getRange("A1:G1").merge();
metrics.getRange("A1").values = [["项目推进指标快照 · 截至 2026-07-23"]];
metrics.getRange("A1:G1").format = { fill: "#0D3E8E", font: { bold: true, color: "#FFFFFF", size: 16 } };
metrics.getRange("A2:G2").values = [["指标名称", "指标值", "单位", "状态", "指标日期", "目标", "来源"]];
metrics.getRange("A2:G2").format = { fill: "#E8EEF5", font: { bold: true, color: "#1F3A5F" }, horizontalAlignment: "center" };
metrics.getRange("A3:G6").values = [
  ["知识主题完成率", 0.90, "%", "on-track", new Date("2026-07-23"), 1.00, "技术服务周会确认：18/20"],
  ["效果台账记录覆盖率", 0.60, "%", "at-risk", new Date("2026-07-23"), 1.00, "产品周会确认：12/20"],
  ["平台规划字段完整率", 0.25, "%", "off-track", new Date("2026-07-23"), 1.00, "缺负责人、开始日期、结束日期"],
  ["技能模块安装数量", 56, "个", "on-track", new Date("2026-07-23"), 60, "行政作战单元口径"],
];
metrics.getRange("B3:B5").format.numberFormat = "0%";
metrics.getRange("F3:F5").format.numberFormat = "0%";
metrics.getRange("E3:E6").format.numberFormat = "yyyy-mm-dd";
metrics.getRange("A2:G6").format = { wrapText: true, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: "#DCE5F1" } } };
metrics.getRange("D3:D6").conditionalFormats.add("containsText", { text: "off-track", format: { fill: "#FDE8E8", font: { color: "#9B1C1C", bold: true } } });
metrics.getRange("D3:D6").conditionalFormats.add("containsText", { text: "at-risk", format: { fill: "#FFF4D6", font: { color: "#7A5A00", bold: true } } });
[32, 12, 10, 14, 14, 12, 38].forEach((width, index) => { metrics.getRangeByIndexes(0, index, 6, 1).format.columnWidth = width; });
metrics.freezePanes.freezeRows(2);
metrics.getRange("2:6").format.autofitRows();

notes.showGridLines = false;
notes.getRange("A1:F1").merge();
notes.getRange("A1").values = [["异常备注与冲突口径"]];
notes.getRange("A1:F1").format = { fill: "#0D3E8E", font: { bold: true, color: "#FFFFFF", size: 16 } };
notes.getRange("A3:B6").values = [
  ["记录类型", "内容"],
  ["冲突", "群聊称效果台账“差不多八成”，正式周会确认值为 60%；不得自动采用更高口径。"],
  ["缺失", "平台规划任务没有负责人、开始日期、结束日期。"],
  ["风险", "财务 OCR 试点受数据分类审批阻塞，预计 2026-08-12 后才能进入真实票据验证。"],
];
notes.getRange("A3:B3").format = { fill: "#E8EEF5", font: { bold: true, color: "#1F3A5F" } };
notes.getRange("A3:B6").format = { wrapText: true, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: "#DCE5F1" } } };
notes.getRange("A:A").format.columnWidth = 14;
notes.getRange("B:B").format.columnWidth = 70;
notes.getRange("3:6").format.autofitRows();

const inspect = await workbook.inspect({
  kind: "table",
  range: "推进台账!A1:J9",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 12,
  maxChars: 8000,
});
await fs.writeFile(new URL("inspect.txt", qaDir), inspect.ndjson, "utf8");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
await fs.writeFile(new URL("formula-errors.txt", qaDir), errors.ndjson, "utf8");

for (const [sheetName, range, filename] of [
  ["推进台账", "A1:J9", "推进台账.png"],
  ["指标快照", "A1:G6", "指标快照.png"],
  ["异常备注", "A1:B6", "异常备注.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(new URL(filename, qaDir), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = fileURLToPath(new URL("02_跨单元推进台账.xlsx", outputDir));
await output.save(outputPath);
console.log(outputPath);
