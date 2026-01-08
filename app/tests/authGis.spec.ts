import { test, expect } from "./fixtures";

test.describe("Google Identity Services auth", () => {
  test("signs in and stores token via GIS", async ({ page }) => {
    await page.addInitScript(() => {
      const tokenResponse = {
        access_token: "playwright-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.labels",
      };
      // @ts-expect-error inject mock GIS token client
      window.__mockGisClient = {
        callback: (_resp: unknown) => {},
        requestAccessToken: ({ prompt }: { prompt?: string }) => {
          if (prompt === "consent" || prompt === undefined || prompt === "") {
            // @ts-expect-error use latest callback
            window.__mockGisClient.callback(tokenResponse);
          } else {
            // @ts-expect-error use latest callback
            window.__mockGisClient.callback({ error: "access_denied" });
          }
        },
      };
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await page.waitForFunction(() =>
      // @ts-expect-error debug hook
      Array.isArray(window.__authDebug) && window.__authDebug.some((entry: string) => entry.includes("GIS token success")),
    );
    const tokens = await page.evaluate(() => localStorage.getItem("app.oauth.tokens"));
    const parsed = tokens ? JSON.parse(tokens) : null;
    expect(parsed.accessToken).toBe("playwright-token");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
