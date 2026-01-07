import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pkce from "./pkce";
import { ALLOWED_SCOPES, buildAuthRequest, handleAuthCallback, startLogin } from "./auth";

describe("OAuth scopes", () => {
  it("uses only permitted Drive scopes", () => {
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.file");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.labels");
    expect(ALLOWED_SCOPES.some((s) => s === "https://www.googleapis.com/auth/drive")).toBe(false);
  });

  describe("buildAuthRequest", () => {
    beforeEach(() => {
      sessionStorage.clear();
      vi.spyOn(pkce, "generateCodeVerifier").mockReturnValue("verifier-123");
      vi.spyOn(pkce, "sha256").mockResolvedValue("challenge-xyz");
      vi.spyOn(global.crypto, "randomUUID").mockReturnValue("state-abc");
    });

    it("constructs auth URL with allowed scopes and stores verifier/state", async () => {
      const { url, state, verifier } = await buildAuthRequest();
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      const scopes = parsed.searchParams.get("scope")?.split(" ");
      expect(scopes).toEqual(ALLOWED_SCOPES);
      expect(parsed.searchParams.get("client_id")).toBe("112047506162-5lphksopq4fss8hnh9jpdi8uk8805hoc.apps.googleusercontent.com");
      expect(parsed.searchParams.get("code_challenge")).toBe("challenge-xyz");
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("state")).toBe("state-abc");
      expect(state).toBe("state-abc");
      expect(verifier).toBe("verifier-123");
      expect(sessionStorage.getItem("app.oauth.verifier")).toBe("verifier-123");
      expect(sessionStorage.getItem("app.oauth.state")).toBe("state-abc");
    });
  });

  describe("handleAuthCallback", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      sessionStorage.clear();
      localStorage.clear();
      vi.unstubAllEnvs();
    });

    it("returns undefined and does not call token endpoint when state is invalid", async () => {
      sessionStorage.setItem("app.oauth.verifier", "verifier-123");
      sessionStorage.setItem("app.oauth.state", "expected-state");
      const spy = vi.spyOn(global, "fetch" as never);
      Object.defineProperty(window, "location", {
        value: new URL("https://example.com/auth/callback?code=abc&state=bad-state"),
        writable: true,
      });
      const result = await handleAuthCallback();
      expect(result).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns undefined on token exchange failure and clears pending flag", async () => {
      sessionStorage.setItem("app.oauth.verifier", "verifier-123");
      sessionStorage.setItem("app.oauth.state", "state-abc");
      Object.defineProperty(window, "location", {
        value: new URL("https://example.com/auth/callback?code=abc&state=state-abc"),
        writable: true,
      });
      const fetchSpy = vi
        .spyOn(global, "fetch" as never)
        .mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" } as never);
      const result = await handleAuthCallback();
      expect(result).toBeUndefined();
      expect(sessionStorage.getItem("app.oauth.handled")).toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("handles callback once even if invoked twice (StrictMode) and persists tokens", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      sessionStorage.setItem("app.oauth.verifier", "verifier-123");
      sessionStorage.setItem("app.oauth.state", "state-abc");
      Object.defineProperty(window, "location", {
        value: new URL("https://example.com/auth/callback?code=abc&state=state-abc"),
        writable: true,
      });
      const fetchSpy = vi
        .spyOn(global, "fetch" as never)
        .mockResolvedValue({ ok: true, json: async () => ({ access_token: "t1", expires_in: 3600, scope: "s" }) } as never);

      const first = await handleAuthCallback();
      const second = await handleAuthCallback();

      expect(first?.accessToken).toBe("t1");
      expect(second?.accessToken).toBe("t1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("Invalid OAuth state"));
      expect(sessionStorage.getItem("app.oauth.handled")).toBe("true");
      warnSpy.mockRestore();
    });

    it("resets handled flag when starting new login", async () => {
      sessionStorage.setItem("app.oauth.handled", "true");
      let hrefVal = "https://example.com/";
      Object.defineProperty(window, "location", {
        value: {
          get href() {
            return hrefVal;
          },
          set href(next: string) {
            hrefVal = next;
          },
          origin: "https://example.com",
        },
        writable: true,
      });
      vi.spyOn(pkce, "generateCodeVerifier").mockReturnValue("verifier-456");
      vi.spyOn(pkce, "sha256").mockResolvedValue("challenge-789");
      vi.spyOn(global.crypto, "randomUUID").mockReturnValue("state-def");
      await startLogin();
      expect(sessionStorage.getItem("app.oauth.handled")).toBeNull();
    });
  });
});
