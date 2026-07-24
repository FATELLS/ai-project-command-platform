import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { extractMaterial, MissingCapabilityError } from "../src/materials/extractors/index.mjs";

const expected = JSON.parse(readFileSync(new URL("./fixtures/materials/expected.json", import.meta.url), "utf8"));

function makeZip(directory, entries, filename) {
  for (const [name, content] of Object.entries(entries)) { const path = join(directory, name); mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, content); }
  const target = join(directory, filename);
  const result = spawnSync("zip", ["-q", "-r", target, ...Object.keys(entries)], { cwd: directory, shell: false });
  assert.equal(result.status, 0, result.stderr?.toString());
  return target;
}

test("text, manual, JSON and bounds produce deterministic plain-text locators", async () => {
  const directory = mkdtempSync(join(tmpdir(), "extract-text-")); const path = join(directory, "notes.txt");
  writeFileSync(path, "第一行 <script>alert(1)</script>\n第二行");
  const text = await extractMaterial({ path, extension: ".txt" });
  assert.deepEqual(text.blocks.map(block => block.location.line), [1, 2]);
  assert.match(text.blocks[0].text, /<script>/);
  assert.equal(text.blocks[0].kind, expected.text.kind);
  const manual = await extractMaterial({ manual: { summary: "会议结论", next: "下一步" } });
  assert.deepEqual(manual.blocks.map(block => block.location.field), ["summary", "next"]);
  const huge = join(directory, "huge.txt"); writeFileSync(huge, "x".repeat(20));
  await assert.rejects(extractMaterial({ path: huge, extension: ".txt" }, { limits: { maxTextBytes: 10 } }), error => error.code === "invalid_text");
});

test("DOCX, PPTX and XLSX adapters preserve paragraph, slide and cell boundaries", async () => {
  const root = mkdtempSync(join(tmpdir(), "extract-office-"));
  const docx = makeZip(join(root, "docx"), { "word/document.xml": '<w:document><w:p><w:r><w:t>第一段</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:document>' }, "sample.docx");
  const pptx = makeZip(join(root, "pptx"), { "ppt/slides/slide2.xml": '<p:sld><a:p><a:r><a:t>第二页</a:t></a:r></a:p></p:sld>', "ppt/slides/slide1.xml": '<p:sld><a:p><a:r><a:t>第一页</a:t></a:r></a:p></p:sld>' }, "sample.pptx");
  const xlsx = makeZip(join(root, "xlsx"), {
    "xl/sharedStrings.xml": '<x:sst xmlns:x="urn:spreadsheet"><x:si><x:t>指标值</x:t></x:si></x:sst>',
    "xl/worksheets/sheet1.xml": '<x:worksheet xmlns:x="urn:spreadsheet"><x:sheetData><x:row r="1"><x:c r="B1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="str"><x:v>直接字符串</x:v></x:c></x:row></x:sheetData></x:worksheet>'
  }, "sample.xlsx");
  const doc = await extractMaterial({ path: docx, extension: ".docx" });
  assert.deepEqual(doc.blocks.map(block => block.location.paragraph), [1, 2]); assert.equal(doc.blocks[0].kind, expected.docx.kind);
  const deck = await extractMaterial({ path: pptx, extension: ".pptx" });
  assert.deepEqual(deck.blocks.map(block => [block.location.slide, block.text]), [[1, "第一页"], [2, "第二页"]]);
  const sheet = await extractMaterial({ path: xlsx, extension: ".xlsx" });
  assert.deepEqual(sheet.blocks[0].location, { type: "sheet-cell", sheet: "Sheet1", cell: "B1", part: 0, charStart: 0, charEnd: 3 });
  assert.equal(sheet.blocks[1].text, "直接字符串");
});

test("PDF and image subprocess adapters are bounded and expose typed page/OCR locators", async () => {
  const root = mkdtempSync(join(tmpdir(), "extract-tools-")); const input = join(root, "input.bin"); writeFileSync(input, "fixture");
  const pdfTool = join(root, "fake-pdf-tool");
  writeFileSync(pdfTool, '#!/usr/bin/env node\nprocess.stdout.write(`<doc><page><block xMin="1" yMin="2" xMax="10" yMax="20"><word>PDF 证据</word></block></page></doc>`);\n'); chmodSync(pdfTool, 0o700);
  const ocrTool = join(root, "fake-ocr-tool");
  writeFileSync(ocrTool, '#!/usr/bin/env node\nprocess.stdout.write("level\\tpage_num\\tblock_num\\tpar_num\\tline_num\\tword_num\\tleft\\ttop\\twidth\\theight\\tconf\\ttext\\n5\\t1\\t1\\t1\\t1\\t1\\t10\\t20\\t30\\t10\\t96\\tOCR证据\\n");\n'); chmodSync(ocrTool, 0o700);
  const pdf = await extractMaterial({ path: input, extension: ".pdf" }, { capabilities: { pdftotext: true, pdftotextPath: pdfTool } });
  assert.equal(pdf.blocks[0].location.type, expected.pdf.locator); assert.equal(pdf.blocks[0].location.page, 1);
  const image = await extractMaterial({ path: input, extension: ".png" }, { capabilities: { tesseract: true, tesseractPath: ocrTool } });
  assert.equal(image.blocks[0].location.type, expected.image.locator); assert.equal(image.blocks[0].location.confidence, 96);
  await assert.rejects(extractMaterial({ path: input, extension: ".pdf" }, { capabilities: { pdftotext: false } }), MissingCapabilityError);
  await assert.rejects(extractMaterial({ path: input, extension: ".png" }, { capabilities: { tesseract: false } }), MissingCapabilityError);
});

test("malformed, empty, unsupported and excessive extractor output never succeeds", async () => {
  const root = mkdtempSync(join(tmpdir(), "extract-invalid-")); const empty = join(root, "empty.txt"); writeFileSync(empty, "  ");
  await assert.rejects(extractMaterial({ path: empty, extension: ".txt" }), error => error.code === "no_extractable_text");
  await assert.rejects(extractMaterial({ path: empty, extension: ".html" }), error => error.code === "unsupported_type");
  const many = join(root, "many.txt"); writeFileSync(many, "a\nb\nc");
  await assert.rejects(extractMaterial({ path: many, extension: ".txt" }, { limits: { maxBlocks: 2 } }), error => error.code === "too_many_blocks");
});
