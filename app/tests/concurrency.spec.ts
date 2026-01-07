import { test, expect } from "./fixtures";

test.describe("Concurrency handling", () => {
  test("shows overwrite warning when saving with stale revision", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    // Open the welcome file
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("/MyNotes/Welcome.md");
    });

    // Bump revision behind the scenes to simulate another tab write
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStoreTest?.setRevisionForTest?.("welcome", 5);
    });

    // Force a save with stale revision
    const helperResult = await page.evaluate(() => {
      // @ts-expect-error test helper
      const current = window.__appStore?.getState().activeFile;
      // @ts-expect-error test helper
      const setRevision = window.__appStoreTest?.setRevisionForTest;
      // @ts-expect-error test helper
      const save = window.__appStore?.actions.saveContent;
      return {
        hasHelper: Boolean(setRevision),
        hasSave: Boolean(save),
        activeId: current?.id,
      };
    });
    expect(helperResult.hasHelper).toBe(true);
    expect(helperResult.hasSave).toBe(true);

    await page.evaluate(() => {
      // @ts-expect-error test helper
      const current = window.__appStore?.getState().activeFile;
      // @ts-expect-error test helper
      window.__appStoreTest?.setRevisionForTest?.("welcome", 5);
      // @ts-expect-error test helper
      return window.__appStore?.actions.saveContent((current?.content ?? "") + " concurrent");
    });

    await page.waitForFunction(() => {
      // @ts-expect-error test helper
      return window.__appStore?.getState().ui.lastSaveOverwritten === true;
    });
    await expect(page.getByText("Overwritten by another save")).toBeVisible({ timeout: 5000 });
  });
});
