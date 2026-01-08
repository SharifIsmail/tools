import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env for local runs so live Gemini tests can use .env/.env.local
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true }); // allow .env.local to override defaults

process.env.VITE_E2E = process.env.VITE_E2E ?? "true";

const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE && fs.existsSync(process.env.PLAYWRIGHT_STORAGE_STATE)
  ? process.env.PLAYWRIGHT_STORAGE_STATE
  : path.join(process.cwd(), "tests", "storageState.withKey.json");

export default defineConfig({
  testDir: "./tests",
  timeout: 30 * 1000,
  retries: 0,
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    video: "retain-on-failure",
    storageState: fs.existsSync(storageStatePath) ? storageStatePath : undefined,
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "VITE_E2E=1 VITE_GEMINI_MODEL=models/gemini-flash-lite-latest npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
