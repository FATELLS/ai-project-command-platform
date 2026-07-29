import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: "chromium",
      },
    },
  ],
  // 不自动启动服务器——由测试运行前手动启动
  webServer: undefined,
});
