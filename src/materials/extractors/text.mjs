import { readFile } from "node:fs/promises";
import { ExtractionError, extractionLimits, normalizeText, splitBlock } from "./common.mjs";

export async function extractText({ path, extension = ".txt", manual }, limits = extractionLimits) {
  if (manual) {
    const blocks = [];
    for (const [field, value] of Object.entries(manual)) {
      if (typeof value !== "string") throw new ExtractionError("invalid_manual_field", "Manual evidence fields must be text");
      blocks.push(...splitBlock(value, "text", { type: "manual", field }, limits));
    }
    return blocks;
  }
  const bytes = await readFile(path);
  if (bytes.length > limits.maxTextBytes || bytes.includes(0)) throw new ExtractionError("invalid_text", "Text input is binary or exceeds its limit");
  let content;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new ExtractionError("invalid_encoding", "Text input must be UTF-8"); }
  if (extension === ".json") {
    let value;
    try { value = JSON.parse(content); } catch { throw new ExtractionError("invalid_json", "JSON material is malformed"); }
    const blocks = [];
    const walk = (node, pointer) => {
      if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) walk(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
      else blocks.push(...splitBlock(String(node ?? "null"), "text", { type: "json", pointer: pointer || "/" }, limits));
    };
    walk(value, ""); return blocks;
  }
  const lines = normalizeText(content).split("\n");
  return lines.flatMap((line, index) => splitBlock(line, "text", { type: extension === ".csv" ? "record" : "line", line: index + 1 }, limits));
}
