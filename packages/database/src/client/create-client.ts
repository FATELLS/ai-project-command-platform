/**
 * Kysely client factory for PostgreSQL.
 *
 * Uses node-postgres (pg) as the dialect driver.
 * Connection pool is configured for compact (2-service) deployment.
 */

import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "../types/db.js";

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
}

export function createDatabase(config: DatabaseConfig): Kysely<Database> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.maxConnections ?? 10,
    idleTimeoutMillis: config.idleTimeoutMs ?? 30_000,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    log(event) {
      if (event.level === "error") {
        console.error("[kysely]", event.error);
      }
    },
  });
}

/** Create a database connection from standard PG env vars. */
export function createDatabaseFromEnv(): Kysely<Database> {
  return createDatabase({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? "aicp",
    user: process.env.PGUSER ?? "aicp",
    password: process.env.PGPASSWORD ?? "",
  });
}

/** Safely destroy the connection pool. */
export async function destroyDatabase(db: Kysely<Database>): Promise<void> {
  await db.destroy();
}
