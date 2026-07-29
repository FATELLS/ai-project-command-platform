import { extractionLimits } from "./common.mjs";
import { extractWithVision } from "./llm-vision.mjs";

/**
 * PDF 提取器 — 走 LLM 多模态视觉
 *
 * 不再依赖 pdftotext，直接把 PDF 发给 LLM 做视觉理解。
 * 调用链：pdf.mjs → llm-vision.mjs → fetch(vision API)
 */
export async function extractPdf({ path }, limits = extractionLimits, capabilities = {}) {
  const visionConfig = capabilities.visionConfig;
  return extractWithVision({ path, extension: ".pdf" }, limits, { visionConfig });
}
