import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { withTransaction } from "./database.mjs";

export const defaultMigrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));

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
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
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
