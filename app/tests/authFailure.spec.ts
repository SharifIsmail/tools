import { test, expect } from "./fixtures";

test.describe("OAuth callback failure", () => {
  test.use({
    allowedHttpErrors: [/oauth2\.googleapis\.com\/token/],
    allowedConsoleErrors: [/Token exchange failed/, /oauth2\.googleapis\.com\/token/],
  });

  test("shows handled error when token exchange fails", async ({ page }) => {
    await page.route("https://oauth2.googleapis.com/token", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant" }),
      });
    });
    await page.addInitScript(() => {
      sessionStorage.setItem("app.oauth.verifier", "verifier-fail");
      sessionStorage.setItem("app.oauth.state", "state-fail");
    });

    await page.goto("/auth/callback?code=bad&state=state-fail");
    await page.waitForURL("**/");
    await page.getByText("Files").waitFor();
    // Confirm no tokens stored after failure
    const tokens = await page.evaluate(() => localStorage.getItem("app.oauth.tokens"));
    expect(tokens).toBeNull();
    // Confirm warning was logged
    const warned = await page.evaluate(() => {
      // @ts-expect-error test hook
      return (window.__authDebug ?? []).some((entry: string) => entry.includes("Token exchange failed"));
    });
    expect(warned).toBe(true);
  });
});
