import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { importLegacyProject } from "../src/migration/legacy-project.mjs";
import { createProjectRepository } from "../src/repositories/project-repository.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const requestedDatabase = valueAfter("--database");
if (!requestedDatabase) {
  throw new Error("--database is required; seed only an explicit isolated acceptance database");
}

const databasePath = resolve(requestedDatabase);
const fixturePath = resolve(valueAfter("--fixture") ?? "fixtures/projects/standard-project-sample.json");
const projectId = valueAfter("--project") ?? "standard-project-sample";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const database = openDatabase(databasePath);

try {
  applyMigrations(database);
  const result = importLegacyProject(database, fixture, {
    projectId,
    name: fixture.published.title,
    templateId: "standard-project-v1",
    templateVersion: "1.0.0"
  });
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
