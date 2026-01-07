import { expect, test } from "@playwright/test";

test.describe("Product requirements coverage", () => {
  test("wiki link disambiguation prompts for duplicates", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      // @ts-expect-error test helper
      return (window.__appStore?.getState().files.length ?? 0) > 0;
    });
    const noteCount = await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.getState().files.filter((f: { path: string }) => f.path.endsWith("Note.md")).length ?? 0;
    });
    expect(noteCount).toBeGreaterThan(1);
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("[[Note]]");
    });
    const resolutionSize = await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.getState().ui.linkResolution?.options.length ?? 0;
    });
    expect(resolutionSize).toBeGreaterThan(1);
    await page.waitForFunction(() => {
      // @ts-expect-error test helper
      return Boolean(window.__appStore?.getState().ui.linkResolution);
    });
    await expect(page.getByText("Multiple matches")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Projects\/Note\.md/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /References\/Note\.md/ })).toBeVisible();
  });

  test("relative links open target files", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("/MyNotes/Links/Relative.md");
    });
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("../Welcome.md");
    });
    await expect(page.getByText("/MyNotes/Welcome.md").first()).toBeVisible({ timeout: 10000 });
  });

  test("autosave shows saving status", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await editor.type(" autosave");
    await expect(page.locator(".editor__status", { hasText: "Saved" })).toBeVisible({ timeout: 5000 });
  });

  test("renders image preview and download link", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Media").click();
    await page.getByText("Picture.png").click();
    await expect(page.getByRole("img", { name: /Picture/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download image/ })).toBeVisible();
  });

  test("renders PDF download option", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Docs").click();
    await page.getByText("File.pdf").click();
    await expect(page.getByRole("link", { name: /Download PDF/ })).toBeVisible();
  });
});
