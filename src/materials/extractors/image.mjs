import { extractionLimits } from "./common.mjs";
import { extractWithVision } from "./llm-vision.mjs";

/**
 * 图片提取器 — 走 LLM 多模态视觉
 *
 * 不再依赖 tesseract，直接把图片发给 LLM 做视觉理解 + OCR。
 * 调用链：image.mjs → llm-vision.mjs → fetch(vision API)
 */
export async function extractImage({ path }, limits = extractionLimits, capabilities = {}) {
  const visionConfig = capabilities.visionConfig;
  return extractWithVision({ path, extension: ".png" }, limits, { visionConfig });
}
