#!/usr/bin/env node

// 兼容 Node 20 和 Node 22 的启动脚本
// Node 22 支持 --env-file-if-exists，Node 20 只支持 --env-file（文件不存在则报错）
// 此脚本检测 .env/.env.local 是否存在，按需添加 --env-file 参数

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const nodeArgs = [];
for (const f of [".env", ".env.local"]) {
  if (existsSync(join(rootDir, f))) {
    nodeArgs.push(`--env-file=${f}`);
  }
}
nodeArgs.push("server.mjs");

const child = spawn(process.execPath, nodeArgs, {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
