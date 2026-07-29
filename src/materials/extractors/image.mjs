import { extractionLimits } from "./common.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MissingCapabilityError, splitBlock } from "./common.mjs";
import { extractWithVision } from "./llm-vision.mjs";

const execFileAsync = promisify(execFile);

/**
 * 图片提取器 — 走 LLM 多模态视觉
 *
 * 不再依赖 tesseract，直接把图片发给 LLM 做视觉理解 + OCR。
 * 调用链：image.mjs → llm-vision.mjs → fetch(vision API)
 */
export async function extractImage({ path }, limits = extractionLimits, capabilities = {}) {
  const visionConfig = capabilities.visionConfig;
  if (visionConfig) return extractWithVision({ path, extension: ".png" }, limits, { visionConfig });
  if (!capabilities.tesseract) throw new MissingCapabilityError("tesseract");
  const tool = capabilities.tesseractPath ?? "tesseract";
  const { stdout } = await execFileAsync(tool, [path, "stdout", "tsv"], {
    timeout: limits.commandTimeoutMs,
    maxBuffer: limits.maxCommandOutputBytes
  });
  return parseOcrTsv(stdout, limits);
}

function parseOcrTsv(output, limits) {
  const rows = String(output ?? "").trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  const header = rows[0].split("\t");
  const index = Object.fromEntries(header.map((key, position) => [key, position]));
  return rows.slice(1).flatMap((row, rowIndex) => {
    const cells = row.split("\t");
    const text = String(cells[index.text] ?? "").trim();
    if (!text) return [];
    const left = Number(cells[index.left] ?? 0);
    const top = Number(cells[index.top] ?? 0);
    const width = Number(cells[index.width] ?? 0);
    const height = Number(cells[index.height] ?? 0);
    const confidence = Number(cells[index.conf] ?? 0);
    return splitBlock(text, "image", {
      type: "ocr",
      page: Number(cells[index.page_num] ?? 1) || 1,
      block: rowIndex + 1,
      bbox: { left, top, width, height },
      confidence
    }, limits);
  });
}
