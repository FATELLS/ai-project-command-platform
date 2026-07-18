import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = fileURLToPath(new URL("../..", import.meta.url));

export function defaultDataDir() {
  return process.env.PLATFORM_DATA_DIR
    ? resolve(process.env.PLATFORM_DATA_DIR)
    : join(root, "data");
}

export function defaultDatabasePath() {
  return join(defaultDataDir(), "platform.sqlite");
}

export function openDatabase(path = defaultDatabasePath(), options = {}) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const database = new DatabaseSync(path, {
    timeout: options.timeout ?? 5_000,
    readOnly: options.readOnly ?? false,
    enableForeignKeyConstraints: true
  });
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`PRAGMA busy_timeout = ${Number(options.timeout ?? 5_000)}`);
  if (!options.readOnly && path !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
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
