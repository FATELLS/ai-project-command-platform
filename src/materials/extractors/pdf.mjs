import { extractionLimits } from "./common.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MissingCapabilityError, splitBlock } from "./common.mjs";
import { extractWithVision } from "./llm-vision.mjs";

const execFileAsync = promisify(execFile);

/**
 * PDF 提取器 — 走 LLM 多模态视觉
 *
 * 不再依赖 pdftotext，直接把 PDF 发给 LLM 做视觉理解。
 * 调用链：pdf.mjs → llm-vision.mjs → fetch(vision API)
 */
export async function extractPdf({ path }, limits = extractionLimits, capabilities = {}) {
  const visionConfig = capabilities.visionConfig;
  if (visionConfig) return extractWithVision({ path, extension: ".pdf" }, limits, { visionConfig });
  if (!capabilities.pdftotext) throw new MissingCapabilityError("pdftotext");
  const tool = capabilities.pdftotextPath ?? "pdftotext";
  const { stdout } = await execFileAsync(tool, [path, "-"], {
    timeout: limits.commandTimeoutMs,
    maxBuffer: limits.maxCommandOutputBytes
  });
  return parsePdfText(stdout, limits);
}

function parsePdfText(output, limits) {
  const text = String(output ?? "");
  const pages = text.includes("<page")
    ? [...text.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/gi)].map(match => match[1])
    : text.split(/\f+/);
  return pages.flatMap((page, index) => {
    const words = [...page.matchAll(/<word\b[^>]*>([\s\S]*?)<\/word>/gi)].map(match => match[1].replace(/<[^>]*>/g, " "));
    const content = words.length ? words.join(" ") : page.replace(/<[^>]*>/g, " ");
    return splitBlock(content, "page", { type: "pdf-page", page: index + 1 }, limits);
  });
}
