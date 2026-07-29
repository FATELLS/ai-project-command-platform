// ============================================================
// sql-dialect.mjs — SQL 方言适配工具
//
// 处理 SQLite 和虚谷之间的 SQL 语法差异
// ============================================================

import { isXuguBackend } from "../db/database.mjs";

const xugu = isXuguBackend();

// ----------------------------------------------------------------
// ON CONFLICT → MERGE 转换
// ----------------------------------------------------------------

/**
 * 将 SQLite 的 INSERT ... ON CONFLICT(col) DO UPDATE SET ...
 * 转换为虚谷兼容的语法
 *
 * 策略: 在虚谷后端下使用 MERGE INTO
 * 但 MERGE 语法复杂且需要在 SQL 里嵌入完整逻辑，
 * 更简单的方式是先 DELETE 再 INSERT（在事务中）
 *
 * 实际上更实用的方式是提供辅助函数
 */

export function upsert(database, table, columns, values, conflictColumns, updateColumns) {
  if (xugu) {
    // 虚谷: 先尝试 DELETE 冲突行，再 INSERT
    // 在事务中执行
    const whereClause = conflictColumns.map((col, i) => `${col} = ?`).join(" AND ");
    const conflictValues = conflictColumns.map((_, i) => values[i]);

    database.prepare(`DELETE FROM ${table} WHERE ${whereClause}`).run(...conflictValues);
    const placeholders = columns.map(() => "?").join(", ");
    database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
  } else {
    // SQLite: 原生 ON CONFLICT
    const placeholders = columns.map(() => "?").join(", ");
    const updateClause = updateColumns.map(col => `${col} = excluded.${col}`).join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflictColumns.join(", ")}) DO UPDATE SET ${updateClause}`;
    database.prepare(sql).run(...values);
  }
}

/**
 * INSERT OR IGNORE 的方言适配
 */
export function insertOrIgnore(database, table, columns, values, conflictColumns) {
  if (xugu) {
    // 虚谷: 检查是否存在，不存在才插入
    const whereClause = conflictColumns.map(col => `${col} = ?`).join(" AND ");
    const conflictValues = conflictColumns.map(col => values[columns.indexOf(col)]);
    const existing = database.prepare(`SELECT 1 FROM ${table} WHERE ${whereClause} FETCH FIRST 1 ROWS ONLY`).get(...conflictValues);
    if (!existing) {
      const placeholders = columns.map(() => "?").join(", ");
      database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
    }
  } else {
    // SQLite: INSERT OR IGNORE
    const placeholders = columns.map(() => "?").join(", ");
    database.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
  }
}

/**
 * 获取当前时间戳（跨方言）
 */
export function now() {
  return new Date().toISOString();
}
