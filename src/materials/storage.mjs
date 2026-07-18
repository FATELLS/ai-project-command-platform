import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, renameSync, rmSync } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { MaterialGateError } from "./policy.mjs";

export function defaultMaterialStorageRoot() {
  return resolve(process.env.PLATFORM_MATERIAL_STORAGE_DIR || join(tmpdir(), "ai-project-command-platform-materials"));
}

function inside(root, path) {
  const difference = relative(root, path);
  return difference !== ".." && !difference.startsWith(`..${sep}`) && !difference.includes(`${sep}..${sep}`);
}

export function createMaterialStorage(options = {}) {
  const root = resolve(options.root ?? defaultMaterialStorageRoot());
  const stagingRoot = join(root, "staging");
  const objectsRoot = join(root, "objects");
  mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
  mkdirSync(objectsRoot, { recursive: true, mode: 0o700 });

  function resolveKey(key) {
    const path = resolve(root, key);
    if (!inside(root, path)) throw new MaterialGateError("invalid_storage_key", "Storage key escaped its root");
    return path;
  }

  return Object.freeze({
    root,
    stagingRoot,
    objectsRoot,
    async createStage() {
      const path = join(stagingRoot, `${randomUUID()}.upload`);
      const handle = await open(path, "wx", 0o600);
      await handle.close();
      return path;
    },
    async writeStage(source, { path, maxBytes, probeBytes, signal } = {}) {
      let byteSize = 0;
      const chunks = [];
      let probeLength = 0;
      const { createHash } = await import("node:crypto");
      const hash = createHash("sha256");
      const counter = new Transform({
        transform(chunk, _encoding, callback) {
          byteSize += chunk.length;
          if (byteSize > maxBytes) return callback(new MaterialGateError("file_too_large", "File exceeds the configured byte limit"));
          hash.update(chunk);
          if (probeLength < probeBytes) {
            const part = chunk.subarray(0, probeBytes - probeLength);
            chunks.push(part);
            probeLength += part.length;
          }
          callback(null, chunk);
        }
      });
      try {
        await pipeline(source, counter, createWriteStream(path, { flags: "w", mode: 0o600 }), { signal });
      } catch (error) {
        await rm(path, { force: true });
        if (error?.name === "AbortError") throw new MaterialGateError("upload_aborted", "Upload was aborted");
        throw error;
      }
      return { byteSize, sha256: hash.digest("hex"), probe: Buffer.concat(chunks, probeLength) };
    },
    commitStage(stagePath, { projectId, materialId }) {
      if (!inside(stagingRoot, resolve(stagePath))) throw new MaterialGateError("invalid_stage", "Invalid staging path");
      const key = `objects/${encodeURIComponent(projectId)}/${materialId}/original`;
      const target = resolveKey(key);
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      renameSync(stagePath, target);
      return key;
    },
    removeStage(path) { rmSync(path, { force: true }); },
    removeKey(key) { rmSync(resolveKey(key), { force: true }); },
    pathForKey(key) { return resolveKey(key); }
  });
}

function openZip(path) {
  return new Promise((resolveZip, reject) => {
    yauzl.open(path, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) reject(new MaterialGateError("invalid_container", "Office container is invalid or truncated"));
      else resolveZip(zip);
    });
  });
}

export async function validateOfficeContainer(path, declared, limits) {
  const zip = await openZip(path);
  const seen = new Set();
  const required = {
    ".docx": "word/document.xml",
    ".pptx": "ppt/presentation.xml",
    ".xlsx": "xl/workbook.xml"
  }[declared.extension];
  let entries = 0;
  let expanded = 0;
  return new Promise((resolveValidation, rejectValidation) => {
    let settled = false;
    const fail = (code, message) => {
      if (settled) return;
      settled = true;
      zip.close();
      rejectValidation(new MaterialGateError(code, message));
    };
    zip.on("error", () => fail("invalid_container", "Office container is invalid or truncated"));
    zip.on("entry", entry => {
      entries += 1;
      const name = entry.fileName.replaceAll("\\", "/");
      const normalized = name.normalize("NFC");
      const unixMode = entry.externalFileAttributes >>> 16;
      if (entries > limits.maxZipEntries) return fail("zip_too_many_entries", "Office container has too many entries");
      if (name.startsWith("/") || /^[A-Za-z]:\//.test(name) || name.split("/").includes("..")) return fail("zip_unsafe_path", "Office container contains an unsafe path");
      if (seen.has(normalized)) return fail("zip_duplicate_path", "Office container contains duplicate paths");
      if ((unixMode & 0o170000) === 0o120000) return fail("zip_symlink", "Office container contains a symbolic link");
      if (/\.zip$/i.test(name)) return fail("zip_nested_archive", "Nested archives are not accepted");
      seen.add(normalized);
      expanded += entry.uncompressedSize;
      if (expanded > limits.maxZipExpandedBytes) return fail("zip_expanded_too_large", "Office container expands beyond the configured limit");
      if (entry.uncompressedSize > 0 && (entry.compressedSize === 0 || entry.uncompressedSize / entry.compressedSize > limits.maxZipRatio)) {
        return fail("zip_ratio_too_high", "Office container compression ratio is unsafe");
      }
      zip.readEntry();
    });
    zip.on("end", () => {
      if (settled) return;
      settled = true;
      if (!seen.has("[Content_Types].xml") || !seen.has(required)) {
        rejectValidation(new MaterialGateError("container_type_mismatch", "Office container does not match its extension"));
      } else resolveValidation({ entries, expandedBytes: expanded });
    });
    zip.readEntry();
  });
}
