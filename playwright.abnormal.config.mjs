import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_ABNORMAL_PORT || process.env.E2E_PORT || 4193);
const baseURL = `http://127.0.0.1:${port}`;
process.env.E2E_PORT = String(port);

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "06-abnormal-material-inputs.spec.mjs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  globalSetup: "./test/e2e/global-setup.mjs",
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    storageState: ".e2e-auth/admin.json",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node test/e2e/fixtures/server.mjs",
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 420_000,
    env: {
      ...process.env,
      E2E_PORT: String(port),
      XUGU_PORT: process.env.XUGU_PORT || "55142",
      XUGU_CONTAINER: process.env.XUGU_CONTAINER || "ai-platform-playwright-abnormal-xugu",
      XUGU_VOLUME: process.env.XUGU_VOLUME || "ai-platform-playwright-abnormal-xugu-data",
      PLATFORM_BOOTSTRAP_PASSWORD: "e2e-platform-admin-pw"
    }
  }
});
