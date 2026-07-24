import assert from "node:assert/strict";
import test from "node:test";
import { startMaterialProcessingWorker } from "../src/materials/worker.mjs";

function waitFor(predicate, timeoutMs = 500) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error("condition timed out"));
      setTimeout(check, 5);
    }
    check();
  });
}

test("material worker reconciles startup state and drains queued work serially", async () => {
  let reconciled = 0;
  let calls = 0;
  let active = 0;
  let peak = 0;
  const processor = {
    reconcileAbandonedJobs() { reconciled += 1; },
    async processNext() {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      calls += 1;
      return calls <= 2 ? { status: "ready" } : null;
    }
  };

  const worker = startMaterialProcessingWorker(processor, { idleDelayMs: 10 });
  await waitFor(() => calls >= 3);
  await worker.stop();

  assert.equal(reconciled, 1);
  assert.equal(peak, 1);
  assert.equal(calls, 3);
});

test("material worker reports errors and continues polling", async () => {
  let calls = 0;
  const errors = [];
  const processor = {
    reconcileAbandonedJobs() {},
    async processNext() {
      calls += 1;
      if (calls === 1) throw new Error("temporary");
      return null;
    }
  };

  const worker = startMaterialProcessingWorker(processor, {
    idleDelayMs: 10,
    errorDelayMs: 1,
    onError(error) { errors.push(error.message); }
  });
  await waitFor(() => calls >= 2);
  await worker.stop();

  assert.deepEqual(errors, ["temporary"]);
});
