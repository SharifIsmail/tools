import { test, expect } from "./fixtures";

test.describe("Indexing status", () => {
  test("runs indexer and settles to idle without API key", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    // Wait for indexer to report running at least once, then idle
    await page.waitForFunction(() => {
      // @ts-expect-error test helper
      const status = window.__appStore?.getState().ui.indexingStatus;
      return status === "running";
    }, { timeout: 10000 });

    await page.waitForFunction(() => {
      // @ts-expect-error test helper
      const status = window.__appStore?.getState().ui.indexingStatus;
      return status === "idle";
    }, { timeout: 10000 });

    await expect(page.locator(".status-bar")).toContainText("Indexing idle");
  });
});
