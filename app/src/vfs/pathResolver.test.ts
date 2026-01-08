import { describe, expect, it } from "vitest";
import { APP_ROOT_PATH } from "../config";
import type { FileRecord } from "./types";
import { resolvePathMatches } from "./pathResolver";

const baseFiles: FileRecord[] = [
  { id: "home", path: `${APP_ROOT_PATH}/index.md`, content: "", createdByApp: true, lastModified: 0 },
  { id: "guide-index", path: `${APP_ROOT_PATH}/Guide/index.md`, content: "", createdByApp: true, lastModified: 0 },
  { id: "guide-note", path: `${APP_ROOT_PATH}/Guide/Note.md`, content: "", createdByApp: true, lastModified: 0 },
  { id: "external-note", path: "/Shared/Note.md", content: "", createdByApp: false, lastModified: 0 },
];

describe("resolvePathMatches", () => {
  it("resolves relative links against the current file", () => {
    const result = resolvePathMatches(baseFiles, "./index.md", {
      appRoot: APP_ROOT_PATH,
      fromPath: `${APP_ROOT_PATH}/Guide/Note.md`,
    });
    expect(result.matches.map((f) => f.id)).toContain("guide-index");
  });

  it("prefers index.md when navigating to a folder path", () => {
    const result = resolvePathMatches(baseFiles, `${APP_ROOT_PATH}/Guide`, { appRoot: APP_ROOT_PATH });
    expect(result.matches[0]?.path).toBe(`${APP_ROOT_PATH}/Guide/index.md`);
  });

  it("returns all wiki-link candidates for disambiguation", () => {
    const result = resolvePathMatches(baseFiles, "[[Note]]", { appRoot: APP_ROOT_PATH });
    const ids = result.matches.map((f) => f.id).sort();
    expect(ids).toEqual(["external-note", "guide-note"]);
  });
});
