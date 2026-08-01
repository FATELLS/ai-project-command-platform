// ============================================================
// local-config.mjs — 本地 API 配置文件加载器
//
// 用户可以将 API 密钥等敏感配置放在 .api-keys.local.json 中，
// 该文件被 .gitignore 排除，不会提交到版本控制。
//
// 启动时自动检测并加载该文件，将配置注入 process.env。
// 如果文件不存在，自动生成一个空模���方便用户填写。
// ============================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const CONFIG_FILENAME = ".api-keys.local.json";
const EXAMPLE_FILENAME = "api-config.example.json";

/**
 * 本文件位于 src/config/local-config.mjs
 * 包根目录 = ../../ (src/config/ → src/ → 包根)
 */
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * 检测是否在 npx 缓存目录或 node_modules 中运行（非本地开发）。
 * 这些路径不可靠（npx 清缓存会丢失），fallback 到用户主目录稳定路径。
 */
function isInstalledPackage() {
  return packageRoot.includes("_npx") ||
    packageRoot.includes(".npm/_npx") ||
    packageRoot.includes("node_modules");
}

/**
 * 获取配置文件路径
 * - 环境变量覆盖: PLATFORM_CONFIG_DIR（Docker/systemd 部署）
 * - npx/npm install 模式: 用户主目录下的稳定路径
 * - 本地开发: 包根目录
 */
function getConfigPath() {
  if (process.env.PLATFORM_CONFIG_DIR) {
    return join(resolve(process.env.PLATFORM_CONFIG_DIR), CONFIG_FILENAME);
  }
  if (isInstalledPackage()) {
    return join(homedir(), ".ai-project-command-platform", CONFIG_FILENAME);
  }
  return join(packageRoot, CONFIG_FILENAME);
}

/**
 * 配置文件的字段模板
 */
const CONFIG_TEMPLATE = {
  _comment: "本文件包含敏感 API 配置，已被 .gitignore 排除。填写后重启服务生效。",
  _comment2: "provider: disabled 或 openai-compatible",
  aiGeneration: {
    provider: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    apiKey: "",
    model: "glm-4.6",
    allowedHosts: "open.bigmodel.cn",
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
    model: "glm-4.6v",
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
    console.warn(`  ⚠ 本地配置文件解析失败 (${configPath}): ${error.message}`);
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
