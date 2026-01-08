import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_SCOPES, __resetAuthForTest, getValidAccessToken, loadTokens, logout, saveTokens, startLogin } from "./auth";

type MockTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

function mockGis(response: MockTokenResponse) {
  const tokenClient = {
    callback: (resp?: MockTokenResponse) => {
      void resp;
    },
    requestAccessToken: vi.fn(() => {
      // simulate async callback
      tokenClient.callback(response);
    }),
  };
  (window as unknown as { __mockGisClient?: typeof tokenClient }).__mockGisClient = tokenClient;
  return { tokenClient };
}

describe("OAuth via GIS token client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    __resetAuthForTest();
    delete (window as unknown as { __mockGisClient?: unknown }).__mockGisClient;
    delete (window as unknown as { google?: unknown }).google;
  });

  it("uses only permitted Drive scopes", () => {
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.file");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.labels");
    expect(ALLOWED_SCOPES.some((s) => s === "https://www.googleapis.com/auth/drive")).toBe(false);
  });

  it("requests a GIS token with prompt=consent and stores it", async () => {
    const { tokenClient } = mockGis({
      access_token: "t-consent",
      expires_in: 3600,
      scope: ALLOWED_SCOPES.join(" "),
    });
    const tokens = await startLogin();
    expect(tokenClient.requestAccessToken).toHaveBeenCalledWith({ prompt: "consent" });
    expect(tokens?.accessToken).toBe("t-consent");
    expect(loadTokens()?.accessToken).toBe("t-consent");
  });

  it("returns cached token when not expired", async () => {
    saveTokens({
      accessToken: "cached",
      expiresAt: Date.now() + 5 * 60 * 1000,
      scope: ALLOWED_SCOPES.join(" "),
    });
    const token = await getValidAccessToken();
    expect(token).toBe("cached");
  });

  it("refreshes silently when expired", async () => {
    const { tokenClient } = mockGis({
      access_token: "t-silent",
      expires_in: 1800,
      scope: ALLOWED_SCOPES.join(" "),
    });
    saveTokens({
      accessToken: "old",
      expiresAt: Date.now() - 1000,
      scope: ALLOWED_SCOPES.join(" "),
    });
    const token = await getValidAccessToken();
    expect(tokenClient.requestAccessToken).toHaveBeenCalledWith({ prompt: "" });
    expect(token).toBe("t-silent");
    expect(loadTokens()?.accessToken).toBe("t-silent");
  });

  it("does not persist tokens on GIS error", async () => {
    mockGis({ error: "access_denied" });
    const token = await startLogin();
    expect(token).toBeUndefined();
    expect(loadTokens()).toBeUndefined();
  });

  it("clears stored tokens on logout", () => {
    saveTokens({
      accessToken: "bye",
      expiresAt: Date.now() + 1000,
      scope: ALLOWED_SCOPES.join(" "),
    });
    logout();
    expect(loadTokens()).toBeUndefined();
  });
});
