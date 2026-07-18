import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase, withTransaction } from "../src/db/database.mjs";
import { applyMigrations, defaultMigrationsDir } from "../src/db/migrate.mjs";
import { validateLegacyFixture, validateProjectSnapshot } from "../src/domain/project-validator.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/projects/xugu-agentic-group.json", import.meta.url), "utf8"));

test("fresh and repeated migrations are deterministic", () => {
  const directory = mkdtempSync(join(tmpdir(), "platform-db-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  try {
    assert.deepEqual(applyMigrations(database), ["001_initial.sql"]);
    assert.deepEqual(applyMigrations(database), []);
    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
    for (const table of ["projects", "project_versions", "project_units", "project_tasks", "task_links", "change_proposals"]) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }
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
