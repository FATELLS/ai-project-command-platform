import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPackaged, appRoot } from "../paths.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function findRoot() {
  if (isPackaged) return appRoot;
  return fileURLToPath(new URL("../..", import.meta.url));
}

const root = findRoot();

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
// ----------------------------------------------------------------

export function isXuguBackend(path) {
  if (path !== undefined && path !== null) return false;
  if (process.env.PLATFORM_DB_BACKEND === "sqlite") return false;
  return true;
}

// ----------------------------------------------------------------
// SQLite 后端 — 基于 sql.js (WASM SQLite)
// Node 20 没有 node:sqlite 模块（Node 22 才有），
// 改用 sql.js 作为 SQLite 引擎。
//
// sql.js 初始化是异步的（WASM 编译），
// 在模块加载时用 top-level await 预初始化。
// 之后所有 openDatabase(path) 调用都是同步的。
// ----------------------------------------------------------------

let _SQL = null;

/**
 * 同步初始化 sql.js。
 * 用子进程预编译 WASM 并传回序列化结果，
 * 主进程同步等待子进程退出。
 */
function initSqlJsSync() {
  if (_SQL) return _SQL;

  const { execSync } = require("child_process");
  const initSqlJsModule = require.resolve("sql.js");
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");

  // 在子进程中异步初始化，然后把编译好的 Module 序列化
  // 但 Module 含 WASM memory 引用，不能跨进程序列化
  // 所以直接在当前进程用 eval + 同步 hack

  // 最终方案：sql.js 初始化在 top-level await 中完成
  // 此函数只作为 fallback，正常不会到这里
  throw new Error(
    "sql.js not initialized. This should not happen — the module-level await should have run."
  );
}

// Top-level await: 模块加载时预初始化 sql.js
// 这只会延迟一次（约 50ms），之后所有调用同步
try {
  const initSqlJs = require("sql.js");
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  _SQL = await initSqlJs({ locateFile: () => wasmPath });
} catch (e) {
  // sql.js 不可用（生产环境不需要 SQLite）
  // 延迟到实际调用时报错
}

export function openDatabase(path, options = {}) {
  if (isXuguBackend(path)) {
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

  if (!_SQL) {
    throw new Error(
      "SQLite backend (sql.js) failed to initialize. " +
      "If you only need the Xugu backend, call openDatabase() without a path argument."
    );
  }

  let db;
  if (path === ":memory:") {
    db = new _SQL.Database();
  } else {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    if (existsSync(path)) {
      const buffer = readFileSync(path);
      db = new _SQL.Database(buffer);
    } else {
      db = new _SQL.Database();
    }
  }

  const wrapper = new SqlJsDatabaseSync(db, path);
  wrapper._backend = "sqlite";
  return wrapper;
}

// ----------------------------------------------------------------
// SqlJsDatabaseSync — 兼容 DatabaseSync 接口
// ----------------------------------------------------------------

class SqlJsDatabaseSync {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this._isOpen = true;
    this._dirty = false;
  }

  get isOpen() {
    return this._isOpen;
  }

  get isTransaction() {
    return this._inTransaction || false;
  }

  exec(sql) {
    if (!this._isOpen) throw new Error("Database is closed");
    // sql.js 的 run() 可以执行多条语句
    this.db.run(sql);
    this._dirty = true;
  }

  prepare(sql) {
    if (!this._isOpen) throw new Error("Database is closed");
    return new SqlJsStatement(this.db, sql, this);
  }

  close() {
    if (this._isOpen) {
      this._persist();
      this.db.close();
      this._isOpen = false;
    }
  }

  _persist() {
    if (this.path && this.path !== ":memory:" && this._dirty) {
      const data = this.db.export();
      writeFileSync(this.path, Buffer.from(data));
      this._dirty = false;
    }
  }
}

class SqlJsStatement {
  constructor(db, sql, database) {
    this.db = db;
    this.sql = sql;
    this.database = database;
  }

  _prepare() {
    // sql.js 的 prepare 每次返回一个新的 Statement，用完需要 free()
    return this.db.prepare(this.sql);
  }

  get(...params) {
    const stmt = this._prepare();
    stmt.bind(params);
    let row;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  }

  all(...params) {
    const stmt = this._prepare();
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  run(...params) {
    this.db.run(this.sql, params);
    this.database._dirty = true;
    // sql.js 不直接返回 changes/lastInsertRowid
    const changes = this.db.getRowsModified();
    return { changes, lastInsertRowid: null };
  }
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
