import { describe, expect, it, beforeEach } from "vitest";
import { VirtualFileSystem, type FileRecord } from "./virtualFileSystem";
import { InMemoryDrive } from "./InMemoryDrive";
import { InMemoryCacheStore } from "./cacheStore";

const APP_ROOT = "/MyNotes";

function setup(files: FileRecord[]) {
  const drive = new InMemoryDrive(files);
  const cache = new InMemoryCacheStore<{ revision: number }>();
  const vfs = new VirtualFileSystem({
    appRoot: APP_ROOT,
    importedDir: "Imported",
    drive,
    cache,
  });
  return { vfs, drive, cache };
}

describe("VirtualFileSystem", () => {
  let seed: FileRecord[];

  beforeEach(() => {
    seed = [
      {
        id: "1",
        path: `${APP_ROOT}/Welcome.md`,
        content: "hello",
        createdByApp: true,
        lastModified: Date.now(),
      },
      {
        id: "ext-1",
        path: "/Shared/Note.md",
        content: "external",
        createdByApp: false,
        lastModified: Date.now(),
      },
    ];
  });

  it("creates a copy inside the app root when editing external files", async () => {
    const { vfs } = setup(seed);
    const original = await vfs.readFile("ext-1");
    expect(original.path).toBe("/Shared/Note.md");

    const ensured = await vfs.ensureEditable("ext-1");
    expect(ensured.isCopy).toBe(true);
    expect(ensured.path).toBe("/MyNotes/Imported/Shared/Note.md");

    // Write to the copy and ensure original is untouched
    await vfs.writeFile(ensured.id, "updated", { expectedRevision: ensured.revision });
    const originalAfter = await vfs.readFile("ext-1");
    expect(originalAfter.content).toBe("external");
    const copy = await vfs.readFile(ensured.id);
    expect(copy.content).toBe("updated");
  });

  it("flags overwrites for last-write-wins saves", async () => {
    const { vfs } = setup(seed);
    const first = await vfs.readFile("1");
    await vfs.writeFile("1", "edit-a", { expectedRevision: first.revision });
    const second = await vfs.readFile("1");

    const writeResult = await vfs.writeFile("1", "edit-b", { expectedRevision: first.revision });
    expect(writeResult.overwritten).toBe(true);
    const latest = await vfs.readFile("1");
    expect(latest.content).toBe("edit-b");
    expect(latest.revision).toBeGreaterThan(second.revision ?? 0);
  });
});
