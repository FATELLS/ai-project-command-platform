import { extname } from "node:path";
import { fileTypeFromBuffer } from "file-type";

export const MiB = 1024 * 1024;

export const materialLimits = Object.freeze({
  maxFileBytes: 200 * MiB,
  maxMaterialsPerProject: 100,
  maxProjectArtifactBytes: 300 * MiB,
  maxUploadsPerMinute: 6,
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
    try { new TextDecoder("utf-8", { fatal: true }).decode(probe); }
    catch { throw new MaterialGateError("invalid_encoding", "文本材料必须是 UTF-8 编码"); }
    return;
  }
  const detected = await fileTypeFromBuffer(probe);
  if (!detected || detected.ext !== declared.detected) {
    throw new MaterialGateError("magic_mismatch", "文件内容与声明的类型不匹配");
  }
}

export function mergeMaterialLimits(overrides = {}) {
  const result = { ...materialLimits, ...overrides };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`Invalid material limit: ${key}`);
  }
  return Object.freeze(result);
}
