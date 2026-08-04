/**
 * Database Package
 *
 * PostgreSQL 18 baseline schema, Kysely client, and migration runner.
 */

// Client
export { createDatabase, createDatabaseFromEnv, destroyDatabase } from "./client/create-client.js";
export type { DatabaseConfig } from "./client/create-client.js";
export { withTransaction, withSavepoint } from "./client/transaction.js";

// Types
export type { Database } from "./types/db.js";

// Version
export const DATABASE_PACKAGE_VERSION = "1.0.0";
