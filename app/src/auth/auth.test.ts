import { describe, expect, it } from "vitest";
import { ALLOWED_SCOPES } from "./auth";

describe("OAuth scopes", () => {
  it("uses only permitted Drive scopes", () => {
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.file");
    expect(ALLOWED_SCOPES).toContain("https://www.googleapis.com/auth/drive.labels");
    expect(ALLOWED_SCOPES.some((s) => s === "https://www.googleapis.com/auth/drive")).toBe(false);
  });
});
