// ============================================================
// xugu-database.cjs — 虚谷数据库适配层 (通过 docker exec)
//
// 由于 macOS 没有虚谷 ODBC 驱动，通过 docker exec 调用容器内的
// xgconsole 来执行 SQL。返回 JSON 格式结果。
//
// 注意: 这是开发环境方案。生产环境应使用 ODBC 驱动直连。
// ============================================================

const { execSync } = require("child_process");
const { writeFileSync, readFileSync, mkdtempSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

// ----------------------------------------------------------------
// 配置
// ----------------------------------------------------------------

const XUGU_CONTAINER = process.env.XUGU_CONTAINER || "xugu-dev";
const XUGU_HOST = process.env.XUGU_HOST || "127.0.0.1";
const XUGU_PORT = process.env.XUGU_PORT || "5138";
const XUGU_USER = process.env.XUGU_USER || "SYSDBA";
const XUGU_PASSWORD = process.env.XUGU_PASSWORD || "SYSDBA";
const XUGU_DATABASE = process.env.XUGU_DATABASE || "SYSTEM";

// ----------------------------------------------------------------
// 执行 SQL
// ----------------------------------------------------------------

function executeSql(sql) {
  const escapedSql = sql.replace(/'/g, "'\\''");
  const cmd = `printf '%s\\n/' '${escapedSql}' | docker exec -i ${XUGU_CONTAINER} /XGDBMS/BIN/xgconsole-linux-arm64 nssl ${XUGU_HOST} ${XUGU_PORT} ${XUGU_DATABASE} ${XUGU_USER} ${XUGU_PASSWORD} 2>&1; true`;

  let output;
  try {
    output = execSync(cmd, {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/sh",
    });
  } catch (error) {
    output = error.stdout || error.stderr || error.message;
  }

  // 检查是否有真正的错误（不是 Connect ok 等正常输出）
  if (/error|ERROR|failed|FAILED/i.test(output) && !/Connect ok/i.test(output)) {
    // 可能是真错误，但先尝试解析
  }

  return parseConsoleOutput(output);
}

// ----------------------------------------------------------------
// 解析 xgconsole 输出
// ----------------------------------------------------------------

function parseConsoleOutput(output) {
  const lines = output.split("\n");
  const dataLines = [];
  let headers = [];
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过空行和连接信息
    if (!line) continue;
    if (line.startsWith("XGDBMS") || line.startsWith("Copyright") || line.startsWith("Connect")) continue;
    if (line.startsWith("SQL>") || /^\d+\s+\//.test(line)) continue;
    if (line.startsWith("Use time:")) continue;
    if (line === "/") continue;

    // 检测分隔线 (全是 -, |, +, 空格)
    if (/^[-|+\s]+$/.test(line) && line.includes("-")) {
      separatorIndex = i;
      continue;
    }

    // 如果还没有表头，第一个有 | 的行是表头
    // 虚谷 xgconsole 统一返回大写列名（包括 AS 别名），转小写以兼容代码中的属性访问
    // 查询代码需用全小写属性名（如 AS displayName → 代码访问 row.displayname）
    // 对于需要驼峰属性名的场景，请用全小写别名（如 AS display_name）
    if (separatorIndex < 0 && line.includes("|") && headers.length === 0) {
      headers = line.split("|").map(h => h.trim().toLowerCase()).filter(h => h.length > 0);
      continue;
    }

    // 在分隔线之后，包含 | 的行是数据行
    if (separatorIndex > 0 && i > separatorIndex && line.includes("|")) {
      const values = line.split("|").map(v => v.trim());
      const row = {};
      let colIdx = 0;
      for (let j = 0; j < values.length && colIdx < headers.length; j++) {
        const val = values[j];
        // 跳过空列（可能是多 | 分隔的空隙）
        if (val === "" && j === 0) continue;
        row[headers[colIdx]] = val;
        colIdx++;
      }
      // 只有至少有一个非空值才添加
      if (Object.values(row).some(v => v !== "")) {
        dataLines.push(row);
      }
    }
  }

  return { rows: dataLines, columns: headers, count: dataLines.length };
}

// ----------------------------------------------------------------
// XuguStatement
// ----------------------------------------------------------------

// 从 SQL 中提取 AS 别名映射（小写 → 原始大小写）
// 例如：SELECT col AS myField FROM t → { "myfield": "myField" }
// xgconsole 统一返回大写列名，parseConsoleOutput 转小写后属性名丢失驼峰
// 此函数在 prepare 阶段记住原始大小写，执行后恢复
function extractAliases(sql) {
  const map = {};
  // 匹配 "expression AS alias" 或 "expression as alias"
  // alias 通常是合法标识符（字母/数字/下划线）
  const regex = /\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    const alias = match[1];
    map[alias.toLowerCase()] = alias;
  }
  return map;
}

class XuguStatement {
  constructor(sql) {
    this.sql = sql;
    this.aliasMap = extractAliases(sql);
  }

  get(...params) {
    const { rows } = this._execute(params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  all(...params) {
    const { rows } = this._execute(params);
    return rows;
  }

  run(...params) {
    const result = this._execute(params);
    return { changes: result.count || 0, lastInsertRowid: null };
  }

  _execute(params) {
    const sql = this._interpolate(this.sql, params);
    const result = executeSql(sql);
    // 对每行的属性名做大小写恢复
    if (this.aliasMap && Object.keys(this.aliasMap).length > 0) {
      for (const row of result.rows) {
        for (const lowerKey of Object.keys(row)) {
          const originalCase = this.aliasMap[lowerKey];
          if (originalCase && originalCase !== lowerKey) {
            row[originalCase] = row[lowerKey];
            delete row[lowerKey];
          }
        }
      }
    }
    return result;
  }

  _interpolate(sql, params) {
    // 将 ? 占位符替换为参数值
    let index = 0;
    return sql.replace(/\?/g, () => {
      if (index >= params.length) return "NULL";
      const val = params[index++];
      if (val === null || val === undefined) return "NULL";
      if (typeof val === "number") return String(val);
      if (typeof val === "boolean") return val ? "1" : "0";
      // 字符串: 转义单引号
      return "'" + String(val).replace(/'/g, "''") + "'";
    });
  }
}

// ----------------------------------------------------------------
// XuguDatabaseSync
// ----------------------------------------------------------------

class XuguDatabaseSync {
  constructor() {
    this.isTransaction = false;
    this._transactionSqls = [];
  }

  exec(sql) {
    if (this.isTransaction) {
      this._transactionSqls.push(sql);
      return;
    }
    const statements = splitSqlStatements(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        executeSql(trimmed);
      } catch (error) {
        if (isIgnorableError(trimmed, error)) continue;
        throw error;
      }
    }
  }

  prepare(sql) {
    return new XuguStatement(sql);
  }

  close() {}
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
  return new XuguDatabaseSync();
}

module.exports = {
  XuguDatabaseSync,
  XuguStatement,
  openXuguDatabase,
  executeSql,
};
