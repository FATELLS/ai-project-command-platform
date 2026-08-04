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

const validTargets = [
  "linux-arm64",
  "linux-x86_64",
  "windows-amd64",
  "macos-arm64",
  "macos-x86_64"
];

if (!validTargets.includes(target) || !runtimeDirectory || !outputDirectory) {
  throw new Error(
    `usage: node scripts/assemble-release.mjs --target <${validTargets.join("|")}> --runtime <directory> --output <directory> [--skip-install]`
  );
}

const output = resolve(outputDirectory);
const runtime = resolve(runtimeDirectory);
const runtimeNode = join(runtime, "bin", "node");
await stat(runtimeNode);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// ── 复制核心文件 ──────────────────────────────────────────────
for (const entry of ["server.mjs", "package.json", "package-lock.json", "README.md", ".env.example", "public", "src"]) {
  await cp(join(root, entry), join(output, entry), { recursive: true });
}

// ── 复制脚本 ──────────────────────────────────────────────────
await mkdir(join(output, "scripts"), { recursive: true });
await cp(join(root, "scripts", "manage-server.mjs"), join(output, "scripts", "manage-server.mjs"));
await cp(join(root, "scripts", "bootstrap-runtime.sh"), join(output, "scripts", "bootstrap-runtime.sh"));

// ── 复制 vendor（虚谷二进制 + 驱动 + 镜像）──────────────────
await cp(join(root, "vendor", "xugudb"), join(output, "vendor", "xugudb"), { recursive: true });

// ── 复制 Node.js runtime ─────────────────────────────────────
await cp(runtime, join(output, "runtime"), { recursive: true, dereference: false, verbatimSymlinks: true });
await mkdir(join(output, "data"), { recursive: true });

// ── 按平台复制启动脚本 ────────────────────────────────────────
const [os] = target.split("-");

if (os === "windows") {
  // Windows: start.bat / stop.bat
  await cp(join(root, "packaging", "windows", "start.bat"), join(output, "start.bat"));
  await cp(join(root, "packaging", "windows", "stop.bat"), join(output, "stop.bat"));
  await cp(join(root, "packaging", "windows", "README-WINDOWS.txt"), join(output, "README-WINDOWS.txt"));
} else if (os === "macos") {
  await cp(join(root, "packaging", "macos", "start.sh"), join(output, "start.sh"));
  await cp(join(root, "packaging", "macos", "stop.sh"), join(output, "stop.sh"));
  await cp(join(root, "packaging", "macos", "README-MACOS.txt"), join(output, "README-MACOS.txt"));
  await chmod(join(output, "start.sh"), 0o755);
  await chmod(join(output, "stop.sh"), 0o755);
  await chmod(join(output, "runtime", "bin", "node"), 0o755);
} else {
  // Linux
  await cp(join(root, "packaging", "linux", "start.sh"), join(output, "start.sh"));
  await cp(join(root, "packaging", "linux", "stop.sh"), join(output, "stop.sh"));
  await cp(join(root, "packaging", "linux", "README-LINUX.txt"), join(output, "README-LINUX.txt"));
  await chmod(join(output, "start.sh"), 0o755);
  await chmod(join(output, "stop.sh"), 0o755);
  await chmod(join(output, "runtime", "bin", "node"), 0o755);
}

// ── 安装生产依赖 ──────────────────────────────────────────────
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

// ── 审计：确保不含敏感数据 ────────────────────────────────────
const forbiddenNames = new Set([
  ".env.local",
  ".planning",
  "fixtures",
  "test",
  "test-results",
  "playwright-report",
  "first-run-credentials.txt",
  "bootstrap-credentials.txt"
]);
const forbiddenExtensions = [".log"];

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
