export function startMaterialProcessingWorker(processor, options = {}) {
  const idleDelayMs = options.idleDelayMs ?? 500;
  const busyDelayMs = options.busyDelayMs ?? 0;
  const errorDelayMs = options.errorDelayMs ?? 1_000;
  const onError = options.onError ?? (() => {});
  let stopped = false;
  let timer = null;
  let running = null;

  function schedule(delayMs) {
    if (stopped) return;
    timer = setTimeout(run, delayMs);
    timer.unref?.();
  }

  async function run() {
    if (stopped || running) return;
    timer = null;
    running = Promise.resolve()
      .then(() => processor.processNext())
      .then(result => {
        schedule(result ? busyDelayMs : idleDelayMs);
        return result;
      })
      .catch(error => {
        onError(error);
        schedule(errorDelayMs);
      })
      .finally(() => {
        running = null;
      });
    await running;
  }

  processor.reconcileAbandonedJobs();
  schedule(0);

  return Object.freeze({
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (running) await running;
    }
  });
}
