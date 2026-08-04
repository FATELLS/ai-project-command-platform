/**
 * Transaction primitives for database operations.
 *
 * All mutations must go through `withTransaction` to ensure atomicity.
 */

import type { Kysely, Transaction } from "kysely";
import type { Database } from "../types/db.js";

/**
 * Execute a callback within a database transaction.
 * If the callback throws, the transaction is rolled back.
 * If it returns successfully, the transaction is committed.
 */
export async function withTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}

/**
 * Execute a callback within a savepoint (nested transaction).
 * Useful for partial failure recovery within a larger transaction.
 */
export async function withSavepoint<T>(
  trx: Transaction<Database>,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return trx.savepoint(fn);
}
