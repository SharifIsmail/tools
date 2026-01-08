import { test, expect } from "./fixtures";

const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY_TEST || process.env.VITE_GEMINI_API_KEY;
const MODEL = process.env.VITE_GEMINI_MODEL || "models/gemini-flash-lite-latest";

test.describe("Gemini integration (live)", () => {
  test.skip(!GEMINI_KEY, "Requires VITE_GEMINI_API_KEY_TEST or VITE_GEMINI_API_KEY");

  test("calls Gemini and completes indexing", async ({ page }) => {
    const reqPromise = page.waitForRequest((req) => req.url().includes(`${MODEL}:generateContent`), { timeout: 30000 });

    await page.addInitScript((key, model) => {
      localStorage.setItem("app.ai.apiKey", key);
      // @ts-expect-error force live Gemini in dev/e2e
      window.__forceRealGemini = true;
      // @ts-expect-error override model for tests
      window.__geminiModel = model;
    }, GEMINI_KEY!, MODEL);

    await page.goto("/");
    const debugHandle = await page.waitForFunction(() => (window as unknown as { __geminiDebug?: unknown }).__geminiDebug, {
      timeout: 15000,
    });
    console.log("Gemini debug", await debugHandle.jsonValue());
    await reqPromise;
    await page.getByText("Saved · Indexing idle").waitFor({ timeout: 60000 });
    const hasError = await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.getState().ui.indexingError;
    });
    expect(hasError).toBeUndefined();
  });
});
