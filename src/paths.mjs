// 源码与 portable 包保持相同目录结构，统一从 import.meta.url 定位资源。
import { fileURLToPath } from "node:url";

export const appRoot = fileURLToPath(new URL("..", import.meta.url));
export const migrationsDir = fileURLToPath(new URL("./db/xugu-migrations", import.meta.url));
export const publicDir = fileURLToPath(new URL("../public", import.meta.url));
