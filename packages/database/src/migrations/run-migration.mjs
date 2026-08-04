#!/usr/bin/env node
/**
 * Migration runner for AI Project Command Platform.
 *
 * Reads SQL files from src/migrations/ in order and applies them.
 * Tracks applied migrations in the `_migrations` table.
 *
 * Usage:
 *   node src/migrations/run-migration.mjs           # apply all pending
 *   node src/migrations/run-migration.mjs --status   # show status
 *   node src/migrations/run-migration.mjs --dry-run  # show what would run
 */

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = __dirname;

const dbConfig = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "aicp",
  user: process.env.PGUSER ?? "aicp",
  password: process.env.PGPASSWORD ?? "",
};

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    VARCHAR(256) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum    VARCHAR(64) NOT NULL
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("SELECT filename FROM _migrations ORDER BY filename");
  return new Set(result.rows.map((r) => r.filename));
}

async function computeChecksum(content) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content).digest("hex");
}

async function getMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function runMigrations(options = {}) {
  const { dryRun = false, statusOnly = false } = options;
  const client = new pg.Client(dbConfig);

  try {
    await client.connect();

    if (statusOnly) {
      await ensureMigrationsTable(client);
      const applied = await getAppliedMigrations(client);
      const all = await getMigrationFiles();
      console.log("Migration Status:");
      for (const f of all) {
        console.log(`  ${applied.has(f) ? "[x]" : "[ ]"} ${f}`);
      }
      return;
    }

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const all = await getMigrationFiles();
    const pending = all.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    console.log(`Pending migrations: ${pending.length}`);

    for (const file of pending) {
      const filePath = join(MIGRATIONS_DIR, file);
      const content = await readFile(filePath, "utf8");
      const checksum = await computeChecksum(content);

      if (dryRun) {
        console.log(`  [DRY] Would apply: ${file} (checksum: ${checksum.slice(0, 12)}...)`);
        continue;
      }

      console.log(`  Applying: ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(content);
        await client.query(
          "INSERT INTO _migrations (filename, checksum) VALUES ($1, $2)",
          [file, checksum],
        );
        await client.query("COMMIT");
        console.log(`  Done: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  FAILED: ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log("All migrations applied successfully.");
  } finally {
    await client.end();
  }
}

// CLI entry point
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const statusOnly = args.includes("--status");

runMigrations({ dryRun, statusOnly }).catch((err) => {
  console.error("Migration error:", err.message);
  process.exit(1);
});
