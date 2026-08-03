import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrationsDir } from "../paths.mjs";
import { listTemplates, templateConfigJson } from "../templates/catalog.mjs";

export const defaultMigrationsDir = migrationsDir;

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

function migrationFiles(directory) {
  return readdirSync(directory)
    .filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function syncTemplateCatalog(database) {
  const find = database.prepare("SELECT 1 FROM templates WHERE id = ? AND version = ?");
  const insert = database.prepare(
    "INSERT INTO templates (id, version, name, config_json, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const update = database.prepare(
    "UPDATE templates SET name = ?, config_json = ? WHERE id = ? AND version = ?"
  );
  const now = new Date().toISOString();
  for (const template of listTemplates()) {
    const config = templateConfigJson(template);
    if (find.get(template.id, template.version)) {
      update.run(template.name, config, template.id, template.version);
    } else {
      insert.run(template.id, template.version, template.name, config, now);
    }
  }
}

export function applyMigrations(database, options = {}) {
  const directory = options.migrationsDir ?? migrationsDir;
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at VARCHAR(40) NOT NULL,
      CONSTRAINT uq_sm_name UNIQUE (name)
    )
  `);

  const findApplied = database.prepare(
    "SELECT version, name, checksum FROM schema_migrations WHERE version = ?"
  );
  const record = database.prepare(
    "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)"
  );
  const applied = [];

  for (const name of migrationFiles(directory)) {
    const version = Number(name.match(/^(\d+)_/)[1]);
    const sql = readFileSync(join(directory, name), "utf8");
    const digest = checksum(sql);
    const existing = findApplied.get(version);
    if (existing) {
      if (existing.name !== name || existing.checksum !== digest) {
        throw new Error(`Migration ${version} has changed after it was applied`);
      }
      continue;
    }
    database.exec(sql);
    record.run(version, name, digest, new Date().toISOString());
    applied.push(name);
  }
  syncTemplateCatalog(database);
  return applied;
}
