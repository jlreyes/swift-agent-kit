import { defineConfig, devices } from "@playwright/test";

const serverPort = 4173;
const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${serverPort}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm start -- --port ${serverPort}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    url: `http://127.0.0.1:${serverPort}/showcase`,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit-phone",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
