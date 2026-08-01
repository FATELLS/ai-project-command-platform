// ============================================================
// xugu-database.cjs — 虚谷数据库适配层 (原生 TCP 驱动)
//
// 使用虚谷官方 Node.js 原生驱动 xugudbjs.node 直连数据库。
// 替代旧的 docker exec + xgconsole 文本解析方案。
//
// 驱动 API:
//   - createConnection(connStr) → XGConnection
//   - conn.connect()
//   - conn.query(sql, params?, callback) — 回调同步触发
//   - conn.beginTransaction(callback)
//   - conn.commit(callback)
//   - conn.rollback(callback)
//   - conn.disconnect()
//
// 返回值: 行数组 [{COL1: val, COL2: val}, ...]
// 列名统一大写，本适配层统一转小写以兼容上层代码。
// ============================================================

const { existsSync } = require("fs");
const { join } = require("path");
const { platform, arch } = require("os");

// ----------------------------------------------------------------
// 加载原生驱动
// ----------------------------------------------------------------

function loadDriver() {
  // 尝试按平台/架构选择正确的 .node 文件
  const candidates = [];

  if (platform() === "darwin" && arch() === "arm64") {
    candidates.push(join(__dirname, "..", "..", "vendor", "xugudb", "nodejs", "xugudbjs.node"));
  } else if (platform() === "linux" && arch() === "arm64") {
    candidates.push(join(__dirname, "..", "..", "vendor", "xugudb", "nodejs", "xugudbjs-linux-aarch64.node"));
  }

  // 通用 fallback
  candidates.push(join(__dirname, "..", "..", "vendor", "xugudb", "nodejs", "xugudbjs.node"));

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return require(p);
      } catch (e) {
        throw new Error(`Failed to load XuguDB native driver at ${p}: ${e.message}`);
      }
    }
  }

  throw new Error(
    `XuguDB native driver not found. Looked for:\n${candidates.join("\n")}\n` +
    `Platform: ${platform()}/${arch()}. Please download from https://xugudb.com/download`
  );
}

// ----------------------------------------------------------------
// 配置
// ----------------------------------------------------------------

const XUGU_HOST = process.env.XUGU_HOST || "127.0.0.1";
const XUGU_PORT = process.env.XUGU_PORT || "5138";
const XUGU_USER = process.env.XUGU_USER || "SYSDBA";
const XUGU_PASSWORD = process.env.XUGU_PASSWORD || "SYSDBA";
const XUGU_DATABASE = process.env.XUGU_DATABASE || "SYSTEM";

// ----------------------------------------------------------------
// 同步执行包装
// 驱动的 callback 是同步触发的（C++ 层面阻塞执行）
// 但为了防止极端异步场景，用 err/result 变量捕获
// ----------------------------------------------------------------

function execSync(conn, sql, params) {
  let error = null;
  let result = null;

  if (params && params.length > 0) {
    conn.query(sql, params, function (err, rows) {
      error = err;
      result = rows;
    });
  } else {
    conn.query(sql, function (err, rows) {
      error = err;
      result = rows;
    });
  }

  if (error) {
    const msg = error.message || String(error);
    const err = new Error(msg);
    err.cause = error;
    throw err;
  }
  return result;
}

// ----------------------------------------------------------------
// 行处理: 大写列名 → 小写
// ----------------------------------------------------------------

function lowercaseRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) {
      out[key.toLowerCase()] = row[key];
    }
    return out;
  });
}

// ----------------------------------------------------------------
// 从 SQL 中提取 AS 别名映射（小写 → 原始大小写）
// 例如：SELECT col AS myField FROM t → { "myfield": "myField" }
// ----------------------------------------------------------------

function extractAliases(sql) {
  const map = {};
  const regex = /\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    const alias = match[1];
    map[alias.toLowerCase()] = alias;
  }
  return map;
}

// ----------------------------------------------------------------
// XuguStatement — 兼容 SQLite StatementSync 接口
// ----------------------------------------------------------------

class XuguStatement {
  constructor(connection, sql) {
    this.conn = connection;
    this.sql = sql;
    this.aliasMap = extractAliases(sql);
  }

  get(...params) {
    const rows = this._execute(params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  all(...params) {
    return this._execute(params);
  }

  run(...params) {
    const rows = this._execute(params);
    // 对于 INSERT/UPDATE/DELETE，rows 可能是空数组或受影响行数信息
    return { changes: rows ? rows.length || 0 : 0, lastInsertRowid: null };
  }

  _execute(params) {
    let result;
    try {
      result = execSync(this.conn, this.sql, params.length > 0 ? params : undefined);
    } catch (error) {
      if (isIgnorableError(this.sql, error)) return [];
      throw error;
    }

    if (!result || !Array.isArray(result)) return [];

    // 转小写列名
    const rows = lowercaseRows(result);

    // 恢复驼峰别名
    if (this.aliasMap && Object.keys(this.aliasMap).length > 0) {
      for (const row of rows) {
        for (const lowerKey of Object.keys(row)) {
          const originalCase = this.aliasMap[lowerKey];
          if (originalCase && originalCase !== lowerKey) {
            row[originalCase] = row[lowerKey];
            delete row[lowerKey];
          }
        }
      }
    }

    return rows;
  }
}

// ----------------------------------------------------------------
// XuguDatabaseSync — 兼容 SQLite DatabaseSync 接口
// ----------------------------------------------------------------

class XuguDatabaseSync {
  constructor(options = {}) {
    this.isTransaction = false;
    this._backend = "xugu";

    const driver = loadDriver();

    const host = options.host || XUGU_HOST;
    const port = options.port || XUGU_PORT;
    const user = options.user || XUGU_USER;
    const pwd = options.password || XUGU_PASSWORD;
    const db = options.database || XUGU_DATABASE;

    const connStr = `IP=${host};Port=${port};Database=${db};USER=${user};PWD=${pwd}`;

    this.conn = driver.createConnection(connStr);
    this.conn.connect();

    this._isOpen = true;
  }

  get isOpen() {
    return this._isOpen;
  }

  exec(sql) {
    if (!this._isOpen) throw new Error("Connection is not open");

    if (this.isTransaction) {
      // 在事务中，缓冲 SQL 但仍逐条执行（原生驱动不支持多语句）
      // 保持与旧实现一致的行为
    }

    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        execSync(this.conn, trimmed);
      } catch (error) {
        if (isIgnorableError(trimmed, error)) continue;
        throw error;
      }
    }
  }

  prepare(sql) {
    if (!this._isOpen) throw new Error("Connection is not open");
    return new XuguStatement(this.conn, sql);
  }

  close() {
    if (this._isOpen && this.conn) {
      try {
        this.conn.disconnect();
      } catch {
        // ignore
      }
      this._isOpen = false;
    }
  }
}

// ----------------------------------------------------------------
// 辅助函数
// ----------------------------------------------------------------

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === ";" && !inSingleQuote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function isIgnorableError(sql, error) {
  const msg = error.message || "";
  if (/already\s+exists|duplicate|已存在/i.test(msg)) {
    if (/CREATE/i.test(sql)) return true;
    if (/ALTER.*ADD/i.test(sql)) return true;
  }
  return false;
}

// ----------------------------------------------------------------
// 公共 API
// ----------------------------------------------------------------

function openXuguDatabase(options = {}) {
  return new XuguDatabaseSync(options);
}

module.exports = {
  XuguDatabaseSync,
  XuguStatement,
  openXuguDatabase,
};
