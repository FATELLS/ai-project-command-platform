import { randomUUID } from "node:crypto";
import { MaterialGateError, declaredMaterialType, mergeMaterialLimits, sanitizeDisplayName, validateMagic } from "./policy.mjs";
import { createMaterialRepository } from "./material-repository.mjs";
import { createMaterialStorage, validateOfficeContainer } from "./storage.mjs";

export function createMaterialIngestService(database, options = {}) {
  const limits = mergeMaterialLimits(options.limits);
  const repository = options.repository ?? createMaterialRepository(database, { now: options.now, limits });
  const storage = options.storage ?? createMaterialStorage({ root: options.storageRoot });
  const scan = options.scan;
  const requireScan = options.requireScan === true;

  async function ingest(input) {
    const displayName = sanitizeDisplayName(input.filename);
    const declared = declaredMaterialType(displayName, input.mime);
    if (!input.source || typeof input.source[Symbol.asyncIterator] !== "function") {
      throw new MaterialGateError("invalid_stream", "材料来源必须是异步字节流");
    }
    if (Number.isFinite(input.contentLength) && input.contentLength > limits.maxFileBytes) {
      throw new MaterialGateError("file_too_large", "文件超过大小限制");
    }
    const reservation = repository.reserveUpload({ projectId: input.projectId, userId: input.userId });
    let stagePath;
    let committedKey;
    try {
      stagePath = await storage.createStage();
      const staged = await storage.writeStage(input.source, {
        path: stagePath,
        maxBytes: limits.maxFileBytes,
        probeBytes: limits.magicProbeBytes,
        signal: input.signal
      });
      if (input.truncated) throw new MaterialGateError("upload_truncated", "上传未完成");
      if (staged.byteSize === 0) throw new MaterialGateError("empty_file", "空文件不被接受");
      if (Number.isFinite(input.contentLength) && input.contentLength !== staged.byteSize) {
        throw new MaterialGateError("upload_truncated", "接收到的数据大小与声明不符");
      }
      await validateMagic(staged.probe, declared);
      if ([".docx", ".pptx", ".xlsx"].includes(declared.extension)) {
        await validateOfficeContainer(stagePath, declared, limits);
      }
      if (requireScan && typeof scan !== "function") throw new MaterialGateError("scanner_unavailable", "安全扫描服务不可用");
      if (typeof scan === "function") {
        const result = await scan({ path: stagePath, projectId: input.projectId, sha256: staged.sha256, byteSize: staged.byteSize });
        if (!result || result.clean !== true) throw new MaterialGateError("scan_rejected", "材料未通过安全扫描");
      }
      const ids = { materialId: randomUUID(), artifactId: randomUUID(), jobId: randomUUID() };
      return repository.createReceipt({
        ...ids,
        attemptId: reservation.attemptId,
        projectId: input.projectId,
        userId: input.userId,
        displayName,
        extension: declared.extension,
        mime: declared.mime,
        sha256: staged.sha256,
        byteSize: staged.byteSize
      }, () => {
        committedKey = storage.commitStage(stagePath, { projectId: input.projectId, materialId: ids.materialId });
        stagePath = null;
        return committedKey;
      });
    } catch (error) {
      if (stagePath) storage.removeStage(stagePath);
      if (committedKey) storage.removeKey(committedKey);
      const code = error instanceof MaterialGateError ? error.code : "intake_failed";
      repository.finishUpload(reservation.attemptId, code === "upload_aborted" ? "aborted" : "rejected", code);
      throw error;
    }
  }

  return Object.freeze({ ingest, limits, repository, storage });
}
