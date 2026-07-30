import { chmod, cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const target = argumentsMap.get("--target");
const runtimeDirectory = argumentsMap.get("--runtime");
const outputDirectory = argumentsMap.get("--output");
const skipInstall = argumentsMap.has("--skip-install");
if (!["windows-x64", "linux-x64", "macos-x64", "macos-arm64"].includes(target) || !runtimeDirectory || !outputDirectory) {
  throw new Error("usage: node scripts/assemble-release.mjs --target windows-x64|linux-x64|macos-x64|macos-arm64 --runtime <directory> --output <directory> [--skip-install true]");
}

const output = resolve(outputDirectory);
const runtime = resolve(runtimeDirectory);
const runtimeNode = target === "windows-x64" ? join(runtime, "node.exe") : join(runtime, "bin", "node");
await stat(runtimeNode);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["server.mjs", "package.json", "package-lock.json", "README.md", ".env.example", "public", "src"]) {
  await cp(join(root, entry), join(output, entry), { recursive: true });
}
await cp(runtime, join(output, "runtime"), { recursive: true, dereference: false, verbatimSymlinks: true });
await mkdir(join(output, "data"), { recursive: true });

if (target === "windows-x64") {
  await cp(join(root, "packaging", "windows", "Start.ps1"), join(output, "Start.ps1"));
  await cp(join(root, "packaging", "windows", "Stop.ps1"), join(output, "Stop.ps1"));
  await cp(join(root, "packaging", "windows", "README-WINDOWS.txt"), join(output, "README-WINDOWS.txt"));
} else if (target.startsWith("macos-")) {
  await cp(join(root, "packaging", "macos", "start.sh"), join(output, "start.sh"));
  await cp(join(root, "packaging", "macos", "stop.sh"), join(output, "stop.sh"));
  await cp(join(root, "packaging", "macos", "README-MACOS.txt"), join(output, "README-MACOS.txt"));
  await chmod(join(output, "start.sh"), 0o755);
  await chmod(join(output, "stop.sh"), 0o755);
  await chmod(join(output, "runtime", "bin", "node"), 0o755);
} else {
  await cp(join(root, "packaging", "linux", "start.sh"), join(output, "start.sh"));
  await cp(join(root, "packaging", "linux", "stop.sh"), join(output, "stop.sh"));
  await cp(join(root, "packaging", "linux", "README-LINUX.txt"), join(output, "README-LINUX.txt"));
  await chmod(join(output, "start.sh"), 0o755);
  await chmod(join(output, "stop.sh"), 0o755);
  await chmod(join(output, "runtime", "bin", "node"), 0o755);
}

if (!skipInstall) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: output,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32"
  });
  if (install.status !== 0) {
    throw new Error(`production dependency install failed\n${install.error?.message ?? ""}\n${install.stdout ?? ""}\n${install.stderr ?? ""}`);
  }
}

const forbiddenNames = new Set([
  ".env.local",
  ".planning",
  "fixtures",
  "test",
  "test-results",
  "playwright-report",
  "platform.sqlite",
  "phase6-browser.sqlite",
  "first-run-credentials.txt",
  "bootstrap-credentials.txt"
]);
const forbiddenExtensions = [".sqlite", ".sqlite3", ".db", ".log"];

async function audit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (forbiddenNames.has(entry.name) || forbiddenExtensions.some(extension => entry.name.endsWith(extension))) {
      throw new Error(`release contains forbidden runtime/company data: ${path}`);
    }
    if (entry.isDirectory()) await audit(path);
  }
}
await audit(output);

const packageJson = JSON.parse(await readFile(join(output, "package.json"), "utf8"));
console.log(`Assembled ${packageJson.name} ${packageJson.version} for ${target}: ${basename(output)}`);
