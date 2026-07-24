import { enforceBounds, extractionLimits, ExtractionError } from "./common.mjs";
import { extractImage } from "./image.mjs";
import { extractOoxml } from "./ooxml.mjs";
import { extractPdf } from "./pdf.mjs";
import { extractText } from "./text.mjs";

export async function extractMaterial(input, options = {}) {
  const limits = { ...extractionLimits, ...options.limits };
  let blocks;
  if (input.manual || [".txt", ".md", ".csv", ".json", ".yaml"].includes(input.extension)) blocks = await extractText(input, limits);
  else if ([".docx", ".pptx", ".xlsx"].includes(input.extension)) blocks = await extractOoxml(input, limits);
  else if (input.extension === ".pdf") blocks = await extractPdf(input, limits, options.capabilities);
  else if ([".png", ".jpg", ".jpeg", ".webp"].includes(input.extension)) blocks = await extractImage(input, limits, options.capabilities);
  else throw new ExtractionError("unsupported_type", "Material type has no extractor");
  if (!blocks.length) throw new ExtractionError("no_extractable_text", "Material contains no usable evidence text");
  return enforceBounds(blocks, limits);
}

export { ExtractionError, MissingCapabilityError, extractionLimits } from "./common.mjs";
