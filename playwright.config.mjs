import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;
process.env.E2E_PORT = String(port);

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: /0[1-5]-.*\.spec\.mjs$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  globalSetup: "./test/e2e/global-setup.mjs",
  projects: [
    {
      name: "domain-contracts",
      testMatch: /0[1-5]-.*\.spec\.mjs$/,
      use: { storageState: ".e2e-auth/admin.json" }
    }
  ],
  webServer: {
    command: "node test/e2e/fixtures/server.mjs",
    url: `${baseURL}/health`,
    reuseExistingServer: true,
    timeout: 420_000,
    env: {
      ...process.env,
      E2E_PORT: String(port),
      XUGU_PORT: process.env.XUGU_PORT || "55140",
      XUGU_CONTAINER: process.env.XUGU_CONTAINER || "ai-platform-playwright-xugu",
      XUGU_VOLUME: process.env.XUGU_VOLUME || "ai-platform-playwright-xugu-data",
      PLATFORM_BOOTSTRAP_PASSWORD: "e2e-platform-admin-pw",
    },
  },
});
