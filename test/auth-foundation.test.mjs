import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations, defaultMigrationsDir } from "../src/db/migrate.mjs";
import { createAuthRepository } from "../src/repositories/auth-repository.mjs";
import { createAuthService, GENERIC_LOGIN_ERROR } from "../src/services/auth-service.mjs";
import { hashPassword, verifyPassword } from "../src/security/passwords.mjs";
import { clearSessionCookie, hashSessionToken, sessionCookie } from "../src/security/sessions.mjs";

function setup(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "platform-auth-"));
  const database = openDatabase(join(directory, "platform.sqlite"));
  const applied = applyMigrations(database);
  const service = createAuthService(database, options);
  return { database, service, applied };
}

test("migrations apply after unchanged migration 001 and repeat safely", () => {
  const original001 = readFileSync(join(defaultMigrationsDir, "001_initial.sql"));
  const { database, applied } = setup();
  try {
    assert.deepEqual(applied, ["001_initial.sql", "002_auth_project_access.sql", "003_module_registry_templates.sql"]);
    assert.deepEqual(applyMigrations(database), []);
    assert.deepEqual(readFileSync(join(defaultMigrationsDir, "001_initial.sql")), original001);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    for (const table of ["sessions", "recent_project_access", "audit_events"]) assert.ok(tables.includes(table));
    const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(row => row.name);
    assert.ok(indexes.includes("idx_users_login_name"));
  } finally { database.close(); }
});

test("password hashing is salted scrypt and timing-safe verification works", () => {
  const first = hashPassword("correct horse battery staple");
  const second = hashPassword("correct horse battery staple");
  assert.notEqual(first.passwordSalt, second.passwordSalt);
  assert.notEqual(first.passwordHash, second.passwordHash);
  assert.equal(verifyPassword("correct horse battery staple", first), true);
  assert.equal(verifyPassword("wrong password value", first), false);
  assert.equal(JSON.parse(first.passwordParamsJson).N, 2 ** 15);
});

test("bootstrap requires a strong supplied password and creates one admin", () => {
  const { database, service } = setup();
  try {
    assert.throws(() => service.ensureBootstrapAdmin({ loginName: "admin", password: "short" }), /12/);
    const created = service.ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-bootstrap-password" });
    assert.equal(created.created, true);
    assert.equal(service.ensureBootstrapAdmin({ loginName: "other", password: "another-secure-password" }).created, false);
    const user = database.prepare("SELECT * FROM users").get();
    assert.equal(user.login_name, "admin");
    assert.equal(user.is_platform_admin, 1);
    assert.equal(JSON.stringify(user).includes("a-secure-bootstrap-password"), false);
    assert.equal(database.prepare("SELECT count(*) AS count FROM users").get().count, 1);
  } finally { database.close(); }
});

test("authenticate returns generic failures for unknown, wrong, and disabled users", () => {
  const { database, service } = setup();
  try {
    service.ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-bootstrap-password" });
    const unknown = service.authenticate({ loginName: "unknown", password: "some-unknown-password" });
    const wrong = service.authenticate({ loginName: "admin", password: "some-invalid-password" });
    assert.deepEqual(unknown, { ok: false, error: GENERIC_LOGIN_ERROR });
    assert.deepEqual(wrong, { ok: false, error: GENERIC_LOGIN_ERROR });
    const admin = service.repository.findUserByLogin("admin");
    service.repository.setUserStatus(admin.id, "disabled", new Date().toISOString());
    const disabled = service.authenticate({ loginName: "admin", password: "a-secure-bootstrap-password" });
    assert.deepEqual(disabled, { ok: false, error: GENERIC_LOGIN_ERROR });
  } finally { database.close(); }
});

test("sessions store token hashes, enforce CSRF and logout", () => {
  const { database, service } = setup();
  try {
    service.ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-bootstrap-password" });
    const login = service.authenticate({ loginName: "admin", password: "a-secure-bootstrap-password" });
    assert.equal(login.ok, true);
    const stored = database.prepare("SELECT * FROM sessions").get();
    assert.equal(stored.token_hash, hashSessionToken(login.sessionToken));
    assert.equal(JSON.stringify(stored).includes(login.sessionToken), false);
    const session = service.resolveSession(login.sessionToken);
    assert.equal(session.isPlatformAdmin, true);
    assert.equal(service.verifyCsrf(session, login.principal.csrfToken), true);
    assert.equal(service.verifyCsrf(session, "wrong-csrf"), false);
    assert.equal(service.logout(login.sessionToken), true);
    assert.equal(service.resolveSession(login.sessionToken), undefined);
    assert.match(sessionCookie("token"), /HttpOnly; SameSite=Strict/);
    assert.match(sessionCookie("token", { secure: true }), /; Secure$/);
    assert.match(clearSessionCookie(), /Max-Age=0/);
  } finally { database.close(); }
});

test("idle and absolute session expiry are enforced", () => {
  let clock = Date.parse("2026-07-18T00:00:00.000Z");
  const { database, service } = setup({ now: () => clock, idleTimeoutMs: 1_000, absoluteTimeoutMs: 3_000 });
  try {
    service.ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-bootstrap-password" });
    const first = service.authenticate({ loginName: "admin", password: "a-secure-bootstrap-password" });
    clock += 1_001;
    assert.equal(service.resolveSession(first.sessionToken), undefined);
    const second = service.authenticate({ loginName: "admin", password: "a-secure-bootstrap-password" });
    clock += 3_001;
    assert.equal(service.resolveSession(second.sessionToken), undefined);
  } finally { database.close(); }
});

test("login success, failure, bootstrap, and logout are audited append-only", () => {
  const { database, service } = setup();
  try {
    service.ensureBootstrapAdmin({ loginName: "admin", password: "a-secure-bootstrap-password" });
    service.authenticate({ loginName: "unknown", password: "some-unknown-password", remoteAddress: "127.0.0.1" });
    const login = service.authenticate({ loginName: "admin", password: "a-secure-bootstrap-password" });
    service.logout(login.sessionToken);
    assert.deepEqual(service.repository.listAudit().map(event => event.action), [
      "auth.bootstrap", "auth.login_failed", "auth.login_succeeded", "auth.logout"
    ]);
    assert.throws(() => database.prepare("DELETE FROM audit_events").run(), /append-only/);
  } finally { database.close(); }
});
