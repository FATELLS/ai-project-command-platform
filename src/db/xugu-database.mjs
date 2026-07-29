// ============================================================
// xugu-database.mjs — 虚谷数据库同步适配层
//
// 提供与 node:sqlite DatabaseSync 完全兼容的同步 API:
//   - openXuguDatabase() → XuguDatabaseSync
//   - db.exec(sql)
//   - db.prepare(sql) → { get, all, run }
//   - withTransaction(db, fn)
//
// 底层通过 odbc npm 包的同步 API (querySync) 连接虚谷数据库
// ============================================================

import odbc from "odbc";

// ----------------------------------------------------------------
// 连接字符串构建
// ----------------------------------------------------------------

export function buildXuguConnectionString(options = {}) {
  const host = options.host || process.env.XUGU_HOST || "127.0.0.1";
  const port = options.port || process.env.XUGU_PORT || "5138";
  const user = options.user || process.env.XUGU_USER || "SYSDBA";
  const password = options.password || process.env.XUGU_PASSWORD || "SYSDBA";
  const database = options.database || process.env.XUGU_DATABASE || "SYSTEM";
  return `Driver={Xugu};HOST=${host};PORT=${port};UID=${user};PWD=${password};DATABASE=${database};`;
}

let _connection = null;

export function getXuguConnection(options = {}) {
  if (_connection) return _connection;
  const connStr = buildXuguConnectionString(options);
  // 使用同步连接
  _connection = odbc.connectSync(connStr);
  return _connection;
}

export function closeXuguConnection() {
  if (_connection) {
    try { _connection.closeSync(); } catch { /* ignore */ }
    _connection = null;
  }
}

// ----------------------------------------------------------------
// XuguStatement — 同步 prepared statement
// 接口与 node:sqlite StatementSync 完全一致
// ----------------------------------------------------------------

class XuguStatement {
  constructor(connection, sql) {
    this.connection = connection;
    this.sql = sql;
  }

  // .get(...params) → 返回一行或 undefined
  get(...params) {
    const flat = normalizeParams(params);
    try {
      const result = this.connection.querySync(this.sql, flat);
      if (!result || result.length === 0) return undefined;
      return normalizeRow(result[0]);
    } catch (error) {
      throw enhanceError(error, this.sql, flat);
    }
  }

  // .all(...params) → 返回行数组
  all(...params) {
    const flat = normalizeParams(params);
    try {
      const result = this.connection.querySync(this.sql, flat);
      if (!result) return [];
      return result.map(normalizeRow);
    } catch (error) {
      throw enhanceError(error, this.sql, flat);
    }
  }

  // .run(...params) → { changes, lastInsertRowid }
  run(...params) {
    const flat = normalizeParams(params);
    try {
      const result = this.connection.querySync(this.sql, flat);
      const changes = result?.count || result?.rowsAffected || 0;
      const lastInsertRowid = result?.lastInsertId || null;
      return { changes, lastInsertRowid };
    } catch (error) {
      throw enhanceError(error, this.sql, flat);
    }
  }
}

// ----------------------------------------------------------------
// XuguDatabaseSync — 与 DatabaseSync 完全兼容
// ----------------------------------------------------------------

export class XuguDatabaseSync {
  constructor(connection) {
    this.connection = connection;
    this.isTransaction = false;
  }

  exec(sql) {
    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        this.connection.querySync(trimmed);
      } catch (error) {
        if (isIgnorableError(trimmed, error)) continue;
        throw enhanceError(error, trimmed, []);
      }
    }
  }

  prepare(sql) {
    return new XuguStatement(this.connection, sql);
  }

  close() {
    // 连接由 getXuguConnection 管理，不在这里关闭
  }
}

// ----------------------------------------------------------------
// 辅助函数
// ----------------------------------------------------------------

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  // odbc 返回的 Row 对象可能不是普通 object，需要转换
  const result = {};
  for (const key of Object.keys(row)) {
    const val = row[key];
    // odbc 可能返回 Buffer 或特殊类型，统一处理
    if (Buffer.isBuffer(val)) {
      result[key] = val.toString("utf8");
    } else {
      result[key] = val;
    }
  }
  return result;
}

function enhanceError(error, sql, params) {
  const msg = error?.message || String(error);
  const err = new Error(`[Xugu] ${msg}`);
  err.cause = error;
  err.sql = sql.substring(0, 500);
  err.params = params;
  return err;
}

function isIgnorableError(sql, error) {
  const msg = error?.message || "";
  // "already exists" 类型错误
  if (/already\s+exists|duplicate|已存在/i.test(msg)) {
    if (/CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql)) return true;
    if (/CREATE\s+TABLE/i.test(sql)) return true;
    if (/CREATE\s+TRIGGER/i.test(sql)) return true;
    if (/ALTER\s+TABLE.*ADD/i.test(sql)) return true;
  }
  return false;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// ----------------------------------------------------------------
// 公共 API — 与 database.mjs 的 openDatabase 完全兼容
// ----------------------------------------------------------------

export function openXuguDatabase(options = {}) {
  const conn = getXuguConnection(options);
  return new XuguDatabaseSync(conn);
}

export function withXuguTransaction(database, operation, mode = "IMMEDIATE") {
  if (database.isTransaction) return operation();
  const beginSql = mode === "EXCLUSIVE" ? "BEGIN EXCLUSIVE" : "BEGIN";
  database.connection.querySync(beginSql);
  database.isTransaction = true;
  try {
    const result = operation();
    database.connection.querySync("COMMIT");
    return result;
  } catch (error) {
    try {
      database.connection.querySync("ROLLBACK");
    } catch { /* ignore */ }
    throw error;
  } finally {
    database.isTransaction = false;
  }
}
