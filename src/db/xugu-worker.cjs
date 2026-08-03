const { parentPort, workerData } = require("worker_threads");

const control = new Int32Array(workerData.control);
const output = new Uint8Array(workerData.output);
const encoder = new TextEncoder();

function serializable(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("utf8");
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializable(item)]));
  }
  return value;
}

function respond(payload, isError = false) {
  const bytes = encoder.encode(JSON.stringify(payload));
  if (bytes.length > output.length) {
    return respond({ message: `Xugu worker result exceeds ${output.length} bytes` }, true);
  }
  output.fill(0, 0, Atomics.load(control, 1));
  output.set(bytes);
  Atomics.store(control, 1, bytes.length);
  Atomics.store(control, 2, isError ? 1 : 0);
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
}

let connection;
try {
  const driver = require(workerData.driverPath);
  connection = driver.createConnection(workerData.connectionString);
  connection.connect();
  respond({ ready: true });
} catch (error) {
  respond({ message: error?.message || error?.Error || String(error) }, true);
}

parentPort.on("message", message => {
  try {
    if (message.action === "query") {
      const callback = (error, rows) => {
        if (error) {
          const text = error?.message || error?.Error || String(error);
          respond({ message: text }, true);
          return;
        }
        respond({ rows: serializable(rows) });
      };
      try {
        if (message.params?.length) connection.query(message.sql, message.params, callback);
        else connection.query(message.sql, callback);
      } catch (error) {
        throw error;
      }
      return;
    }
    if (message.action === "begin") connection.beginTransaction();
    else if (message.action === "commit") connection.commit();
    else if (message.action === "rollback") connection.rollback();
    else if (message.action === "close") {
      connection.disconnect();
      respond({ closed: true });
      return;
    } else throw new Error(`Unknown Xugu worker action: ${message.action}`);
    respond({ ok: true });
  } catch (error) {
    respond({ message: error?.message || error?.Error || String(error) }, true);
  }
});
