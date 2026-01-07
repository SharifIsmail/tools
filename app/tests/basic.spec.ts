import { test, expect } from "@playwright/test";

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
    const input = page.getByPlaceholder("Search files...").first();
    await input.waitFor({ state: "visible" });
    await input.fill("Outside");
    await page.getByRole("button", { name: /Outside/ }).first().click();
    const editor = page.getByRole("textbox", { name: "Document editor" });
    await editor.click();
    await editor.type(" update");
    await expect(page.getByText("Editing copy")).toBeVisible({ timeout: 15000 });
  });
});
