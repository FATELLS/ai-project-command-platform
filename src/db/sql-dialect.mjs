// ============================================================
// sql-dialect.mjs — SQL 方言���配工具
//
// 处理 SQLite 和虚谷之间的 SQL 语法差异
// 基于 database 实例的 _backend 标记判断后端
// ============================================================

function isXugu(database) {
  return database?._backend === "xugu";
}

// ----------------------------------------------------------------
// ON CONFLICT → DELETE+INSERT 转换
// ----------------------------------------------------------------

/**
 * 将 SQLite 的 INSERT ... ON CONFLICT(col) DO UPDATE SET ...
 * 转换为虚谷兼容的语法
 *
 * 策略: 在虚谷后端下先 DELETE 冲突行，再 INSERT（在事务中）
 */

export function upsert(database, table, columns, values, conflictColumns, updateColumns) {
  if (isXugu(database)) {
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
  if (isXugu(database)) {
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
