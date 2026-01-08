import { test, expect } from "./fixtures";

test.describe("OAuth callback failure", () => {
  test("surfaces handled warning when GIS token flow fails", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error inject mock GIS token client
      window.__mockGisClient = {
        callback: () => {},
        requestAccessToken: () => {
          // @ts-expect-error use latest callback
          window.__mockGisClient.callback({ error: "access_denied" });
        },
      };
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await page.getByText("Files").waitFor();
    await page.waitForFunction(() =>
      // @ts-expect-error test hook
      Array.isArray(window.__authDebug) && window.__authDebug.some((entry: string) => entry.includes("GIS token error")),
    );

    const tokens = await page.evaluate(() => localStorage.getItem("app.oauth.tokens"));
    expect(tokens).toBeNull();
  });
});
