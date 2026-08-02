#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] ?? "status";

// 虚谷容器名称——与 src/db/xugu-database.cjs 的默认值保持一致
const XUGU_CONTAINER = process.env.XUGU_CONTAINER || "xugu-dev";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => line.startsWith("export ") ? line.slice(7).trim() : line)
    .map(line => {
      const separator = line.indexOf("=");
      if (separator < 1) return null;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [key, value];
    })
    .filter(Boolean));
}

const fileEnvironment = {
  ...readEnvFile(resolve(rootDir, ".env")),
  ...readEnvFile(resolve(rootDir, ".env.local"))
};

function setting(name, fallback) {
  return process.env[name] ?? fileEnvironment[name] ?? fallback;
}

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
// 虚谷 Docker 容器联动
// ----------------------------------------------------------------

function dockerAvailable() {
  try {
    execSync("docker info", { stdio: "pipe", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function xuguContainerStatus() {
  try {
    const output = execSync(
      `docker ps -a --filter name=^${XUGU_CONTAINER}$ --format "{{.Status}}"`,
      { encoding: "utf8", stdio: "pipe", timeout: 5_000 }
    ).trim();
    return output || null;
  } catch {
    return null;
  }
}

function ensureXuguContainer() {
  const status = xuguContainerStatus();
  if (!status) {
    console.log(`  ⚠ 虚谷容器 ${XUGU_CONTAINER} 不存在，请先创建（docker run ...）。`);
    return false;
  }
  if (/^Up\b/.test(status)) {
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已在运行（${status}）。`);
    return true;
  }
  // 容器存在但未运行——自动启动
  console.log(`  虚谷容器 ${XUGU_CONTAINER} 状态为 "${status}"，正在自动启动...`);
  try {
    execSync(`docker start ${XUGU_CONTAINER}`, { stdio: "pipe", timeout: 30_000 });
    // 等待容器内 xgconsole 可用（最多重试 3 次，每次等 2 秒）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync(
          `docker exec ${XUGU_CONTAINER} /XGDBMS/BIN/xgconsole-linux-arm64 nssl 127.0.0.1 5138 SYSTEM SYSDBA SYSDBA -c "SELECT 1"`,
          { stdio: "pipe", timeout: 10_000 }
        );
        console.log(`  虚谷容器 ${XUGU_CONTAINER} 已启动并就绪。`);
        return true;
      } catch {
        if (attempt < 3) {
          const { sleepSync } = { sleepSync: ms => execSync(`sleep ${ms / 1000}`) };
          sleepSync(2_000);
        }
      }
    }
    // xgconsole 可能还在初始化，但容器已启动——继续走，让数据库连接层自己重试
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已启动（数据库初始化中）。`);
    return true;
  } catch (error) {
    console.log(`  ⚠ 无法启动虚谷容器：${error.message}`);
    return false;
  }
}

function stopXuguContainer() {
  const status = xuguContainerStatus();
  if (!status || !/^Up\b/.test(status)) return;
  try {
    execSync(`docker stop ${XUGU_CONTAINER}`, { stdio: "pipe", timeout: 20_000 });
    console.log(`  虚谷容器 ${XUGU_CONTAINER} 已停止。`);
  } catch (error) {
    console.log(`  ⚠ 无法停止虚谷容器：${error.message}`);
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
    ensureXuguContainer();
    return;
  }
  if (existsSync(pidFile)) removePidFile();

  // 先确保虚谷容器在运行（SQLite 后端跳过）
  const isSqliteBackend = process.env.PLATFORM_DB_BACKEND === "sqlite";
  if (!isSqliteBackend && dockerAvailable()) {
    ensureXuguContainer();
  } else if (!isSqliteBackend) {
    console.log(`  ⚠ Docker 未运行或不可用，跳过虚谷容器检查。`);
    console.log(`    如果后端是虚谷数据库，平台启动后将无法连接。`);
  }

  mkdirSync(dirname(logFile), { recursive: true });
  const logDescriptor = openSync(logFile, "a");
  // 构建 Node 启动参数，兼容 Node 20（无 --env-file-if-exists）
  const nodeArgs = [];
  const envFiles = [".env", ".env.local"].filter(f => existsSync(join(rootDir, f)));
  for (const f of envFiles) nodeArgs.push(`--env-file=${f}`);
  nodeArgs.push("server.mjs");

  const child = spawn(process.execPath, nodeArgs, {
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
  }, 15_000);

  if (!ready || !processIsAlive(child.pid) || !(await healthIsReady())) {
    if (processIsAlive(child.pid)) process.kill(child.pid, "SIGTERM");
    removePidFile();
    throw new Error(`平台服务启动失败，请查看日志：${logFile}`);
  }

  console.log(`平台服务已在后台启动（PID ${child.pid}，${healthUrl}）。`);
}

async function stop() {
  const pid = readPid();
  if (!pid) {
    if (existsSync(pidFile)) removePidFile();
    console.log("平台服务未通过后台管理器运行。");
    return;
  }
  if (!processIsAlive(pid)) {
    removePidFile();
    console.log(`已清理失效的 PID 文件（原 PID ${pid}）。`);
    return;
  }

  process.kill(pid, "SIGTERM");
  const stopped = await waitUntil(() => !processIsAlive(pid), 20_000);
  if (!stopped) {
    throw new Error(`平台服务未能在 20 秒内优雅停止（PID ${pid}）；未执行强制终止。`);
  }
  removePidFile();
  console.log(`平台服务已优雅停止（原 PID ${pid}）。`);

  // 如果是虚谷后端且平台启动了容器，一并关闭
  // SQLite 后端不碰虚谷容器
  const isSqliteBackend = process.env.PLATFORM_DB_BACKEND === "sqlite";
  if (!isSqliteBackend && dockerAvailable() && process.env.PLATFORM_STOP_XUGU !== "0") {
    stopXuguContainer();
  }
}

async function status() {
  const pid = readPid();
  if (!processIsAlive(pid)) {
    if (existsSync(pidFile)) removePidFile();
    console.log("平台服务未通过后台管理器运行。");
    process.exitCode = 1;
    return;
  }
  const health = await healthIsReady();
  console.log(`平台服务正在运行（PID ${pid}，健康检查：${health ? "正常" : "异常"}）。`);
  if (!health) process.exitCode = 1;

  // 显示虚谷容器状态
  if (dockerAvailable()) {
    const xuguStatus = xuguContainerStatus();
    if (xuguStatus) {
      console.log(`虚谷容器 ${XUGU_CONTAINER}：${xuguStatus}`);
    } else {
      console.log(`虚谷容器 ${XUGU_CONTAINER}：未创建`);
    }
  }
}

try {
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
  console.error(error.message);
  process.exitCode = 1;
}
