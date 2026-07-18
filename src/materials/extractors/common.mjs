export const extractionLimits = Object.freeze({ maxTextBytes: 10 * 1024 * 1024, maxBlocks: 20_000, maxBlockChars: 1_200, maxCommandOutputBytes: 10 * 1024 * 1024, commandTimeoutMs: 120_000 });

export class ExtractionError extends Error {
  constructor(code, message, options) { super(message, options); this.name = "ExtractionError"; this.code = code; }
}

export class MissingCapabilityError extends ExtractionError {
  constructor(capability) { super("dependency_missing", `${capability} is not available`); this.capability = capability; }
}

export function normalizeText(value) {
  return String(value ?? "").normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}

export function splitBlock(text, kind, location, limits = extractionLimits) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const blocks = [];
  for (let start = 0, part = 0; start < normalized.length; start += limits.maxBlockChars, part += 1) {
    const value = normalized.slice(start, start + limits.maxBlockChars);
    blocks.push({ kind, text: value, location: { ...location, part, charStart: start, charEnd: start + value.length } });
  }
  return blocks;
}

export function enforceBounds(blocks, limits = extractionLimits) {
  if (blocks.length > limits.maxBlocks) throw new ExtractionError("too_many_blocks", "Extraction produced too many evidence blocks");
  const bytes = blocks.reduce((sum, block) => sum + Buffer.byteLength(block.text, "utf8"), 0);
  if (bytes > limits.maxTextBytes) throw new ExtractionError("extracted_text_too_large", "Extracted evidence exceeds its byte limit");
  return { blocks: blocks.map((block, ordinal) => ({ ...block, ordinal })), stats: { blocks: blocks.length, textBytes: bytes } };
}

export function decodeXmlText(value) {
  return normalizeText(String(value).replace(/<[^>]*>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " "));
}
