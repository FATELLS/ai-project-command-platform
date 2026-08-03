#!/usr/bin/env node

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { arch } from "node:os";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../src/config/local-config.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] ?? "status";
loadEnvFiles({ rootDir, quiet: true });

function setting(name, fallback) {
  return process.env[name] ?? fallback;
}

const xuguLifecycle = setting("PLATFORM_XUGU_LIFECYCLE", "managed");
const validXuguLifecycle = new Set(["managed", "external", "native"]).has(xuguLifecycle);
const managesXugu = xuguLifecycle === "managed" || xuguLifecycle === "native";
const XUGU_CONTAINER = setting("XUGU_CONTAINER", "ai-project-command-platform-xugu");
const XUGU_VOLUME = setting("XUGU_VOLUME", `${XUGU_CONTAINER}-data`);
const XUGU_PORT = setting("XUGU_PORT", "5138");
const xuguManifestPath = resolve(rootDir, "vendor/xugudb/image/manifest.json");
const xuguManifest = existsSync(xuguManifestPath)
  ? JSON.parse(readFileSync(xuguManifestPath, "utf8"))
  : null;

// 按当前 CPU 架构选择镜像定义
// schemaVersion 2: images[arch]，schemaVersion 1: 顶层单架构（向后兼容）
function selectImageEntry(manifest) {
  if (!manifest) return null;
  if (manifest.images && typeof manifest.images === "object") {
    const ar = arch();
    // Docker 使用 amd64 而非 x64
    const dockerArch = ar === "x64" || ar === "x86_64" ? "amd64" : ar;
    return manifest.images[dockerArch] || null;
  }
  // v1 兼容
  if (manifest.image && manifest.archive) {
    return {
      image: manifest.image,
      archive: manifest.archive,
      archiveSha256: manifest.archiveSha256 || ""
    };
  }
  return null;
}

const xuguImageEntry = selectImageEntry(xuguManifest);
const XUGU_IMAGE = setting("XUGU_IMAGE", xuguImageEntry?.image ?? "ai-project-command-platform/xugudb:12.10.13-arm64");
const xuguImageArchive = xuguImageEntry && xuguImageEntry.archive
  ? resolve(dirname(xuguManifestPath), xuguImageEntry.archive)
  : null;
const xuguImageArchiveSha256 = xuguImageEntry?.archiveSha256 || null;

function runtimePath(name, fallback) {
  const configured = setting(name, fallback);
  return isAbsolute(configured) ? configured : resolve(rootDir, configured);
}

const pidFile = runtimePath("PLATFORM_RUNTIME_PID_FILE", "server.pid");
const logFile = runtimePath("PLATFORM_RUNTIME_LOG_FILE", "app.log");
const port = Number(setting("PORT", "4173"));
const healthUrl = `http://127.0.0.1:${port}/health`;

function readPid() {
  if (!existsSync(pidFile)) return null;
  const value = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function processIsAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

// ----------------------------------------------------------------
// 虚谷原生进程联动（native 模式，不走容器）
// ----------------------------------------------------------------

const xuguNativePidFile = runtimePath("XUGU_NATIVE_PID_FILE", "xugu-server.pid");
const xuguNativeLogFile = runtimePath("XUGU_NATIVE_LOG_FILE", "xugu-server.log");
const xuguDataDir = runtimePath("XUGU_DATA_DIR", "data/xugu");

function xuguServerBinary() {
  const platform = process.platform;
  const ar = arch();
  const serverRoot = resolve(rootDir, "vendor/xugudb/server");
  if (platform === "win32") {
    const winDir = join(serverRoot, "windows/amd64/XuguDB/Server/BIN");
    const candidates = [
      join(winDir, "xugu_windows_amd64_20250714.exe"),
      join(winDir, "xugu_windows_amd64_20250731.exe")
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    // fallback: glob for xugu_windows_amd64_*.exe
    try {
      const binDir = join(serverRoot, "windows/amd64/XuguDB/Server/BIN");
      if (existsSync(binDir)) {
        for (const f of readdirSync(binDir)) {
          if (/^xugu_windows_amd64_.*\.exe$/.test(f)) return join(binDir, f);
        }
      }
    } catch {}
    return null;
  }
  if (platform === "linux") {
    const archDir = ar === "arm64" ? "aarch64" : "x86_64";
    const linuxDir = join(serverRoot, `linux/${archDir}/XuguDB/Server/BIN`);
    const candidates = [
      join(linuxDir, `xugu_linux_${archDir}_20250714`),
      join(linuxDir, `xugu_linux_${archDir}_20250731`)
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    try {
      if (existsSync(linuxDir)) {
        for (const f of readdirSync(linuxDir)) {
          if (new RegExp(`^xugu_linux_${archDir}_`).test(f)) return join(linuxDir, f);
        }
      }
    } catch {}
    return null;
  }
  return null;
}

function readNativePid() {
  if (!existsSync(xuguNativePidFile)) return null;
  const value = Number(readFileSync(xuguNativePidFile, "utf8").trim());
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function writeNativePid(pid) {
  mkdirSync(dirname(xuguNativePidFile), { recursive: true });
  writeFileSync(xuguNativePidFile, `${pid}\n`, { mode: 0o600 });
}

function removeNativePidFile() {
  rmSync(xuguNativePidFile, { force: true });
}

function startNativeXugu() {
  const existingPid = readNativePid();
  if (existingPid && processIsAlive(existingPid)) {
    console.log(`  虚谷原生服务已在运行（PID ${existingPid}）。`);
    return true;
  }
  const binary = xuguServerBinary();
  if (!binary) {
    console.log("  ⚠ 未找到虚谷服务端二进制 | code=XUGU_NATIVE_BINARY_MISSING");
    return false;
  }
  mkdirSync(xuguDataDir, { recursive: true });
  mkdirSync(dirname(xuguNativeLogFile), { recursive: true });
  const logFd = openSync(xuguNativeLogFile, "a");
  const child = spawn(binary, ["--child"], {
    cwd: xuguDataDir,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  closeSync(logFd);
  child.unref();
  writeNativePid(child.pid);
  console.log(`  虚谷原生服务已启动（PID ${child.pid}，监听 ${XUGU_PORT}）。`);
  return true;
}

function stopNativeXugu() {
  const pid = readNativePid();
  if (!pid || !processIsAlive(pid)) {
    removeNativePidFile();
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    const stopped = waitUntilSync(() => !processIsAlive(pid), 15_000);
    if (!stopped) {
      process.kill(pid, "SIGKILL");
    }
    removeNativePidFile();
    console.log(`  虚谷原生服务已停止（原 PID ${pid}）。`);
  } catch {
    console.log("  ⚠ 无法停止虚谷原生服务 | code=XUGU_NATIVE_STOP_FAILED");
  }
}

function waitUntilSync(check, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    const remain = Math.min(intervalMs, deadline - Date.now());
    if (remain > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, remain);
  }
  return false;
}

function nativeXuguStatus() {
  const pid = readNativePid();
  if (!pid || !processIsAlive(pid)) {
    if (existsSync(xuguNativePidFile)) removeNativePidFile();
    return null;
  }
  return `Up (PID ${pid})`;
}

// ----------------------------------------------------------------
// 虚谷容器联动（支持 docker / podman / nerdctl 等兼容 CLI）
// ----------------------------------------------------------------

const CONTAINER_CLI = setting("CONTAINER_CLI", "docker");

function dockerAvailable() {
  try {
    execFileSync(CONTAINER_CLI, ["info"], { stdio: "pipe", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function xuguContainerStatus() {
  try {
    const output = execFileSync(
      CONTAINER_CLI,
      ["ps", "-a", "--filter", `name=^${XUGU_CONTAINER}$`, "--format", "{{.Status}}"],
      { encoding: "utf8", stdio: "pipe", timeout: 5_000 }
    ).trim();
    return output || null;
  } catch {
    return null;
  }
}

function xuguImageExists() {
  try {
    execFileSync(CONTAINER_CLI, ["image", "inspect", XUGU_IMAGE], { stdio: "pipe", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function ensureXuguImage() {
  if (xuguImageExists()) return true;
  if (!xuguManifest || !xuguImageArchive || !existsSync(xuguImageArchive)) {
    console.log("  ⚠ 虚谷镜像包不存在 | code=XUGU_IMAGE_ARCHIVE_MISSING");
    return false;
  }
  if (xuguImageArchiveSha256) {
    const digest = createHash("sha256").update(readFileSync(xuguImageArchive)).digest("hex");
    if (digest !== xuguImageArchiveSha256) {
      console.log("  ⚠ 虚谷镜像包校验失败 | code=XUGU_IMAGE_ARCHIVE_INVALID");
      return false;
    }
  }
  try {
    execFileSync(CONTAINER_CLI, ["load", "-i", xuguImageArchive], { stdio: "pipe", timeout: 120_000 });
    return xuguImageExists();
  } catch {
    console.log("  ⚠ 无法加载虚谷镜像 | code=XUGU_IMAGE_LOAD_FAILED");
    return false;
  }
}

function createXuguContainer() {
  if (!ensureXuguImage()) return false;
  try {
    execFileSync(CONTAINER_CLI, [
      "run", "-d",
      "--name", XUGU_CONTAINER,
      "-p", `127.0.0.1:${XUGU_PORT}:5138`,
      "-v", `${XUGU_VOLUME}:/opt/database/Server`,
      XUGU_IMAGE
    ], { stdio: "pipe", timeout: 120_000 });
    console.log(`  已创建平台专用虚谷容器 ${XUGU_CONTAINER}。`);
    return true;
  } catch {
    console.log("  ⚠ 无法创建虚谷容器 | code=XUGU_CONTAINER_CREATE_FAILED");
    return false;
  }
}

function ensureXuguContainer() {
  const status = xuguContainerStatus();
  if (!status) {
    return createXuguContainer();
  }
  if (/^Up\b/.test(status)) {
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已在运行（${status}）。`);
    return true;
  }
  // 容器存在但未运行——自动启动
  console.log(`  虚谷容器 ${XUGU_CONTAINER} 状态为 "${status}"，正在自动启动...`);
  try {
    execFileSync(CONTAINER_CLI, ["start", XUGU_CONTAINER], { stdio: "pipe", timeout: 30_000 });
    // 应用只有在数据库迁移完成后才会通过 /health；避免把数据库凭据放入进程参数。
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已启动，等待平台健康检查确认数据库就绪。`);
    return true;
  } catch {
    console.log("  ⚠ 无法启动虚谷容器 | code=XUGU_CONTAINER_START_FAILED");
    return false;
  }
}

function stopXuguContainer() {
  const status = xuguContainerStatus();
  if (!status || !/^Up\b/.test(status)) return;
  try {
    execFileSync(CONTAINER_CLI, ["stop", XUGU_CONTAINER], { stdio: "pipe", timeout: 20_000 });
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已停止。`);
  } catch {
    console.log("  ⚠ 无法停止虚谷容器 | code=XUGU_CONTAINER_STOP_FAILED");
  }
}

function removePidFile() {
  rmSync(pidFile, { force: true });
}

function writePid(pid) {
  mkdirSync(dirname(pidFile), { recursive: true });
  const temporary = `${pidFile}.${process.pid}.tmp`;
  writeFileSync(temporary, `${pid}\n`, { mode: 0o600 });
  renameSync(temporary, pidFile);
}

async function healthIsReady() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntil(check, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise(resolveWait => setTimeout(resolveWait, intervalMs));
  }
  return false;
}

async function start() {
  const existingPid = readPid();
  if (processIsAlive(existingPid)) {
    console.log(`平台服务已在后台运行（PID ${existingPid}）。`);
    if (managesXugu && xuguLifecycle === "native") startNativeXugu();
    else if (managesXugu && dockerAvailable()) ensureXuguContainer();
    else if (xuguLifecycle === "external") console.log("虚谷数据库：外部共享模式（只连接，不管理生命周期）。");
    return;
  }
  if (existsSync(pidFile)) removePidFile();

  if (managesXugu && xuguLifecycle === "native") {
    if (!startNativeXugu()) {
      const error = new Error("native Xugu server unavailable");
      error.code = "XUGU_NATIVE_UNAVAILABLE";
      throw error;
    }
  } else if (managesXugu && dockerAvailable()) {
    if (!ensureXuguContainer()) {
      const error = new Error("managed Xugu container unavailable");
      error.code = "XUGU_CONTAINER_UNAVAILABLE";
      throw error;
    }
  } else if (managesXugu) {
    const error = new Error("container runtime unavailable");
    error.code = "CONTAINER_UNAVAILABLE";
    throw error;
  } else {
    console.log("虚谷数据库：外部共享模式（只连接，不管理生命周期）。");
  }

  mkdirSync(dirname(logFile), { recursive: true });
  const logDescriptor = openSync(logFile, "a");
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    detached: true,
    env: process.env,
    stdio: ["ignore", logDescriptor, logDescriptor]
  });
  closeSync(logDescriptor);
  child.unref();
  writePid(child.pid);

  const ready = await waitUntil(async () => {
    if (!processIsAlive(child.pid)) return true;
    return healthIsReady();
  }, 420_000);

  if (!ready || !processIsAlive(child.pid) || !(await healthIsReady())) {
    if (processIsAlive(child.pid)) process.kill(child.pid, "SIGTERM");
    removePidFile();
    if (managesXugu && xuguLifecycle === "native") stopNativeXugu();
    else if (managesXugu && dockerAvailable()) stopXuguContainer();
    const error = new Error("platform did not become healthy");
    error.code = "PLATFORM_START_HEALTH_FAILED";
    throw error;
  }

  console.log(`平台服务已在后台启动（PID ${child.pid}，${healthUrl}）。`);
}

async function stop() {
  const pid = readPid();
  if (!pid) {
    if (existsSync(pidFile)) removePidFile();
    console.log("平台服务未通过后台管理器运行。");
  } else if (!processIsAlive(pid)) {
    removePidFile();
    console.log(`已清理失效的 PID 文件（原 PID ${pid}）。`);
  } else {
    process.kill(pid, "SIGTERM");
    const stopped = await waitUntil(() => !processIsAlive(pid), 20_000);
    if (!stopped) {
      throw new Error(`平台服务未能在 20 秒内优雅停止（PID ${pid}）；未执行强制终止。`);
    }
    removePidFile();
    console.log(`平台服务已优雅停止（原 PID ${pid}）。`);
  }

  // 虚谷是默认产品运行栈的一部分；即使应用进程已退出，stop 也收口数据库状态。
  if (managesXugu && xuguLifecycle === "native") {
    stopNativeXugu();
  } else if (managesXugu && dockerAvailable()) {
    stopXuguContainer();
  } else if (xuguLifecycle === "external") {
    console.log("虚谷数据库：外部共享模式，未执行停止操作。");
  }
}

async function status() {
  const pid = readPid();
  if (!processIsAlive(pid)) {
    if (existsSync(pidFile)) removePidFile();
    console.log("平台服务未通过后台管理器运行。");
    process.exitCode = 1;
  } else {
    const health = await healthIsReady();
    console.log(`平台服务正在运行（PID ${pid}，健康检查：${health ? "正常" : "异常"}）。`);
    if (!health) process.exitCode = 1;
  }

  // 显示虚谷状态
  if (managesXugu && xuguLifecycle === "native") {
    const xuguStatus = nativeXuguStatus();
    if (xuguStatus) console.log(`虚谷原生服务：${xuguStatus}`);
    else console.log("虚谷原生服务：未运行");
  } else if (managesXugu && dockerAvailable()) {
    const xuguStatus = xuguContainerStatus();
    if (xuguStatus) {
      console.log(`虚谷容器 ${XUGU_CONTAINER}：${xuguStatus}`);
    } else {
      console.log(`虚谷容器 ${XUGU_CONTAINER}：未创建`);
    }
  } else if (managesXugu) console.log("虚谷数据库：容器运行时不可用");
  else console.log("虚谷数据库：外部共享模式（只连接，不管理生命周期）。");
}

try {
  if (!validXuguLifecycle) {
    const error = new Error("invalid Xugu lifecycle mode");
    error.code = "XUGU_LIFECYCLE_INVALID";
    throw error;
  }
  if (command === "start") await start();
  else if (command === "stop") await stop();
  else if (command === "status") await status();
  else if (command === "restart") {
    await stop();
    await start();
  } else {
    throw new Error("用法：node scripts/manage-server.mjs <start|stop|status|restart>");
  }
} catch (error) {
  console.error(`平台生命周期命令失败 | code=${error?.code ?? "PLATFORM_LIFECYCLE_FAILED"}`);
  process.exitCode = 1;
}
