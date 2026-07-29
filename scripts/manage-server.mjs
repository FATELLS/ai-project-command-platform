#!/usr/bin/env node

import { spawn } from "node:child_process";
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
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] ?? "status";

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
    return;
  }
  if (existsSync(pidFile)) removePidFile();

  mkdirSync(dirname(logFile), { recursive: true });
  const logDescriptor = openSync(logFile, "a");
  const child = spawn(process.execPath, [
    "--env-file-if-exists=.env",
    "--env-file-if-exists=.env.local",
    "server.mjs"
  ], {
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
