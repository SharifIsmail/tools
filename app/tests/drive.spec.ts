import { test, expect } from "./fixtures";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  modifiedTime?: string;
  content?: string;
};

test.describe("Drive integration (mocked)", () => {
  test("loads files from Drive adapter when access token present", async ({ page }) => {
    const files: Record<string, DriveFile> = {
      root: { id: "root", name: "", mimeType: "application/vnd.google-apps.folder" },
      rootNotes: { id: "root-notes", name: "MyNotes", mimeType: "application/vnd.google-apps.folder", parents: ["root"] },
      imported: {
        id: "imported",
        name: "Imported",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root-notes"],
      },
      appState: {
        id: "app-state",
        name: ".app_state",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root-notes"],
      },
      welcome: {
        id: "drive-welcome",
        name: "Welcome.md",
        mimeType: "text/markdown",
        parents: ["root-notes"],
        appProperties: { createdByApp: "true" },
        content: "# Drive Welcome\n\nThis came from Drive.",
      },
    };

    await page.addInitScript((token, driveFiles) => {
      localStorage.setItem(
        "app.oauth.tokens",
        JSON.stringify({
          accessToken: token,
          refreshToken: undefined,
          expiresAt: Date.now() + 1000 * 60 * 60,
          scope: "https://www.googleapis.com/auth/drive.readonly",
        }),
      );
      // @ts-expect-error expose mock drive files
      window.__mockDriveFiles = driveFiles;
    }, "fake-token", [
      {
        id: "drive-welcome",
        path: "/MyNotes/Welcome.md",
        content: "# Drive Welcome\n\nThis came from Drive.",
        createdByApp: true,
        lastModified: Date.now(),
        revision: 1,
      },
    ]);

    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    const storePathsHandle = await page.waitForFunction(() => {
      // @ts-expect-error test helper
      const files = window.__appStore?.getState().files;
      if (!files || files.length === 0) return undefined;
      return files.map((f: { path: string }) => f.path);
    }, { timeout: 10000 });
    const storePaths = await storePathsHandle.jsonValue();
    expect(storePaths).toContain("/MyNotes/Welcome.md");

    await expect(page.locator(".editor__path", { hasText: "/MyNotes/Welcome.md" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".editor__surface")).toContainText("Drive Welcome");

    await page.evaluate(() => {
      localStorage.removeItem("app.oauth.tokens");
      // @ts-expect-error cleanup mock
      delete window.__mockDriveFiles;
    });
  });
});
