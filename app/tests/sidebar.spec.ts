import { test, expect } from "./fixtures";

test.describe("Sidebar navigation", () => {
  test("opens folder index and files without console errors", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    // Home/root should render and expand by default
    await expect(page.getByText("Home")).toBeVisible();

    // Open Guide folder header should load its index markdown
    await page.getByText("Guide").click();
    await expect(page.locator(".editor__path", { hasText: "/MyNotes/Guide/Index.md" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".status-bar", { hasText: "Open: /MyNotes/Guide/Index.md" })).toBeVisible();
    await expect(page.locator(".tree-node__file", { hasText: "Index.md" })).toHaveCount(0);

    // Toggle to reveal files and open a nested note
    await page.getByText("Projects").click();
    await page.getByRole("button", { name: "Note.md" }).click();
    await expect(page.locator(".editor__path", { hasText: "/MyNotes/Projects/Note.md" })).toBeVisible({ timeout: 5000 });
  });
});
