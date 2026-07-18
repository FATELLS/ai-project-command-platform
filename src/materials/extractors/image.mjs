import { extractionLimits, MissingCapabilityError, splitBlock } from "./common.mjs";
import { hasCommand, runBounded } from "./subprocess.mjs";

export async function extractImage({ path }, limits = extractionLimits, capabilities = {}) {
  const available = capabilities.tesseract ?? hasCommand("tesseract");
  if (!available) throw new MissingCapabilityError("tesseract");
  const tsv = await runBounded(capabilities.tesseractPath ?? "tesseract", [path, "stdout", "tsv"], limits);
  const rows = tsv.trim().split("\n").slice(1).map(row => row.split("\t"));
  const groups = new Map();
  for (const row of rows) {
    if (row.length < 12 || Number(row[0]) !== 5 || Number(row[10]) < 50 || !row[11].trim()) continue;
    const key = row.slice(1, 6).join(":"); const group = groups.get(key) ?? { words: [], confidence: [], left: Infinity, top: Infinity, right: 0, bottom: 0 };
    const [left, top, width, height] = row.slice(6, 10).map(Number);
    group.words.push(row[11]); group.confidence.push(Number(row[10])); group.left = Math.min(group.left, left); group.top = Math.min(group.top, top); group.right = Math.max(group.right, left + width); group.bottom = Math.max(group.bottom, top + height); groups.set(key, group);
  }
  if (!groups.size) return [];
  return [...groups.values()].flatMap((group, index) => splitBlock(group.words.join(" "), "image", { type: "ocr", image: 1, paragraph: index + 1, box: { x: group.left, y: group.top, width: group.right - group.left, height: group.bottom - group.top }, confidence: group.confidence.reduce((a, b) => a + b, 0) / group.confidence.length }, limits));
}
