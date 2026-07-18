import { spawn, spawnSync } from "node:child_process";
import { ExtractionError, MissingCapabilityError } from "./common.mjs";

export function hasCommand(command) {
  const result = spawnSync(command, ["--version"], { shell: false, stdio: "ignore", timeout: 2_000 });
  return !result.error && result.status === 0;
}

export function runBounded(command, args, { commandTimeoutMs: timeoutMs, maxCommandOutputBytes: maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH || "/usr/bin:/bin", LANG: "C.UTF-8" } });
    const stdout = []; let size = 0; let settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(Buffer.concat(stdout).toString("utf8")); };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(new ExtractionError("extractor_timeout", "Extractor exceeded its time limit")); }, timeoutMs);
    child.stdout.on("data", chunk => { size += chunk.length; if (size > maxOutputBytes) { child.kill("SIGKILL"); finish(new ExtractionError("extractor_output_too_large", "Extractor output exceeds its limit")); } else stdout.push(chunk); });
    child.on("error", error => finish(error.code === "ENOENT" ? new MissingCapabilityError(command) : new ExtractionError("extractor_failed", "Extractor could not start")));
    child.on("close", code => finish(code === 0 ? null : new ExtractionError("extractor_failed", "Extractor returned a failure")));
  });
}
