import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase, withTransaction } from "../src/db/database.mjs";
import { applyMigrations, defaultMigrationsDir } from "../src/db/migrate.mjs";
import { validateLegacyFixture, validateProjectSnapshot } from "../src/domain/project-validator.mjs";
import { exportLegacyProject, importLegacyProject } from "../src/migration/legacy-project.mjs";
import { resolveTemplate } from "../src/templates/catalog.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));

test("fresh and repeated migrations are deterministic", () => {
  const directory = mkdtempSync(join(tmpdir(), "platform-db-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  try {
    assert.deepEqual(applyMigrations(database), ["001_initial.sql", "002_auth_project_access.sql", "003_module_registry_templates.sql"]);
    assert.deepEqual(applyMigrations(database), []);
    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
    for (const table of ["projects", "project_versions", "project_units", "project_tasks", "task_links", "project_risks", "project_metrics", "change_proposals"]) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }
    assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_project_modules_position'").get());
    assert.equal(database.prepare("SELECT count(*) AS count FROM templates").get().count, 2);
  } finally {
    database.close();
  }
});

test("migration checksum changes are rejected", () => {
  const directory = mkdtempSync(join(tmpdir(), "platform-migrations-"));
  const migration = join(directory, "001_initial.sql");
  copyFileSync(join(defaultMigrationsDir, "001_initial.sql"), migration);
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database, { migrationsDir: directory });
    writeFileSync(migration, `${readFileSync(migration, "utf8")}\n-- changed\n`);
    assert.throws(() => applyMigrations(database, { migrationsDir: directory }), /has changed/);
  } finally {
    database.close();
  }
});

function stagedMigrations() {
  const directory = mkdtempSync(join(tmpdir(), "platform-upgrade-migrations-"));
  copyFileSync(join(defaultMigrationsDir, "001_initial.sql"), join(directory, "001_initial.sql"));
  copyFileSync(join(defaultMigrationsDir, "002_auth_project_access.sql"), join(directory, "002_auth_project_access.sql"));
  return directory;
}

test("003 module template migration upgrades deterministically without changing Xugu facts or prior checksums", () => {
  const migrations = stagedMigrations();
  const database = openDatabase(":memory:");
  try {
    assert.deepEqual(applyMigrations(database, { migrationsDir: migrations }), ["001_initial.sql", "002_auth_project_access.sql"]);
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group", now: "2026-07-18T00:00:00.000Z" });
    database.prepare("UPDATE project_modules SET data_json = '{}' WHERE version_id IN (SELECT id FROM project_versions WHERE project_id = ?)")
      .run("xugu-agentic-group");
    const checksums = database.prepare("SELECT version, checksum FROM schema_migrations ORDER BY version").all();
    copyFileSync(join(defaultMigrationsDir, "003_module_registry_templates.sql"), join(migrations, "003_module_registry_templates.sql"));

    assert.deepEqual(applyMigrations(database, { migrationsDir: migrations }), ["003_module_registry_templates.sql"]);
    assert.deepEqual(applyMigrations(database, { migrationsDir: migrations }), []);
    assert.deepEqual(database.prepare("SELECT version, checksum FROM schema_migrations WHERE version < 3 ORDER BY version").all(), checksums);
    assert.deepEqual(exportLegacyProject(database, "xugu-agentic-group"), fixture);
    const project = database.prepare("SELECT published_version_id AS publishedId, draft_version_id AS draftId FROM projects WHERE id = ?")
      .get("xugu-agentic-group");
    for (const versionId of [project.publishedId, project.draftId]) {
      const modules = database.prepare("SELECT module_type AS type, position, data_json AS dataJson FROM project_modules WHERE version_id = ? ORDER BY position")
        .all(versionId);
      assert.deepEqual(modules.map(module => module.type), ["overview", "roadmap", "units", "task-network", "gantt", "outcomes", "risks", "metrics", "materials"]);
      assert.deepEqual(modules.map(module => module.position), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      assert.deepEqual(JSON.parse(modules[1].dataJson), { schemaVersion: "1.0.0", viewVariant: "campaign-network" });
    }
    assert.deepEqual(
      JSON.parse(database.prepare("SELECT config_json AS configJson FROM templates WHERE id = 'campaign-map-v1' AND version = '1.0.0'").get().configJson),
      resolveTemplate("campaign-map-v1")
    );
  } finally {
    database.close();
  }
});

test("003 module migration rolls back completely when module positions cannot be made unique", () => {
  const migrations = stagedMigrations();
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database, { migrationsDir: migrations });
    importLegacyProject(database, fixture, { projectId: "xugu-agentic-group" });
    const versionId = database.prepare("SELECT published_version_id AS id FROM projects WHERE id = 'xugu-agentic-group'").get().id;
    const insert = database.prepare(`
      INSERT INTO project_modules (version_id, external_id, module_type, position, enabled, data_json)
      VALUES (?, ?, ?, 50, 1, '{}')
    `);
    insert.run(versionId, "unknown-a", "unknown-a");
    insert.run(versionId, "unknown-b", "unknown-b");
    copyFileSync(join(defaultMigrationsDir, "003_module_registry_templates.sql"), join(migrations, "003_module_registry_templates.sql"));
    assert.throws(() => applyMigrations(database, { migrationsDir: migrations }), /UNIQUE constraint failed/);
    assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version = 3").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('project_risks', 'project_metrics')").get().count, 0);
    assert.deepEqual(
      database.prepare("SELECT position FROM project_modules WHERE external_id IN ('unknown-a', 'unknown-b') ORDER BY external_id").all().map(row => row.position),
      [50, 50]
    );
  } finally {
    database.close();
  }
});

test("transactions roll back completely", () => {
  const database = openDatabase(":memory:");
  try {
    database.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY) STRICT");
    assert.throws(() => withTransaction(database, () => {
      database.prepare("INSERT INTO sample (id) VALUES (?)").run(1);
      throw new Error("stop");
    }), /stop/);
    assert.equal(database.prepare("SELECT count(*) AS count FROM sample").get().count, 0);
  } finally {
    database.close();
  }
});

test("Xugu fixture validates with expected counts", () => {
  assert.deepEqual(validateLegacyFixture(fixture), {
    published: { version: "v4.2", units: 7, tasks: 29, stages: 6, closures: 2, workstreams: 4 },
    draft: { version: "v4.2", units: 7, tasks: 29, stages: 6, closures: 2, workstreams: 4 }
  });
});

test("invalid task graphs are rejected", () => {
  const missing = structuredClone(fixture.published);
  missing.tasks[0].dependsOn = ["missing-task"];
  assert.throws(() => validateProjectSnapshot(missing), /missing task/);

  const crossUnit = structuredClone(fixture.published);
  crossUnit.tasks[0].dependsOn = [crossUnit.tasks.find(task => task.groupId !== crossUnit.tasks[0].groupId).id];
  assert.throws(() => validateProjectSnapshot(crossUnit), /cross-unit/);

  const cycle = structuredClone(fixture.published);
  const pair = cycle.tasks.filter(task => task.groupId === "rd").slice(0, 2);
  pair[0].dependsOn = [pair[1].id];
  pair[1].dependsOn = [pair[0].id];
  assert.throws(() => validateProjectSnapshot(cycle), /cycle/);

  const self = structuredClone(fixture.published);
  self.tasks[0].parentId = self.tasks[0].id;
  assert.throws(() => validateProjectSnapshot(self), /itself/);
});
