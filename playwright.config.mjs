import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4191);
const base = `http://127.0.0.1:${port}`;

// 全自动 E2E：webServer 在临时数据目录启动平台实例，导入 xugu/标准夹具与角色用户；
// 测试覆盖登录、路线图深链、材料→生成→审核→发布闭环与隔离回归。
export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./test/e2e/global-setup.mjs",
  use: {
    baseURL: base,
    storageState: ".e2e-auth/admin.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "node test/e2e/fixtures/server.mjs",
    url: `${base}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      E2E_PORT: String(port),
      E2E_DATA_DIR: process.env.E2E_DATA_DIR || "",
      PLATFORM_BOOTSTRAP_PASSWORD: "e2e-platform-admin-pw"
    }
  }
});
