import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const rootDir = resolve(import.meta.dirname, "..");
const managerPath = resolve(rootDir, "scripts/manage-server.mjs");

async function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function runManager(command, environment) {
  return spawnSync(process.execPath, [managerPath, command], {
    cwd: rootDir,
    env: environment,
    encoding: "utf8",
    timeout: 30_000
  });
}

test("background lifecycle starts, reports, and gracefully stops only the platform process", async () => {
  const runtimeDir = mkdtempSync(resolve(tmpdir(), "ai-platform-lifecycle-"));
  const port = await findFreePort();
  const environment = {
    ...process.env,
    PORT: String(port),
    PLATFORM_DATA_DIR: resolve(runtimeDir, "data"),
    PLATFORM_DB_BACKEND: "sqlite",
    PLATFORM_RUNTIME_PID_FILE: resolve(runtimeDir, "server.pid"),
    PLATFORM_RUNTIME_LOG_FILE: resolve(runtimeDir, "app.log"),
    PLATFORM_BOOTSTRAP_PASSWORD: "LifecycleTest-Only-123!",
    AI_CHAT_PROVIDER: "disabled",
    AI_GENERATION_PROVIDER: "disabled"
  };

  try {
    const started = runManager("start", environment);
    assert.equal(started.status, 0, started.stderr || started.stdout);
    assert.match(started.stdout, /后台启动/);

    const pid = Number(readFileSync(environment.PLATFORM_RUNTIME_PID_FILE, "utf8").trim());
    assert.ok(Number.isSafeInteger(pid) && pid > 0);

    const status = runManager("status", environment);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /健康检查：正常/);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.ok, true);

    const stopped = runManager("stop", environment);
    assert.equal(stopped.status, 0, stopped.stderr || stopped.stdout);
    assert.match(stopped.stdout, /优雅停止/);
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
  } finally {
    runManager("stop", environment);
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test("lifecycle manager has no database-container shutdown command", () => {
  const source = readFileSync(managerPath, "utf8");
  assert.doesNotMatch(source, /docker\s+(?:stop|kill|rm)|xugu-dev|5138/i);
});
