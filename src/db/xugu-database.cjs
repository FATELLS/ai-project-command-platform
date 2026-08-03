// ============================================================
// xugu-database.cjs — 虚谷数据库适配层 (原生 TCP 驱动)
//
// 使用虚谷官方 Node.js 原生驱动 xugudbjs.node 直连数据库。
// 替代旧的 docker exec + xgconsole 文本解析方案。
//
// 驱动 API:
//   - createConnection(connStr) → XGConnection
//   - conn.connect()
//   - conn.query(sql, params?, callback)
//   - conn.beginTransaction()
//   - conn.commit()
//   - conn.rollback()
//   - conn.disconnect()
//
// 返回值: 行数组 [{COL1: val, COL2: val}, ...]
// 列名统一大写，本适配层统一转小写以兼容上层代码。
// ============================================================

const { existsSync } = require("fs");
const { join } = require("path");
const { platform, arch } = require("os");
const { Worker } = require("worker_threads");

// ----------------------------------------------------------------
// 加载原生驱动
// ----------------------------------------------------------------

function driverPath() {
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
        return p;
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
const XUGU_CHARSET = process.env.XUGU_CHARSET || "UTF8";

// ----------------------------------------------------------------
// 同步执行包装
// 上层仓储保持同步事务接口；Worker 独占连接并完整消费驱动回调，
// 主线程通过 SharedArrayBuffer 等待结果，避免回调跨查询串扰。
// ----------------------------------------------------------------

class XuguWorkerClient {
  constructor(connectionString) {
    this.controlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
    this.outputBuffer = new SharedArrayBuffer(32 * 1024 * 1024);
    this.control = new Int32Array(this.controlBuffer);
    this.output = new Uint8Array(this.outputBuffer);
    this.worker = new Worker(join(__dirname, "xugu-worker.cjs"), {
      workerData: {
        connectionString,
        driverPath: driverPath(),
        control: this.controlBuffer,
        output: this.outputBuffer
      }
    });
    try {
      this._wait();
    } catch (error) {
      this.worker.terminate();
      throw error;
    }
  }

  _wait(timeout = 180_000) {
    const status = Atomics.wait(this.control, 0, 0, timeout);
    if (status === "timed-out") throw new Error("Xugu worker request timed out");
    const length = Atomics.load(this.control, 1);
    const failed = Atomics.load(this.control, 2) === 1;
    const response = Buffer.from(this.output.slice(0, length)).toString("utf8");
    Atomics.store(this.control, 0, 0);
    const payload = JSON.parse(response);
    if (failed) throw new Error(payload.message || "Xugu worker request failed");
    return payload;
  }

  request(action, payload = {}) {
    this.worker.postMessage({ action, ...payload });
    return this._wait();
  }

  close() {
    try { this.request("close"); } finally { this.worker.terminate(); }
  }

  discard() {
    this.worker.terminate();
  }
}

function execSync(client, sql, params) {
  const expanded = params?.length ? expandNullParameters(sql, params) : { sql, params: [] };
  const encodedParams = expanded.params.map(value => value === "" ? " " : value);
  return client.request("query", { sql: expanded.sql, params: encodedParams }).rows;
}

// The native driver is inconsistent when binding null. Keep SQL structure and
// parameter order intact while emitting the standard NULL literal instead.
function expandNullParameters(sql, params) {
  let output = "";
  let inSingleQuote = false;
  let parameterIndex = 0;
  const retained = [];
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === "'" && inSingleQuote && sql[index + 1] === "'") {
      output += "''";
      index += 1;
      continue;
    }
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      output += char;
      continue;
    }
    if (char === "?" && !inSingleQuote) {
      if (parameterIndex >= params.length) throw new Error("Not enough Xugu query parameters");
      const value = params[parameterIndex++];
      if (value === null || value === undefined) output += "NULL";
      else {
        output += "?";
        retained.push(value);
      }
      continue;
    }
    output += char;
  }
  if (parameterIndex !== params.length) throw new Error("Too many Xugu query parameters");
  return { sql: output, params: retained };
}

// ----------------------------------------------------------------
// 行处理: 大写列名 → 小写，并恢复业务层的空字符串语义。
// ----------------------------------------------------------------

function lowercaseRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (value instanceof ArrayBuffer) {
        out[key.toLowerCase()] = Buffer.from(value).toString("utf8");
      } else if (ArrayBuffer.isView(value)) {
        out[key.toLowerCase()] = Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
      } else {
        out[key.toLowerCase()] = value === " " ? "" : value;
      }
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
// XuguStatement — 平台同步查询接口
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
    this._execute(params);
    const command = this.sql.trimStart().match(/^([a-z]+)/i)?.[1]?.toUpperCase();
    if (!["INSERT", "UPDATE", "DELETE", "MERGE"].includes(command)) {
      return { changes: 0, lastInsertRowid: null };
    }
    if (command !== "INSERT") return { changes: 1, lastInsertRowid: null };
    // LAST_INSERT_ID() is only valid after an INSERT into an identity table.
    // Platform callers only consume it for immutable project versions.
    if (!/^\s*INSERT\s+INTO\s+project_versions\b/i.test(this.sql)) {
      return { changes: 1, lastInsertRowid: null };
    }
    const identityRows = lowercaseRows(execSync(this.conn, "SELECT LAST_INSERT_ID() AS last_insert_rowid"));
    return { changes: 1, lastInsertRowid: identityRows[0]?.last_insert_rowid ?? null };
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
// XuguDatabaseSync — 平台同步数据库接口
// ----------------------------------------------------------------

class XuguDatabaseSync {
  constructor(options = {}) {
    this.isTransaction = false;
    this._backend = "xugu";

    const host = options.host || XUGU_HOST;
    const port = options.port || XUGU_PORT;
    const user = options.user || XUGU_USER;
    const pwd = options.password || XUGU_PASSWORD;
    const db = options.database || XUGU_DATABASE;
    const charset = options.charset || XUGU_CHARSET;

    this._options = { host, port, user, password: pwd, database: db, charset };

    const connStr = `IP=${host};Port=${port};Database=${db};USER=${user};PWD=${pwd};CHAR_SET=${charset}`;

    this.conn = new XuguWorkerClient(connStr);

    this._isOpen = true;
  }

  get isOpen() {
    return this._isOpen;
  }

  exec(sql) {
    if (!this._isOpen) throw new Error("Connection is not open");

    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      // 将文本事务命令交给虚谷原生事务 API。
      const upper = trimmed.toUpperCase();
      if (upper === "BEGIN EXCLUSIVE" || upper === "BEGIN IMMEDIATE") {
        // 虚谷用原生驱动的事务 API
        this._beginTx();
        continue;
      }
      if (upper.startsWith("BEGIN")) {
        this._beginTx();
        continue;
      }
      if (upper === "COMMIT") {
        this._commitTx();
        continue;
      }
      if (upper === "ROLLBACK") {
        this._rollbackTx();
        continue;
      }

      try {
        execSync(this.conn, trimmed);
      } catch (error) {
        if (isIgnorableError(trimmed, error)) continue;
        const preview = trimmed.substring(0, 80).replace(/\n/g, " ");
        error.message = `${error.message} [SQL: ${preview}...]`;
        throw error;
      }
    }
  }

  _beginTx() {
    this.conn.request("begin");
    this.isTransaction = true;
  }

  _commitTx() {
    this.conn.request("commit");
    this.isTransaction = false;
  }

  _rollbackTx() {
    this.conn.request("rollback");
    this.isTransaction = false;
  }

  prepare(sql) {
    if (!this._isOpen) throw new Error("Connection is not open");
    return new XuguStatement(this.conn, sql);
  }

  fork() {
    if (!this._isOpen) throw new Error("Connection is not open");
    return new XuguDatabaseSync(this._options);
  }

  reconnect() {
    if (this.isTransaction) throw new Error("Cannot reconnect Xugu during a transaction");
    if (this.conn) this.conn.discard();
    const { host, port, user, password, database, charset } = this._options;
    const connStr = `IP=${host};Port=${port};Database=${database};USER=${user};PWD=${password};CHAR_SET=${charset}`;
    this.conn = new XuguWorkerClient(connStr);
    this._isOpen = true;
  }

  close() {
    if (this._isOpen && this.conn) {
      try {
        this.conn.close();
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
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    // Handle line comments (-- ...)
    if (!inSingleQuote && !inBlockComment && char === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        current += "\n";
      }
      continue;
    }

    // Handle block comments (/* ... */)
    if (!inSingleQuote && !inLineComment && char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        i++;
        inBlockComment = false;
        current += " ";
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    // Note: BEGIN...END depth tracking removed because all triggers are commented out
    // in Xugu migrations. The tracking was incorrectly handling comment lines,
    // causing statement merging and native driver crashes.

    if (char === ";" && !inSingleQuote) {
      const cleaned = stripLeadingComments(current.trim());
      if (cleaned) statements.push(cleaned);
      current = "";
    } else {
      current += char;
    }
  }
  const cleaned = stripLeadingComments(current.trim());
  if (cleaned) statements.push(cleaned);
  return statements;
}

function stripLeadingComments(sql) {
  let result = sql;
  while (result.startsWith("--") || result.startsWith("/*")) {
    if (result.startsWith("--")) {
      const nlIdx = result.indexOf("\n");
      if (nlIdx === -1) return "";
      result = result.substring(nlIdx + 1).trimStart();
    } else if (result.startsWith("/*")) {
      const closeIdx = result.indexOf("*/");
      if (closeIdx === -1) return "";
      result = result.substring(closeIdx + 2).trimStart();
    }
  }
  return result.trim();
}

function isIgnorableError(sql, error) {
  const msg = error.message || "";
  // E12008 = 索引已存在, E5017/E9016 = 表/约束/对象已存在, already exists, duplicate, 已存在
  if (/already\s+exists|duplicate|已存在|E12008|E5017|E9016/i.test(msg)) {
    if (/CREATE/i.test(sql)) return true;
    if (/ALTER.*ADD/i.test(sql)) return true;
  }
  // 忽略 "对象不存在" 的 DROP 错误
  if (/does\s+not\s+exist|not\s+found|不存在|E5021/i.test(msg)) {
    if (/DROP/i.test(sql)) return true;
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
