import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAppStore, type AppStore } from "./store";
import type { FileRecord } from "../vfs/virtualFileSystem";

type StubClient = {
  listFiles: () => Promise<FileRecord[]>;
  readFile: (id: string) => Promise<FileRecord>;
  ensureEditable: (id: string) => Promise<FileRecord & { isCopy: boolean }>;
  writeFile: (id: string, content: string, opts?: { expectedRevision?: number }) => Promise<FileRecord & { overwritten?: boolean }>;
};

const APP_ROOT = "/MyNotes";

function makeFiles(): FileRecord[] {
  return [
    { id: "a", path: `${APP_ROOT}/Welcome.md`, content: "hi", createdByApp: true, lastModified: Date.now(), revision: 1 },
    { id: "b", path: "/Shared/Note.md", content: "ext", createdByApp: false, lastModified: Date.now(), revision: 1 },
  ];
}

describe("AppStore", () => {
  let client: StubClient;
  let store: AppStore;
  let files: FileRecord[];

  beforeEach(() => {
    files = makeFiles();
    client = {
      listFiles: vi.fn(async () => files),
      readFile: vi.fn(async (id) => files.find((f) => f.id === id)!),
      ensureEditable: vi.fn(async (id) => ({
        ...files.find((f) => f.id === id)!,
        id: "copy-1",
        path: `${APP_ROOT}/Imported/Shared/Note.md`,
        createdByApp: true,
        isCopy: true,
        revision: 1,
      })),
      writeFile: vi.fn(async (_id, content, opts) => ({
        ...files[0],
        content,
        overwritten: opts?.expectedRevision === 0,
        revision: (opts?.expectedRevision ?? 1) + 1,
      })),
    };
    store = createAppStore({ client, appRoot: APP_ROOT });
  });

  it("loads and opens default file", async () => {
    await store.actions.loadFiles();
    expect(store.getState().files.length).toBe(2);
    expect(store.getState().activeFile?.id).toBe("a");
  });

  it("creates a copy when editing external files and marks indicator", async () => {
    await store.actions.loadFiles();
    await store.actions.openFile("b");
    await store.actions.saveContent("new text");

    expect(client.ensureEditable).toHaveBeenCalledWith("b");
    const state = store.getState();
    expect(state.activeFile?.id).toBe("copy-1");
    expect(state.activeFile?.path).toBe(`${APP_ROOT}/Imported/Shared/Note.md`);
    expect(state.ui.copyIndicator).toBe(true);
  });
});
