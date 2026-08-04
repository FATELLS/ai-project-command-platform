// ============================================================
// local-config.mjs — 本地 API 配置文件加载器
//
// 用户可以将 API 密钥等敏感配置放在 .api-keys.local.json 中，
// 该文件被 .gitignore 排除，不会提交到版本控制。
//
// 启动时自动检测并加载该文件，将配置注入 process.env。
// 同时提供 loadEnvFiles()：加载包根目录的 .env / .env.local，
// 确保源码运行和 portable 包都能读取相同的 .env.local 配置。
//
// 如果文件不存在，自动生成一个空模板方便用户填写。
// ============================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_FILENAME = ".api-keys.local.json";
const EXAMPLE_FILENAME = "api-config.example.json";

/**
 * 本文件位于 src/config/local-config.mjs
 * 包根目录 = ../../ (src/config/ → src/ → 包根)
 */
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * 获取配置文件路径
 * - 环境变量覆盖: PLATFORM_CONFIG_DIR（Docker/systemd 部署）
 * - 默认: 应用根目录
 */
function getConfigPath() {
  if (process.env.PLATFORM_CONFIG_DIR) {
    return join(resolve(process.env.PLATFORM_CONFIG_DIR), CONFIG_FILENAME);
  }
  return join(packageRoot, CONFIG_FILENAME);
}

/**
 * 配置文件的字段模板
 */
const CONFIG_TEMPLATE = {
  _comment: "本文件包含敏感 API 配置，已被 .gitignore 排除。填写后重启服务生效。",
  _comment2: "provider: disabled 或 openai-compatible",
  _comment3: "baseUrl / model / allowedHosts 请填写您使用的 AI 服务商信息",
  aiGeneration: {
    provider: "disabled",
    baseUrl: "",
    apiKey: "",
    model: "",
    allowedHosts: "",
    reasoningEffort: "",
    providerLabel: ""
  },
  aiChat: {
    provider: "disabled",
    baseUrl: "",
    apiKey: "",
    model: "",
    allowedHosts: ""
  },
  aiVision: {
    provider: "disabled",
    baseUrl: "",
    apiKey: "",
    model: "",
    allowedHosts: ""
  }
};

/**
 * 确保配置文件存在。不存在时自动生成模板。
 */
export function ensureLocalConfig() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    const dir = resolve(configPath, "..");
    mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, JSON.stringify(CONFIG_TEMPLATE, null, 2) + "\n", "utf8");
    console.log(`  已生成本地 API 配置模板: ${configPath}`);
    console.log(`  请编辑该文件填入 API 密钥，或通过网页后台设置 → AI 配置。`);
    return { configPath, config: CONFIG_TEMPLATE, generated: true };
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    return { configPath, config, generated: false };
  } catch (error) {
    console.warn(`  ⚠ 本地配置文件解析失败 (${configPath}) | code=LOCAL_CONFIG_PARSE_FAILED`);
    return { configPath, config: CONFIG_TEMPLATE, generated: false, error: true };
  }
}

/**
 * 将配置文件的值注入 process.env（仅在对应 env 变量为空时）。
 * 环境变量优先于配置文件——这样 Docker/systemd 部署仍可覆盖。
 */
export function loadLocalConfigToEnv() {
  const { configPath, config, generated } = ensureLocalConfig();
  if (generated) return { configPath, loaded: false, generated: true };

  const scopes = [
    { key: "aiGeneration", prefix: "AI_GENERATION" },
    { key: "aiChat", prefix: "AI_CHAT" },
    { key: "aiVision", prefix: "AI_VISION" }
  ];

  let injected = 0;
  for (const { key, prefix } of scopes) {
    const section = config[key];
    if (!section || typeof section !== "object") continue;

    const mapping = {
      provider: `${prefix}_PROVIDER`,
      baseUrl: `${prefix}_BASE_URL`,
      apiKey: `${prefix}_API_KEY`,
      model: `${prefix}_MODEL`,
      allowedHosts: `${prefix}_ALLOWED_HOSTS`,
      reasoningEffort: `${prefix}_REASONING_EFFORT`,
      providerLabel: `${prefix}_PROVIDER_LABEL`
    };

    for (const [field, envKey] of Object.entries(mapping)) {
      const value = section[field];
      if (value !== undefined && value !== null && value !== "" && !process.env[envKey]) {
        process.env[envKey] = String(value);
        injected++;
      }
    }
  }

  if (injected > 0) {
    console.log(`  本地 API 配置已加载: ${configPath}（注入 ${injected} 项）`);
  }

  return { configPath, loaded: true, injected, generated: false };
}

/**
 * 解析单行 KEY=VALUE 格式的 env 文件。
 * 支持：注释（# 开头）、空行、引号包裹的值。
 */
function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex < 1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    // 去除引号包裹
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * 加载包根目录下的 .env 和 .env.local 文件。
 *
 * 这是平台入口的配置基础设施——server.mjs 直接调用此函数，
 * 不依赖 scripts/start-server.mjs 的 --env-file 参数。
 * 确保源码运行和 portable 包行为一致：
 *   1. 先加载 .env（如果存在）
 *   2. 再加载 .env.local（如果存在，覆盖 .env 同名键）
 *   3. 已有的 process.env 值优先——环境变量 > 文件 > 默认
 *
 * @returns {{ loaded: number, skipped: number }}
 */
export function loadEnvFiles(options = {}) {
  const rootDir = options.rootDir ?? packageRoot;
  const environment = options.environment ?? process.env;
  const externalKeys = new Set(Object.keys(environment));
  const fileValues = {};
  let loaded = 0;
  let skipped = 0;

  for (const filename of [".env", ".env.local"]) {
    const filePath = join(rootDir, filename);
    if (!existsSync(filePath)) continue;

    try {
      const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
      Object.assign(fileValues, parsed);
    } catch {
      // 读取/解析失败不影响启动，让后续逻辑用默认值
    }
  }

  for (const [key, value] of Object.entries(fileValues)) {
    if (externalKeys.has(key)) {
      skipped++;
      continue;
    }
    environment[key] = value;
    loaded++;
  }

  if (loaded > 0 && options.quiet !== true) {
    console.log(`  环境配置已加载（注入 ${loaded} 项，跳过 ${skipped} 项外部环境变量）`);
  }

  return { loaded, skipped };
}

export function loadRuntimeConfig(options = {}) {
  const envFiles = loadEnvFiles(options);
  const localConfig = loadLocalConfigToEnv();
  return { envFiles, localConfig };
}
