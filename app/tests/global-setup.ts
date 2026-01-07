import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

async function ensureApiKey(statePath: string, apiKey?: string, baseURL = "http://localhost:4173") {
  if (!apiKey) return;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: fs.existsSync(statePath) ? statePath : undefined,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate((key) => {
    localStorage.setItem("app.ai.apiKey", key);
  }, apiKey);
  await context.storageState({ path: statePath });
  await browser.close();
}

export default async function globalSetup() {
  if (process.env.VITE_E2E === "true") return;
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY_TEST;
  const statePath =
    process.env.PLAYWRIGHT_STORAGE_STATE && fs.existsSync(process.env.PLAYWRIGHT_STORAGE_STATE)
      ? process.env.PLAYWRIGHT_STORAGE_STATE
      : path.join(process.cwd(), "tests", "storageState.withKey.json");
  await ensureApiKey(statePath, apiKey);
}
