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
    assert.deepEqual(applyMigrations(database), ["001_initial.sql", "002_auth_project_access.sql", "003_module_registry_templates.sql", "004_materials_evidence.sql", "005_structured_change_proposals.sql", "006_review_publish_operations.sql", "007_release_hardening_readiness_observability.sql", "008_password_reset.sql", "009_platform_settings.sql", "010_unified_cards.sql"]);
    assert.deepEqual(applyMigrations(database), []);
    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode, "delete");
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
    for (const table of ["projects", "project_versions", "project_units", "project_tasks", "task_links", "project_risks", "project_metrics", "change_proposals", "project_materials", "material_artifacts", "material_jobs", "evidence_blocks", "material_qa_grants", "material_generation_grants", "material_upload_attempts", "ai_usage_events", "generation_jobs", "generation_job_materials", "generation_job_evidence", "generation_attempts", "change_proposal_items", "change_proposal_evidence", "material_readiness_snapshots", "operation_traces", "error_events", "product_test_runs", "product_test_case_results"]) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }
    assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_project_modules_position'").get());
    assert.equal(database.prepare("SELECT count(*) AS count FROM templates").get().count, 8);
  } finally {
    database.close();
  }
});

test("004 material and evidence relations reject cross-project joins and keep FTS synchronized", () => {
  const database = openDatabase(":memory:");
  try {
    applyMigrations(database);
    const at = "2026-07-18T00:00:00.000Z";
    database.prepare("INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)").run("owner", "Owner", at, at);
    for (const id of ["project-a", "project-b"]) database.prepare(`
      INSERT INTO projects (id, name, template_id, template_version, created_at, updated_at)
      VALUES (?, ?, 'standard-project-v1', '1.0.0', ?, ?)
    `).run(id, id, at, at);
    database.prepare(`
      INSERT INTO project_materials (id, project_id, display_name, canonical_extension, canonical_mime, sha256, byte_size, created_by, created_at, updated_at)
      VALUES ('material-00000001', 'project-a', 'a.txt', '.txt', 'text/plain', ?, 3, 'owner', ?, ?)
    `).run("a".repeat(64), at, at);
    assert.throws(() => database.prepare(`
      INSERT INTO material_artifacts (id, project_id, material_id, kind, storage_key, byte_size, sha256, created_at)
      VALUES ('artifact-00000001', 'project-b', 'material-00000001', 'original', 'bad', 3, ?, ?)
    `).run("a".repeat(64), at), /FOREIGN KEY/);
    database.prepare(`
      INSERT INTO evidence_blocks (external_id, project_id, material_id, extraction_version, ordinal, kind, location_json, text, content_hash, created_at)
      VALUES ('evidence-00000001', 'project-a', 'material-00000001', 1, 0, 'text', '{}', 'alpha evidence', ?, ?)
    `).run("b".repeat(64), at);
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_fts WHERE evidence_fts MATCH 'alpha'").get().count, 1);
    assert.throws(() => database.prepare(`
      INSERT INTO evidence_blocks (external_id, project_id, material_id, extraction_version, ordinal, kind, location_json, text, content_hash, created_at)
      VALUES ('evidence-00000002', 'project-b', 'material-00000001', 1, 0, 'text', '{}', 'bad', ?, ?)
    `).run("c".repeat(64), at), /FOREIGN KEY/);
    database.prepare("DELETE FROM evidence_blocks WHERE project_id = 'project-a'").run();
    assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_fts WHERE evidence_fts MATCH 'alpha'").get().count, 0);
  } finally { database.close(); }
});

test("004 migration rolls back all material tables when FTS creation fails", () => {
  const migrations = mkdtempSync(join(tmpdir(), "platform-004-rollback-"));
  for (const name of ["001_initial.sql", "002_auth_project_access.sql", "003_module_registry_templates.sql"]) copyFileSync(join(defaultMigrationsDir, name), join(migrations, name));
  const sql = readFileSync(join(defaultMigrationsDir, "004_materials_evidence.sql"), "utf8").replace("tokenize='trigram'", "tokenize='missing-tokenizer'");
  writeFileSync(join(migrations, "004_materials_evidence.sql"), sql);
  const database = openDatabase(":memory:");
  try {
    assert.throws(() => applyMigrations(database, { migrationsDir: migrations }), /tokeniz/);
    assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version = 4").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'project_materials'").get().count, 0);
  } finally { database.close(); }
});

test("005 proposal relations reject cross-project versions, materials and evidence",()=>{const database=openDatabase(":memory:");try{applyMigrations(database);const at="2026-07-18T00:00:00.000Z";database.prepare("INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES ('owner','Owner','active',?,?)").run(at,at);for(const id of ["project-a","project-b"]){database.prepare("INSERT INTO projects (id,name,template_id,template_version,created_at,updated_at) VALUES (?,?,'standard-project-v1','1.0.0',?,?)").run(id,id,at,at);database.prepare("INSERT INTO project_versions (project_id,layer,version_label,created_at) VALUES (?,'published','v1',?)").run(id,at);const version=database.prepare("SELECT id FROM project_versions WHERE project_id=?").get(id).id;database.prepare("UPDATE projects SET published_version_id=? WHERE id=?").run(version,id);const material=`material-${id}-0001`;database.prepare(`INSERT INTO project_materials (id,project_id,display_name,canonical_extension,canonical_mime,sha256,byte_size,status,active_extraction_version,created_by,created_at,updated_at) VALUES (?,?,'x.txt','.txt','text/plain',?,1,'ready',1,'owner',?,?)`).run(material,id,(id==="project-a"?"a":"b").repeat(64),at,at);database.prepare("INSERT INTO material_generation_grants (project_id,material_id,enabled,granted_by,granted_at) VALUES (?,?,1,'owner',?)").run(id,material,at);database.prepare(`INSERT INTO evidence_blocks (external_id,project_id,material_id,extraction_version,ordinal,kind,location_json,text,content_hash,created_at) VALUES (?,?,?,1,0,'text','{}','x',?,?)`).run(`evidence-${id}-001`,id,material,(id==="project-a"?"c":"d").repeat(64),at);}const a=database.prepare("SELECT published_version_id AS id FROM projects WHERE id='project-a'").get().id,b=database.prepare("SELECT published_version_id AS id FROM projects WHERE id='project-b'").get().id;assert.throws(()=>database.prepare(`INSERT INTO generation_jobs (id,project_id,base_version_id,template_id,template_version,schema_version,idempotency_key,request_hash,created_by,created_at,updated_at) VALUES ('job-000000000001','project-a',?,'meeting-notes','1.0.0','change-proposal-v1@1.0.0','request-001',?,'owner',?,?)`).run(b,"e".repeat(64),at,at));database.prepare(`INSERT INTO generation_jobs (id,project_id,base_version_id,template_id,template_version,schema_version,idempotency_key,request_hash,created_by,created_at,updated_at) VALUES ('job-000000000001','project-a',?,'meeting-notes','1.0.0','change-proposal-v1@1.0.0','request-001',?,'owner',?,?)`).run(a,"e".repeat(64),at,at);assert.throws(()=>database.prepare("INSERT INTO generation_job_materials (project_id,job_id,material_id,extraction_version,position) VALUES ('project-a','job-000000000001','material-project-b-0001',1,0)").run(),/ready and current|FOREIGN KEY/);database.prepare("INSERT INTO generation_job_materials (project_id,job_id,material_id,extraction_version,position) VALUES ('project-a','job-000000000001','material-project-a-0001',1,0)").run();assert.throws(()=>database.prepare("INSERT INTO generation_job_evidence (project_id,job_id,evidence_external_id,material_id,extraction_version,content_hash,position) VALUES ('project-a','job-000000000001','evidence-project-b-001','material-project-a-0001',1,?,0)").run("d".repeat(64)));assert.equal(database.prepare("SELECT published_version_id AS id FROM projects WHERE id='project-a'").get().id,a);}finally{database.close();}});

test("005 migration rolls back all proposal tables when its final statement fails",()=>{const migrations=mkdtempSync(join(tmpdir(),"platform-005-rollback-"));for(const name of ["001_initial.sql","002_auth_project_access.sql","003_module_registry_templates.sql","004_materials_evidence.sql"])copyFileSync(join(defaultMigrationsDir,name),join(migrations,name));const sql=readFileSync(join(defaultMigrationsDir,"005_structured_change_proposals.sql"),"utf8")+"\nCREATE TABLE broken (\n";writeFileSync(join(migrations,"005_structured_change_proposals.sql"),sql);const database=openDatabase(":memory:");try{assert.throws(()=>applyMigrations(database,{migrationsDir:migrations}));assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version=5").get().count,0);assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='generation_jobs'").get().count,0);assert.equal(database.prepare("SELECT count(*) AS count FROM templates WHERE id='meeting-notes'").get().count,0);}finally{database.close();}});

test("006 migration enforces review and release project/version relations and rolls back",()=>{const database=openDatabase(":memory:");try{applyMigrations(database);for(const table of ["proposal_review_items","proposal_merges","publication_events"])assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table).count,1);assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version=6").get().count,1);}finally{database.close();}const migrations=mkdtempSync(join(tmpdir(),"platform-006-rollback-"));for(const name of ["001_initial.sql","002_auth_project_access.sql","003_module_registry_templates.sql","004_materials_evidence.sql","005_structured_change_proposals.sql"])copyFileSync(join(defaultMigrationsDir,name),join(migrations,name));const sql=readFileSync(join(defaultMigrationsDir,"006_review_publish_operations.sql"),"utf8")+"\nCREATE TABLE broken (\n";writeFileSync(join(migrations,"006_review_publish_operations.sql"),sql);const failed=openDatabase(":memory:");try{assert.throws(()=>applyMigrations(failed,{migrationsDir:migrations}));assert.equal(failed.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version=6").get().count,0);assert.equal(failed.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='proposal_review_items'").get().count,0);}finally{failed.close();}});

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
    published: { version: "v4.2", units: 7, tasks: 29, stages: 6, closures: 3, workstreams: 4 },
    draft: { version: "v4.2", units: 7, tasks: 29, stages: 6, closures: 3, workstreams: 4 }
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
