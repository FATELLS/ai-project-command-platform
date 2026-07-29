import { mkdirSync } from "node:fs";
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

export function defaultDataDir() {
  return process.env.PLATFORM_DATA_DIR
    ? resolve(process.env.PLATFORM_DATA_DIR)
    : join(root, "data");
}

export function defaultDatabasePath() {
  return join(defaultDataDir(), "platform.sqlite");
}

// ----------------------------------------------------------------
// 数据库后端选择
// DB_BACKEND=sqlite (默认) | DB_BACKEND=xugu
// ----------------------------------------------------------------

const DB_BACKEND = process.env.DB_BACKEND || process.env.PLATFORM_DB_BACKEND || "sqlite";

export function isXuguBackend() {
  return DB_BACKEND === "xugu";
}

let _xuguModule = null;

async function loadXuguModule() {
  if (!_xuguModule) {
    // odbc 是 CJS 包，用 createRequire 加载
    const require = createRequire(import.meta.url);
    _xuguModule = require("./xugu-database.cjs");
  }
  return _xuguModule;
}

export function openDatabase(path = defaultDatabasePath(), options = {}) {
  if (isXuguBackend()) {
    // 虚谷后端：同步加载 CJS 模块
    const require = createRequire(import.meta.url);
    const { openXuguDatabase } = require("./xugu-database.cjs");
    return openXuguDatabase({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
    });
  }
  return openSqliteBackend(path, options);
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
