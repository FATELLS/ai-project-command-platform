import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultDatabasePath, openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const databasePath = resolve(valueAfter("--database") ?? defaultDatabasePath());
const fixturePath = resolve(valueAfter("--fixture") ?? "fixtures/projects/xugu-agentic-group.json");
const projectId = valueAfter("--project") ?? "xugu-agentic-group";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const database = openDatabase(databasePath);
try {
  applyMigrations(database);
  const result = importLegacyProject(database, fixture, { projectId });
  const repository = createProjectRepository(database);
  const project = repository.getProject(projectId);
  console.log(JSON.stringify({
    database: databasePath,
    fixture: fixturePath,
    ...result,
    published: repository.countVersion(project.publishedVersionId),
    draft: repository.countVersion(project.draftVersionId)
  }, null, 2));
} finally {
  database.close();
}
