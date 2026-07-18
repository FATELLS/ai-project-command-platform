import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { defaultDatabasePath, openDatabase } from "./src/db/database.mjs";
import { applyMigrations } from "./src/db/migrate.mjs";
import { createApp } from "./src/http/app.mjs";
import { importLegacyProject } from "./src/migration/legacy-project.mjs";
import { createProjectRepository } from "./src/repositories/project-repository.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/projects/xugu-agentic-group.json", import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const database = openDatabase(defaultDatabasePath());
applyMigrations(database);

const repository = createProjectRepository(database);
if (!repository.getProject("xugu-agentic-group")) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
}

const server = createServer(createApp({ database }));
server.listen(port, host, () => {
  console.log(`AI Project Command Platform listening on http://${host}:${port}`);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    database.close();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
