import { describe, expect, it } from "vitest";
import { summarizeFile } from "./aiService";

describe("summarizeFile", () => {
  it("returns stub summary when key is missing or disabled", async () => {
    const result = await summarizeFile({
      id: "1",
      path: "/a.md",
      content: "Hello world",
      createdByApp: true,
      lastModified: Date.now(),
    });
    expect(result.summary).toContain("Hello world");
    expect(result.keywords).toEqual([]);
    expect(result.entities).toEqual([]);
  });
});
