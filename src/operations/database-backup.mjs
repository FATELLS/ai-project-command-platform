import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const DEFAULT_IMAGE = "ai-project-command-platform/xugudb:12.9.10-arm64";
const DEFAULT_CONTAINER = "ai-project-command-platform-xugu";
const DEFAULT_VOLUME = "ai-project-command-platform-xugu-data";

function safeName(value, label) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function safeImage(value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$/.test(value)) throw new TypeError("Xugu image is invalid");
  return value;
}

function settings(options = {}) {
  return {
    image: safeImage(options.image ?? process.env.XUGU_IMAGE ?? DEFAULT_IMAGE),
    container: safeName(options.container ?? process.env.XUGU_CONTAINER ?? DEFAULT_CONTAINER, "Xugu container"),
    volume: safeName(options.volume ?? process.env.XUGU_VOLUME ?? DEFAULT_VOLUME, "Xugu volume")
  };
}

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe", timeout: options.timeout ?? 120_000 }).trim();
}

function assertContainerStopped(container) {
  try {
    const running = docker(["inspect", "--format", "{{.State.Running}}", container], { timeout: 5_000 });
    if (running === "true") throw new Error("Xugu container must be stopped before backup or restore");
  } catch (error) {
    if (error.message.includes("must be stopped")) throw error;
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", resolveHash);
    stream.on("error", rejectHash);
  });
  return hash.digest("hex");
}

export async function verifyXuguBackup(path, options = {}) {
  const archive = resolve(path);
  const info = await stat(archive);
  if (!info.isFile() || info.size < 1024) throw new Error("Xugu backup archive is empty or invalid");
  const { image } = settings(options);
  docker([
    "run", "--rm", "--entrypoint", "tar",
    "-v", `${archive}:/backup/archive.tar.gz:ro`,
    image, "-tzf", "/backup/archive.tar.gz"
  ]);
  return { path: archive, bytes: info.size, sha256: await sha256(archive), backend: "xugu" };
}

export async function backupXuguVolume(targetPath, options = {}) {
  const target = resolve(targetPath);
  const { image, container, volume } = settings(options);
  assertContainerStopped(container);
  await mkdir(dirname(target), { recursive: true });
  docker([
    "run", "--rm", "--entrypoint", "tar",
    "-v", `${volume}:/source:ro`,
    "-v", `${dirname(target)}:/backup`,
    image, "-czf", `/backup/${basename(target)}`, "-C", "/source", "."
  ], { timeout: 600_000 });
  return verifyXuguBackup(target, options);
}

export async function restoreXuguVolume(sourcePath, options = {}) {
  const source = resolve(sourcePath);
  const { image, container, volume } = settings(options);
  assertContainerStopped(container);
  const verified = await verifyXuguBackup(source, options);
  const suffix = options.suffix ?? new Date().toISOString().replaceAll(":", "-");
  const preserved = `${source}.pre-restore-${suffix}.tar.gz`;
  await backupXuguVolume(preserved, options);
  docker([
    "run", "--rm", "--entrypoint", "sh",
    "-v", `${volume}:/target`,
    "-v", `${source}:/restore/archive.tar.gz:ro`,
    image, "-c", "find /target -mindepth 1 -delete && tar -xzf /restore/archive.tar.gz -C /target"
  ], { timeout: 600_000 });
  return { ...verified, volume, preserved };
}
