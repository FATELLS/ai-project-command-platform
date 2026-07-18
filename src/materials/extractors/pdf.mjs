import { decodeXmlText, extractionLimits, MissingCapabilityError, splitBlock } from "./common.mjs";
import { hasCommand, runBounded } from "./subprocess.mjs";

export async function extractPdf({ path }, limits = extractionLimits, capabilities = {}) {
  const available = capabilities.pdftotext ?? hasCommand("pdftotext");
  if (!available) throw new MissingCapabilityError("pdftotext");
  const xml = await runBounded(capabilities.pdftotextPath ?? "pdftotext", ["-bbox-layout", "-enc", "UTF-8", path, "-"], limits);
  const blocks = [];
  let page = 0;
  for (const pageMatch of xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    page += 1;
    let blockIndex = 0;
    for (const blockMatch of pageMatch[2].matchAll(/<block\b([^>]*)>([\s\S]*?)<\/block>/g)) {
      const text = decodeXmlText(blockMatch[2]); if (!text) continue; blockIndex += 1;
      const box = {}; for (const key of ["xMin", "yMin", "xMax", "yMax"]) { const value = blockMatch[1].match(new RegExp(`${key}="([^"]+)"`))?.[1]; if (value) box[key] = Number(value); }
      blocks.push(...splitBlock(text, "page", { type: "pdf-page", page, block: blockIndex, box }, limits));
    }
  }
  return blocks;
}
