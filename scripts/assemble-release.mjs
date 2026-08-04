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

// Node.js 官方包目录结构差异：
//   Linux/macOS: node-vXX-linux-arm64/bin/node
//   Windows:     node-vXX-win-x64/node.exe   (无 bin/ 子目录)
const runtimeNodeUnix = join(runtime, "bin", "node");
const runtimeNodeWin = join(runtime, "node.exe");
let runtimeNode;
if (await stat(runtimeNodeUnix).then(() => true).catch(() => false)) {
  runtimeNode = runtimeNodeUnix;
} else if (await stat(runtimeNodeWin).then(() => true).catch(() => false)) {
  runtimeNode = runtimeNodeWin;
} else {
  throw new Error(`Node.js binary not found at ${runtimeNodeUnix} or ${runtimeNodeWin}`);
}

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

// ── 复制 vendor（按平台裁剪：只放该平台需要的虚谷二进制/驱动/镜像）──
await mkdir(join(output, "vendor", "xugudb", "nodejs"), { recursive: true });
await mkdir(join(output, "vendor", "xugudb", "image"), { recursive: true });

// 1) Node.js 原生驱动：只复制该平台需要的
const driverMap = {
  "linux-arm64":    "xugudbjs-linux-aarch64.node",
  "linux-x86_64":   "xugudbjs-linux-x86_64.node",
  "windows-amd64":  "xugudbjs-win32-x64.node",
  "macos-arm64":    "xugudbjs.node",
  "macos-x86_64":   "xugudbjs.node"
};
const driverFile = driverMap[target];
const driverSrc = join(root, "vendor", "xugudb", "nodejs", driverFile);
if (await stat(driverSrc).then(() => true).catch(() => false)) {
  await cp(driverSrc, join(output, "vendor", "xugudb", "nodejs", driverFile));
}

// 2) Docker 镜像：Linux/macOS managed 模式需要，Windows native 模式不需要
const imageArch = target.includes("arm64") ? "arm64" : "amd64";
const manifestSrc = join(root, "vendor", "xugudb", "image", "manifest.json");
if (await stat(manifestSrc).then(() => true).catch(() => false)) {
  const manifest = JSON.parse(await readFile(manifestSrc, "utf8"));
  // 复制 manifest.json
  await cp(manifestSrc, join(output, "vendor", "xugudb", "image", "manifest.json"));
  // 复制对应架构的镜像 tar.gz
  for (const [archName, entry] of Object.entries(manifest.images || {})) {
    if (archName !== imageArch) continue;
    const archiveSrc = join(root, "vendor", "xugudb", "image", entry.archive);
    if (await stat(archiveSrc).then(() => true).catch(() => false)) {
      await cp(archiveSrc, join(output, "vendor", "xugudb", "image", entry.archive));
    }
  }
}

// 3) 虚谷服务端二进制：native 模式需要，只复制对应平台
const [targetOs, targetArch] = target.split("-");
if (targetOs === "linux") {
  const archDir = targetArch === "arm64" ? "aarch64" : "x86_64";
  const serverSrc = join(root, "vendor", "xugudb", "server", "linux", archDir);
  if (await stat(serverSrc).then(() => true).catch(() => false)) {
    await cp(serverSrc, join(output, "vendor", "xugudb", "server", "linux", archDir), { recursive: true });
  }
} else if (targetOs === "windows") {
  const serverSrc = join(root, "vendor", "xugudb", "server", "windows", "amd64");
  if (await stat(serverSrc).then(() => true).catch(() => false)) {
    await cp(serverSrc, join(output, "vendor", "xugudb", "server", "windows", "amd64"), { recursive: true });
  }
}
// macOS 无 native 服务端二进制，不复制 server 目录

// ── 复制 Node.js runtime（统一为 runtime/bin/node 结构）──────────
// Windows 官方包是 node-vXX-win-x64/node.exe，Linux/macOS 是 node-vXX-xxx/bin/node
// 统一输出为 output/runtime/bin/node(.exe)
await mkdir(join(output, "runtime", "bin"), { recursive: true });
if (target.startsWith("windows")) {
  // Windows: node.exe 直接在根目录
  await cp(join(runtime, "node.exe"), join(output, "runtime", "bin", "node.exe"));
} else {
  // Linux/macOS: node 在 bin/ 下
  await cp(join(runtime, "bin", "node"), join(output, "runtime", "bin", "node"));
  // 复制 npm 相关文件（npm ci 需要）
  for (const extra of ["npm", "npx", "corepack"]) {
    const extraPath = join(runtime, "bin", extra);
    if (await stat(extraPath).then(() => true).catch(() => false)) {
      await cp(extraPath, join(output, "runtime", "bin", extra));
    }
  }
  // 复制 lib/ 和 include/（npm 运行需要）
  for ( const libDir of ["lib"]) {
    const libPath = join(runtime, libDir);
    if (await stat(libPath).then(() => true).catch(() => false)) {
      await cp(libPath, join(output, "runtime", libDir), { recursive: true });
    }
  }
}
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
