import { test, expect } from "./fixtures";

test.describe("App shell", () => {
  test("loads and opens command palette", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Files")).toBeVisible({ timeout: 15000 });
    await page.keyboard.press("Control+K");
    await expect(page.getByPlaceholder("Search files...")).toBeVisible();
  });

  test("shows copy badge when editing external file", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible", timeout: 15000 });
    await page.keyboard.press("Control+K");
    await page.getByPlaceholder("Search files...").fill("Outside");
    await page.getByRole("button", { name: /Outside\.md/ }).click();
    const editorHost = page.locator('.milkdown[data-editor-ready="true"]').first();
    await editorHost.waitFor({ state: "visible", timeout: 15000 });
    const editor = editorHost.locator(".ProseMirror").first();
    await page.waitForTimeout(300);
    await editor.click();
    await editor.type(" update");
    await expect(page.getByText("Editing copy")).toBeVisible({ timeout: 15000 });
  });
});
