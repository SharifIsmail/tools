import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE && fs.existsSync(process.env.PLAYWRIGHT_STORAGE_STATE)
  ? process.env.PLAYWRIGHT_STORAGE_STATE
  : path.join(process.cwd(), "tests", "storageState.withKey.json");

export default defineConfig({
  testDir: "./tests",
  timeout: 30 * 1000,
  retries: 0,
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    video: "retain-on-failure",
    storageState: fs.existsSync(storageStatePath) ? storageStatePath : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
