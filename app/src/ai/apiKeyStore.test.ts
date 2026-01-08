import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadApiKey } from "./apiKeyStore";

const KEY = "app.ai.apiKey";

describe("apiKeyStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllEnvs();
    delete (globalThis as { __forceRealGemini?: boolean }).__forceRealGemini;
  });

  it("suppresses key in dev by default", () => {
    vi.stubEnv("DEV", true);
    localStorage.setItem(KEY, "dev-key");
    expect(loadApiKey()).toBeUndefined();
  });

  it("returns key when forced even in dev/e2e", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_E2E", "true");
    (globalThis as { __forceRealGemini?: boolean }).__forceRealGemini = true;
    localStorage.setItem(KEY, "forced-key");
    expect(loadApiKey()).toBe("forced-key");
  });
});
