import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { backupDatabaseFile, restoreDatabaseFile, verifyDatabaseFile } from "../src/operations/database-backup.mjs";

test("SQLite backup is consistent and restore preserves the previous target",async()=>{const directory=mkdtempSync(join(tmpdir(),"platform-backup-")),source=join(directory,"source.sqlite"),backup=join(directory,"backup.sqlite"),target=join(directory,"target.sqlite");const database=openDatabase(source);applyMigrations(database);database.prepare("INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES ('backup-user','Backup','active','2026-07-18','2026-07-18')").run();database.close();const result=await backupDatabaseFile(source,backup);assert.equal(result.quickCheck,"ok");assert.equal(result.migrationVersion,6);const old=openDatabase(target);applyMigrations(old);old.close();const restored=await restoreDatabaseFile(backup,target,{suffix:"test"});assert.equal(restored.preserved,`${target}.pre-restore-test.sqlite`);const check=openDatabase(target,{readOnly:true});assert.equal(check.prepare("SELECT display_name FROM users WHERE id='backup-user'").get().display_name,"Backup");check.close();assert.equal((await verifyDatabaseFile(restored.preserved)).quickCheck,"ok");});

test("backup validation rejects corrupt files and source-target aliasing",async()=>{const directory=mkdtempSync(join(tmpdir(),"platform-backup-invalid-")),file=join(directory,"broken.sqlite");await writeFile(file,"not sqlite");await assert.rejects(()=>verifyDatabaseFile(file));await assert.rejects(()=>backupDatabaseFile(file,file));assert.equal((await readFile(file,"utf8")),"not sqlite");});
