import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultDatabasePath, openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { exportLegacyProject } from "../src/migration/legacy-project.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const databasePath = resolve(valueAfter("--database") ?? defaultDatabasePath());
const projectId = valueAfter("--project") ?? "xugu-agentic-group";
const outputPath = valueAfter("--output");
const database = openDatabase(databasePath);
try {
  applyMigrations(database);
  const json = `${JSON.stringify(exportLegacyProject(database, projectId), null, 2)}\n`;
  if (process.argv.includes("--stdout") || !outputPath) process.stdout.write(json);
  else writeFileSync(resolve(outputPath), json, "utf8");
} finally {
  database.close();
}
