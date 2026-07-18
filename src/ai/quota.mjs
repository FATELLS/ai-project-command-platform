import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { AiServiceError } from "./errors.mjs";

const globalSemaphores = new Map();
function semaphore(name, maximum) { if (!globalSemaphores.has(name)) globalSemaphores.set(name, { active: 0, maximum }); const value = globalSemaphores.get(name); value.maximum = maximum; return value; }

export function createAiQuota(database, options = {}) {
  const now = options.now ?? Date.now;
  const perMinute = options.perMinute ?? 12;
  const daily = options.daily ?? 300;
  const gate = semaphore(options.semaphoreName ?? "ai-provider-global", options.maxConcurrency ?? 2);

  function reserve({ projectId, userId, capability, request }) {
    if (!new Set(["chat", "generation"]).has(capability)) throw new TypeError("Unknown AI capability");
    const timestamp = now(); const id = randomUUID();
    let rejection;
    withTransaction(database, () => {
      const minute = database.prepare(`SELECT count(*) AS count FROM ai_usage_events WHERE project_id = ? AND user_id = ? AND capability = ? AND status IN ('reserved','succeeded','failed') AND created_at >= ?`)
        .get(projectId, userId, capability, new Date(timestamp - 60_000).toISOString()).count;
      const dayStart = new Date(timestamp); dayStart.setUTCHours(0, 0, 0, 0);
      const day = database.prepare(`SELECT count(*) AS count FROM ai_usage_events WHERE capability = ? AND status IN ('reserved','succeeded','failed') AND created_at >= ?`)
        .get(capability, dayStart.toISOString()).count;
      if (minute >= perMinute) rejection = "AI_RATE_LIMITED"; else if (day >= daily) rejection = "AI_DAILY_QUOTA_EXCEEDED";
      database.prepare(`INSERT INTO ai_usage_events (id, project_id, user_id, capability, units, request_hash, status, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`)
        .run(id, projectId, userId, capability, createHash("sha256").update(String(request ?? "")).digest("hex"), rejection ? "rejected" : "reserved", new Date(timestamp).toISOString());
    });
    if (rejection) throw new AiServiceError(rejection, "AI quota exceeded", 429);
    return { id, capability };
  }

  function complete(reservation, status = "succeeded", units = 1) {
    if (!new Set(["succeeded", "failed"]).has(status)) throw new TypeError("Invalid quota completion status");
    database.prepare("UPDATE ai_usage_events SET status = ?, units = ? WHERE id = ? AND capability = ? AND status = 'reserved'")
      .run(status, Math.max(1, Math.floor(units || 1)), reservation.id, reservation.capability);
  }

  function acquire() {
    if (gate.active >= gate.maximum) throw new AiServiceError("AI_CHAT_BUSY", "AI provider concurrency is full", 429);
    gate.active += 1; let released = false;
    return () => { if (!released) { released = true; gate.active -= 1; } };
  }

  function snapshot() { return { active: gate.active, maximum: gate.maximum }; }
  return Object.freeze({ reserve, complete, acquire, snapshot });
}

export function resetAiSemaphoresForTest() { globalSemaphores.clear(); }
