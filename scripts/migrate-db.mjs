import { resolve } from "node:path";
import { defaultDatabasePath, openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const databasePath = resolve(valueAfter("--database") ?? defaultDatabasePath());
const database = openDatabase(databasePath);
try {
  const applied = applyMigrations(database);
  console.log(JSON.stringify({ database: databasePath, applied }, null, 2));
} finally {
  database.close();
}
