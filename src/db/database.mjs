import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { isPackaged, appRoot } from "../paths.mjs";
import { createRequire } from "node:module";

function findRoot() {
  if (isPackaged) return appRoot;
  return fileURLToPath(new URL("../..", import.meta.url));
}

const root = findRoot();

/**
 * 检测是否在 npx 缓存目录中运行。
 * npx 会把包解压到 ~/.npm/_npx/<hash>/node_modules/<pkg>，
 * 清缓存或 hash 变化会导致数据丢失。
 * 检测到时 fallback 到用户主目录下的稳定路径。
 */
function isNpxCache() {
  return root.includes("_npx") || root.includes(join("npm", "_npx")) || root.includes(".npm/_npx");
}

function stableUserDataDir() {
  return join(homedir(), ".ai-project-command-platform", "data");
}

export function defaultDataDir() {
  if (process.env.PLATFORM_DATA_DIR) return resolve(process.env.PLATFORM_DATA_DIR);
  if (isNpxCache()) return stableUserDataDir();
  return join(root, "data");
}

export function defaultDatabasePath() {
  return join(defaultDataDir(), "platform.sqlite");
}

// ----------------------------------------------------------------
// 数据库后端选择
// 虚谷是唯一的生产数据库后端。
// SQLite 仅用于单元测试/集成测试。
//
// 判定规则（openDatabase 无参时）：
//   - PLATFORM_DB_BACKEND=sqlite → 测试覆盖，走 SQLite
//   - 否则 → 虚谷（生产）
//   openDatabase(path) → 传了路径 → 始终 SQLite
// ----------------------------------------------------------------

export function isXuguBackend(path) {
  // 显式传了路径 → SQLite 测试
  if (path !== undefined && path !== null) return false;
  // 测试覆盖标志
  if (process.env.PLATFORM_DB_BACKEND === "sqlite") return false;
  // 生产环境 → 虚谷
  return true;
}

export function openDatabase(path, options = {}) {
  if (isXuguBackend(path)) {
    // 虚谷后端（生产默认）
    const require = createRequire(import.meta.url);
    const { openXuguDatabase } = require("./xugu-database.cjs");
    const db = openXuguDatabase({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
    });
    db._backend = "xugu";
    return db;
  }
  // SQLite 后端（测试路径）
  const db = openSqliteBackend(path, options);
  db._backend = "sqlite";
  return db;
}

function openSqliteBackend(path, options) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const database = new DatabaseSync(path, {
    timeout: options.timeout ?? 5_000,
    readOnly: options.readOnly ?? false,
    enableForeignKeyConstraints: true
  });
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`PRAGMA busy_timeout = ${Number(options.timeout ?? 5_000)}`);
  if (!options.readOnly && path !== ":memory:") database.exec("PRAGMA journal_mode = DELETE");
  if (!options.readOnly && path !== ":memory:") database.exec("PRAGMA synchronous = FULL");
  return database;
}

export function withTransaction(database, operation, mode = "IMMEDIATE") {
  if (database.isTransaction) return operation();
  database.exec(`BEGIN ${mode}`);
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  }
}
