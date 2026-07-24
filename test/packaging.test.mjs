import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

test("release assembler uses an explicit runtime allowlist and excludes company/runtime data", async () => {
  const directory = mkdtempSync(join(tmpdir(), "platform-release-"));
  const runtime = join(directory, "runtime");
  const output = join(directory, "output");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(join(runtime, "bin"), { recursive: true }));
  const fakeNode = join(runtime, "bin", "node");
  writeFileSync(fakeNode, "#!/bin/sh\nexit 0\n");
  chmodSync(fakeNode, 0o755);

  const result = spawnSync(process.execPath, [
    "scripts/assemble-release.mjs",
    "--target", "linux-x64",
    "--runtime", runtime,
    "--output", output,
    "--skip-install", "true"
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const required of ["server.mjs", "public", "src", "start.sh", "stop.sh", "runtime"]) {
    assert.equal(existsSync(join(output, required)), true, `missing ${required}`);
  }
  for (const forbidden of ["fixtures", ".planning", "test", ".env.local", "platform.sqlite"]) {
    assert.equal(existsSync(join(output, forbidden)), false, `release leaked ${forbidden}`);
  }
  assert.deepEqual(await readdir(join(output, "data")), []);
});

test("RPM and portable launchers bootstrap an empty isolated data directory", async () => {
  const service = readFileSync(new URL("../packaging/linux/ai-project-command-platform.service", import.meta.url), "utf8");
  const spec = readFileSync(new URL("../packaging/linux/ai-project-command-platform.spec", import.meta.url), "utf8");
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(service, /PLATFORM_DATA_DIR|EnvironmentFile/);
  assert.match(spec, /systemctl enable --now ai-project-command-platform/);
  assert.match(spec, /bootstrap-credentials\.txt/);
  assert.match(server, /PLATFORM_SEED_FIXTURE/);
  assert.doesNotMatch(server, /fixtures\/projects\/xugu-agentic-group\.json/);
});
