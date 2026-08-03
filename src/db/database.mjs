import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { appRoot } from "../paths.mjs";

const require = createRequire(import.meta.url);

export function defaultDataDir() {
  if (process.env.PLATFORM_DATA_DIR) return resolve(process.env.PLATFORM_DATA_DIR);
  return join(appRoot, "data");
}

export function openDatabase(options = {}) {
  if (typeof options === "string") {
    throw new TypeError("AI Project Command Platform only supports the Xugu database backend");
  }
  const { openXuguDatabase } = require("./xugu-database.cjs");
  return openXuguDatabase({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.database
  });
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
