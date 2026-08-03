export function upsert(database, table, columns, values, conflictColumns) {
  const whereClause = conflictColumns.map(column => `${column} = ?`).join(" AND ");
  const conflictValues = conflictColumns.map(column => values[columns.indexOf(column)]);
  const existing = database.prepare(`SELECT 1 FROM ${table} WHERE ${whereClause} LIMIT 1`).get(...conflictValues);
  if (existing) {
    const updateColumns = columns.filter(column => !conflictColumns.includes(column));
    const updateValues = updateColumns.map(column => values[columns.indexOf(column)]);
    database.prepare(
      `UPDATE ${table} SET ${updateColumns.map(column => `${column} = ?`).join(", ")} WHERE ${whereClause}`
    ).run(...updateValues, ...conflictValues);
    return;
  }
  const placeholders = columns.map(() => "?").join(", ");
  database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
}

export function insertOrIgnore(database, table, columns, values, conflictColumns) {
  const whereClause = conflictColumns.map(column => `${column} = ?`).join(" AND ");
  const conflictValues = conflictColumns.map(column => values[columns.indexOf(column)]);
  const existing = database.prepare(
    `SELECT 1 FROM ${table} WHERE ${whereClause} LIMIT 1`
  ).get(...conflictValues);
  if (existing) return;
  const placeholders = columns.map(() => "?").join(", ");
  database.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
}
