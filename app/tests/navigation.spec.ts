import { test, expect } from "./fixtures";

test.describe("Navigation flows", () => {
  test("relative link click navigates to target file", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    // Open the relative link note
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("/MyNotes/Links/Relative.md");
    });
    const editorHost = page.locator('.milkdown[data-editor-ready="true"]').first();
    await editorHost.waitFor({ state: "visible", timeout: 10000 });
    await editorHost.locator('a:has-text("Go")').click();

    await expect(page.locator(".editor__path", { hasText: "/MyNotes/Welcome.md" })).toBeVisible({ timeout: 5000 });
    await expect(editorHost).toContainText("personal assistant scratchpad", { timeout: 5000 });
  });

  test("command palette opens external file and copy-on-edit moves it into Imported", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    await page.keyboard.press("Control+K");
    await page.getByPlaceholder("Search files...").fill("Outside");
    await page.getByRole("button", { name: /Outside\.md/ }).click();

    const editorHost = page.locator('.milkdown[data-editor-ready="true"]').first();
    await editorHost.waitFor({ state: "visible", timeout: 10000 });
    await expect(page.locator(".editor__path", { hasText: "/Shared/Outside.md" })).toBeVisible();

    const editor = editorHost.locator(".ProseMirror").first();
    await editor.click();
    await editor.type(" edited");

    await page.waitForFunction(() => {
      const el = document.querySelector(".editor__path");
      return el?.textContent?.includes("/MyNotes/Imported/Shared/Outside.md");
    });
    await expect(page.getByText("Editing copy")).toBeVisible();
  });

  test("absolute link navigates to target", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("/MyNotes/Links/Absolute.md");
    });
    const editorHost = page.locator('.milkdown[data-editor-ready="true"]').first();
    await editorHost.waitFor({ state: "visible", timeout: 10000 });
    await editorHost.locator('a:has-text("Open Absolute")').click();
    await expect(page.locator(".editor__path", { hasText: "/MyNotes/Projects/Note.md" })).toBeVisible({ timeout: 5000 });
  });

  test("embedded images render from relative paths", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });
    await page.evaluate(() => {
      // @ts-expect-error test helper
      return window.__appStore?.actions.openByPath("/MyNotes/Media/Embedded.md");
    });
    const img = page.locator('.milkdown img[alt="Picture.png"]').first();
    await expect(img).toBeVisible({ timeout: 5000 });
    await expect(img).toHaveAttribute("src", /data:image|\/MyNotes\/Media\/Picture\.png/);
  });
});
