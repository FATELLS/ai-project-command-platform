import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { withTransaction, isXuguBackend } from "./database.mjs";
import { migrationsDir as packagedMigrationsDir, isPackaged } from "../paths.mjs";

// 根据后端选择 migrations 目录
const sqliteMigrationsDir = isPackaged
  ? packagedMigrationsDir
  : fileURLToPath(new URL("./migrations", import.meta.url));

const xuguMigrationsDir = isPackaged
  ? join(packagedMigrationsDir, "..", "xugu-migrations")
  : fileURLToPath(new URL("./xugu-migrations", import.meta.url));

export const defaultMigrationsDir = isXuguBackend()
  ? xuguMigrationsDir
  : sqliteMigrationsDir;

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

function migrationFiles(directory) {
  return readdirSync(directory)
    .filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function applyMigrations(database, options = {}) {
  const directory = options.migrationsDir ?? defaultMigrationsDir;

  // schema_migrations 表: 虚谷用 IDENTITY，SQLite 用 INTEGER PRIMARY KEY
  if (isXuguBackend()) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(256) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at VARCHAR(40) NOT NULL,
        CONSTRAINT uq_sm_name UNIQUE (name)
      )
    `);
  } else {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT
    `);
  }

  const findApplied = database.prepare(
    "SELECT version, name, checksum FROM schema_migrations WHERE version = ?"
  );
  const record = database.prepare(
    "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)"
  );
  const applied = [];

  for (const name of migrationFiles(directory)) {
    const match = name.match(/^(\d+)_/);
    const version = Number(match[1]);
    const sql = readFileSync(join(directory, name), "utf8");
    const digest = checksum(sql);
    const existing = findApplied.get(version);
    if (existing) {
      if (existing.name !== name || existing.checksum !== digest) {
        throw new Error(`Migration ${version} has changed after it was applied`);
      }
      continue;
    }
    withTransaction(database, () => {
      database.exec(sql);
      record.run(version, name, digest, new Date().toISOString());
    }, "EXCLUSIVE");
    applied.push(name);
  }
  return applied;
}
