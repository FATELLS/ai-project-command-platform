import { extname } from "node:path";
import { fileTypeFromBuffer } from "file-type";

export const MiB = 1024 * 1024;

export const materialLimits = Object.freeze({
  maxFileBytes: 200 * MiB,
  maxMaterialsPerProject: 10000,
  maxProjectArtifactBytes: 1024 * MiB,
  maxUploadsPerMinute: 20,
  uploadLeaseMs: 15 * 60_000,
  maxZipEntries: 2_000,
  maxZipExpandedBytes: 80 * MiB,
  maxZipRatio: 100,
  magicProbeBytes: 8_192
});

const types = Object.freeze({
  ".txt": { mime: "text/plain", detected: null },
  ".md": { mime: "text/markdown", acceptedMimes: ["text/markdown", "text/plain"], detected: null },
  ".csv": { mime: "text/csv", acceptedMimes: ["text/csv", "text/plain"], detected: null },
  ".json": { mime: "application/json", acceptedMimes: ["application/json", "text/json", "text/plain"], detected: null },
  ".yaml": { mime: "application/yaml", acceptedMimes: ["application/yaml", "application/x-yaml", "text/yaml", "text/x-yaml", "text/plain"], detected: null },
  ".pdf": { mime: "application/pdf", detected: "pdf" },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", detected: "docx" },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", detected: "pptx" },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", detected: "xlsx" },
  ".png": { mime: "image/png", detected: "png" },
  ".jpg": { mime: "image/jpeg", detected: "jpg" },
  ".jpeg": { mime: "image/jpeg", detected: "jpg" },
  ".webp": { mime: "image/webp", detected: "webp" }
});

export class MaterialGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MaterialGateError";
    this.code = code;
  }
}

export function sanitizeDisplayName(value) {
  const leaf = String(value ?? "").replaceAll("\\", "/").split("/").pop();
  const clean = leaf.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) throw new MaterialGateError("invalid_name", "请输入有效的文件名");
  return clean.slice(0, 240);
}

export function declaredMaterialType(filename, mime) {
  const extension = extname(filename).toLowerCase();
  const expected = types[extension];
  if (!expected) throw new MaterialGateError("unsupported_type", "不支持此文件类型");
  const normalizedMime = String(mime ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!(expected.acceptedMimes ?? [expected.mime]).includes(normalizedMime)) {
    throw new MaterialGateError("mime_mismatch", "文件类型与扩展名不匹配");
  }
  return { extension, mime: expected.mime, detected: expected.detected };
}

export async function validateMagic(probe, declared) {
  if (declared.detected === null) {
    if (probe.includes(0)) throw new MaterialGateError("magic_mismatch", "文本材料包含二进制内容");
    // probe 在 8192 字节处硬截取，可能截断 UTF-8 多字节字符（最大 4 字节）
    // 截断到最后一个完整字符的边界，避免边界截断导致的误报
    const safeLen = utf8SafeTruncate(probe);
    try { new TextDecoder("utf-8", { fatal: true }).decode(probe.subarray(0, safeLen)); }
    catch { throw new MaterialGateError("invalid_encoding", "文本材料必须是 UTF-8 编码"); }
    return;
  }
  const detected = await fileTypeFromBuffer(probe);
  if (!detected || detected.ext !== declared.detected) {
    throw new MaterialGateError("magic_mismatch", "文件内容与声明的类型不匹配");
  }
}

/**
 * Truncate a byte array to the last valid UTF-8 character boundary.
 * Needed because probe is a fixed-size window (8192 bytes) that may split a multi-byte char.
 */
function utf8SafeTruncate(buf) {
  if (buf.length === 0) return 0;
  // Scan from the end to find the last position where all preceding bytes form valid complete characters
  for (let i = buf.length - 1; i >= 0 && i >= buf.length - 4; i--) {
    const byte = buf[i];
    if (byte < 0x80 || byte >= 0xC0) {
      // This is a single-byte char (0xxxxxxx) or the start of a multi-byte sequence (11xxxxxx)
      // Check if the full sequence fits within buf
      let charLen;
      if (byte < 0x80) charLen = 1;
      else if (byte >= 0xF0) charLen = 4;
      else if (byte >= 0xE0) charLen = 3;
      else charLen = 2;
      if (i + charLen <= buf.length) return buf.length; // Last char is complete
      return i; // Truncate before the incomplete char
    }
  }
  return buf.length > 4 ? buf.length - 4 : 0;
}

export function mergeMaterialLimits(overrides = {}) {
  const result = { ...materialLimits, ...overrides };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`Invalid material limit: ${key}`);
  }
  return Object.freeze(result);
}
