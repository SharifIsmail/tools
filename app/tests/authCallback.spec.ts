import { test, expect } from "./fixtures";

test.describe("OAuth callback", () => {
  test("processes callback once and stores tokens without state warning", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text());
    });
    await page.route("https://oauth2.googleapis.com/token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "playwright-token",
          refresh_token: "playwright-refresh",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/drive.readonly",
        }),
      });
    });
    await page.addInitScript(() => {
      sessionStorage.removeItem("app.oauth.handled");
      sessionStorage.setItem("app.oauth.verifier", "verifier-playwright");
      sessionStorage.setItem("app.oauth.state", "state-playwright");
    });

    await page.goto("/auth/callback?code=fake-code&state=state-playwright");
    await page.waitForRequest("**/oauth2.googleapis.com/token");
    await page.waitForURL("**/");
    const saved = await page.waitForFunction(() => localStorage.getItem("app.oauth.tokens"));
    const tokens = JSON.parse((await saved.jsonValue()) as string);
    expect(tokens.accessToken).toBe("playwright-token");
    expect(tokens.refreshToken).toBe("playwright-refresh");
    expect(warnings.filter((w) => w.includes("Invalid OAuth state"))).toEqual([]);
  });
});
