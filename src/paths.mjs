// 资源路径兼容层
// pkg 打包后 import.meta.url 指向虚拟路径 (snapshot/)，
// 需要用 process.execPath 推算真实资源目录。
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 是否在 pkg 打包的二进制中运行
export const isPackaged = !!process.pkg;

// 应用根目录
// - 开发模式: import.meta.url 推算
// - 打包模式: process.execPath 的同级目录（二进制旁的 app/ 目录）
function findAppRoot() {
  if (isPackaged) {
    // 打包后，资源文件通过 pkg.assets 打进二进制，路径是 snapshot/
    // 但 migrations 和 public 不一定都在 snapshot 里
    // 实际安装时，资源放在二进制同级目录 (如 /opt/ai-platform/)
    return dirname(process.execPath);
  }
  return fileURLToPath(new URL("../..", import.meta.url));
}

export const appRoot = findAppRoot();

// migrations 目录
export const migrationsDir = isPackaged
  ? join(appRoot, "migrations")
  : fileURLToPath(new URL("../db/migrations", import.meta.url));

// public 目录
export const publicDir = isPackaged
  ? join(appRoot, "public")
  : fileURLToPath(new URL("../../public", import.meta.url));

// fixtures 目录
export const fixturesDir = isPackaged
  ? join(appRoot, "fixtures")
  : fileURLToPath(new URL("../../fixtures", import.meta.url));
