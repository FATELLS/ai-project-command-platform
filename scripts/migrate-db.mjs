import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";

// 虚谷是唯一生产后端，openDatabase() 无参调用直接连虚谷
const database = openDatabase();
try {
  const applied = applyMigrations(database);
  console.log(JSON.stringify({ backend: "xugu", applied }, null, 2));
} finally {
  database.close();
}
