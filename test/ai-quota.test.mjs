import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/db/database.mjs";
import { applyMigrations } from "../src/db/migrate.mjs";
import { createAiQuota, resetAiSemaphoresForTest } from "../src/ai/quota.mjs";

function setup() {
  const db = openDatabase(":memory:"); applyMigrations(db); const at = "2026-07-18T00:00:00.000Z";
  db.prepare("INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES ('user', 'User', 'active', ?, ?)").run(at, at);
  db.prepare("INSERT INTO projects (id, name, template_id, template_version, created_at, updated_at) VALUES ('project', 'Project', 'standard-project-v1', '1.0.0', ?, ?)").run(at, at);
  return db;
}

test("chat minute quota persists across service recreation and rejected attempts cannot bypass it", () => {
  const db = setup(); let clock = Date.parse("2026-07-18T01:00:00.000Z");
  try {
    const first = createAiQuota(db, { now: () => clock, perMinute: 2, semaphoreName: "persist" });
    const one = first.reserve({ projectId: "project", userId: "user", capability: "chat", request: "secret question" }); first.complete(one, "succeeded");
    const second = createAiQuota(db, { now: () => clock, perMinute: 2, semaphoreName: "persist" });
    const two = second.reserve({ projectId: "project", userId: "user", capability: "chat", request: "another" }); second.complete(two, "failed");
    assert.throws(() => second.reserve({ projectId: "project", userId: "user", capability: "chat", request: "third" }), error => error.code === "AI_RATE_LIMITED");
    assert.equal(db.prepare("SELECT count(*) AS count FROM ai_usage_events WHERE request_hash LIKE '%secret%'").get().count, 0, "only a request hash is persisted");
    clock += 60_001; assert.ok(second.reserve({ projectId: "project", userId: "user", capability: "chat", request: "after" }));
  } finally { db.close(); resetAiSemaphoresForTest(); }
});

test("chat and generation budgets are strictly separate", () => {
  const db = setup(); const quota = createAiQuota(db, { perMinute: 1, semaphoreName: "separate" });
  try {
    quota.reserve({ projectId: "project", userId: "user", capability: "chat", request: "chat" });
    assert.throws(() => quota.reserve({ projectId: "project", userId: "user", capability: "chat", request: "chat 2" }), error => error.code === "AI_RATE_LIMITED");
    assert.ok(quota.reserve({ projectId: "project", userId: "user", capability: "generation", request: "generation" }));
    assert.deepEqual(db.prepare("SELECT capability, count(*) AS count FROM ai_usage_events GROUP BY capability ORDER BY capability").all().map(row => [row.capability, row.count]), [["chat", 2], ["generation", 1]]);
  } finally { db.close(); resetAiSemaphoresForTest(); }
});

test("global provider concurrency is shared, bounded and always releasable", () => {
  const db = setup(); resetAiSemaphoresForTest();
  try {
    const left = createAiQuota(db, { maxConcurrency: 2, semaphoreName: "global" }); const right = createAiQuota(db, { maxConcurrency: 2, semaphoreName: "global" });
    const releaseOne = left.acquire(); const releaseTwo = right.acquire(); assert.deepEqual(left.snapshot(), { active: 2, maximum: 2 });
    assert.throws(() => left.acquire(), error => error.code === "AI_CHAT_BUSY");
    releaseOne(); const releaseThree = right.acquire(); assert.equal(right.snapshot().active, 2); releaseTwo(); releaseThree(); assert.equal(left.snapshot().active, 0);
  } finally { db.close(); resetAiSemaphoresForTest(); }
});

test("daily budget is capability-specific and completion is idempotent", () => {
  const db = setup(); const quota = createAiQuota(db, { daily: 1, semaphoreName: "daily" });
  try {
    const reservation = quota.reserve({ projectId: "project", userId: "user", capability: "chat", request: "one" }); quota.complete(reservation, "succeeded", 5); quota.complete(reservation, "failed", 10);
    assert.equal(db.prepare("SELECT status FROM ai_usage_events WHERE id = ?").get(reservation.id).status, "succeeded");
    assert.throws(() => quota.reserve({ projectId: "project", userId: "user", capability: "chat", request: "two" }), error => error.code === "AI_DAILY_QUOTA_EXCEEDED");
    assert.ok(quota.reserve({ projectId: "project", userId: "user", capability: "generation", request: "separate" }));
  } finally { db.close(); resetAiSemaphoresForTest(); }
});
