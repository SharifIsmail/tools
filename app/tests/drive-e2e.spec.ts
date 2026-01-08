import { test, expect } from "./fixtures";

// This test exercises the Drive-enabled flow without hitting Google APIs by
// pre-seeding auth tokens and Drive files. The app will use the DriveAdapter
// code path (tokens present) but will read/write against the in-memory drive
// because we inject __mockDriveFiles at startup.
test.describe("Drive flow (stable mock)", () => {
  test("loads Drive files after sign-in token is present", async ({ page }) => {
    await page.addInitScript((token, driveFiles) => {
      // Force client to use the in-memory drive while tokens are present.
      // @ts-expect-error test flag
      window.__forceMockDrive = true;
      localStorage.setItem("app.mock.driveFiles", JSON.stringify(driveFiles));
      localStorage.setItem(
        "app.oauth.tokens",
        JSON.stringify({
          accessToken: token,
          refreshToken: undefined,
          expiresAt: Date.now() + 1000 * 60 * 60,
          scope: "https://www.googleapis.com/auth/drive.file",
        }),
      );
      // @ts-expect-error expose mock drive files for the client
      window.__mockDriveFiles = driveFiles;
    }, "fake-token", [
      {
        id: "drive-welcome",
        path: "/MyNotes/Welcome.md",
        content: "# Drive Welcome\n\nSeeded for E2E.",
        createdByApp: true,
        lastModified: Date.now(),
        revision: 1,
      },
    ]);

    // Stub Drive HTTP calls so no real network is required.
    const entries = {
      appRoot: {
        id: "app-root",
        name: "MyNotes",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root"],
        modifiedTime: new Date().toISOString(),
      },
      imported: {
        id: "imported",
        name: "Imported",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["app-root"],
        modifiedTime: new Date().toISOString(),
      },
      appState: {
        id: "app-state",
        name: ".app_state",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["app-root"],
        modifiedTime: new Date().toISOString(),
      },
      welcome: {
        id: "drive-welcome",
        name: "Welcome.md",
        mimeType: "text/markdown",
        parents: ["app-root"],
        modifiedTime: new Date().toISOString(),
        appProperties: { createdByApp: "true" },
        content: "# Drive Welcome\n\nSeeded for E2E.",
      },
    };

    await page.route("https://www.googleapis.com/**", async (route) => {
      const { pathname, searchParams } = new URL(route.request().url());

      // List queries
      if (pathname === "/drive/v3/files" && route.request().method() === "GET") {
        const q = searchParams.get("q") ?? "";
        const pageSize = searchParams.get("pageSize");
        if (pageSize) {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({ files: [entries.appRoot, entries.imported, entries.appState, entries.welcome] }),
          });
          return;
        }
        if (q.includes("name='MyNotes'")) {
          await route.fulfill({ status: 200, body: JSON.stringify({ files: [entries.appRoot] }) });
          return;
        }
        if (q.includes("name='Imported'")) {
          await route.fulfill({ status: 200, body: JSON.stringify({ files: [entries.imported] }) });
          return;
        }
        if (q.includes("name='.app_state'")) {
          await route.fulfill({ status: 200, body: JSON.stringify({ files: [entries.appState] }) });
          return;
        }
      }

      if (pathname === "/drive/v3/files" && route.request().method() === "POST") {
        // Echo back a created folder/file.
        const body = (route.request().postDataJSON?.() as { name?: string; mimeType?: string; parents?: string[] }) ?? {};
        const id = body.name ?? "created";
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id,
            name: body.name ?? "created",
            mimeType: body.mimeType ?? "text/plain",
            parents: body.parents ?? ["root"],
            modifiedTime: new Date().toISOString(),
          }),
        });
        return;
      }

      if (pathname.startsWith("/drive/v3/files/") && route.request().method() === "GET") {
        const id = pathname.split("/").pop() ?? "";
        const entry = Object.values(entries).find((e) => e.id === id);
        if (!entry) {
          await route.fulfill({ status: 404, body: "{}" });
          return;
        }
        if (searchParams.get("alt") === "media") {
          await route.fulfill({ status: 200, body: (entry as { content?: string }).content ?? "" });
          return;
        }
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: entry.id,
            name: entry.name,
            mimeType: entry.mimeType,
            parents: entry.parents,
            modifiedTime: entry.modifiedTime,
            appProperties: (entry as { appProperties?: Record<string, string> }).appProperties,
          }),
        });
        return;
      }

      await route.fulfill({ status: 404, body: "{}" });
    });

    await page.goto("/");
    await page.getByText("Files").waitFor({ state: "visible" });

    const welcomeButton = page.getByRole("button", { name: "Welcome.md" });
    await expect(welcomeButton).toBeVisible({ timeout: 10000 });
    await welcomeButton.click();

    await expect(page.locator(".editor__path")).toContainText("/MyNotes/Welcome.md");
    await expect(page.locator(".editor__surface")).toContainText("Drive Welcome");

    await page.evaluate(() => {
      localStorage.removeItem("app.oauth.tokens");
      localStorage.removeItem("app.mock.driveFiles");
      // @ts-expect-error cleanup mock
      delete window.__mockDriveFiles;
    });
  });
});
