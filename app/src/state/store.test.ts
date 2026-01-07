import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAppStore, type AppStore } from "./store";
import { APP_ROOT_PATH, IMPORTED_FOLDER_NAME } from "../config";
import type { FileRecord } from "../vfs/virtualFileSystem";

type StubClient = {
  listFiles: () => Promise<FileRecord[]>;
  readFile: (id: string) => Promise<FileRecord>;
  ensureEditable: (id: string) => Promise<FileRecord & { isCopy: boolean }>;
  writeFile: (id: string, content: string, opts?: { expectedRevision?: number }) => Promise<FileRecord & { overwritten?: boolean }>;
  resolvePath: (path: string, fromPath?: string) => Promise<FileRecord[]>;
};

const APP_ROOT = APP_ROOT_PATH;

function makeFiles(): FileRecord[] {
  return [
    { id: "a", path: `${APP_ROOT}/Welcome.md`, content: "hi", createdByApp: true, lastModified: Date.now(), revision: 1 },
    { id: "b", path: `${APP_ROOT}/Nested/Note.md`, content: "note", createdByApp: true, lastModified: Date.now(), revision: 1 },
    { id: "c", path: `${APP_ROOT}/Nested/index.md`, content: "index", createdByApp: true, lastModified: Date.now(), revision: 1 },
    { id: "d", path: "/Shared/Note.md", content: "ext", createdByApp: false, lastModified: Date.now(), revision: 1 },
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
        path: `${APP_ROOT}/${IMPORTED_FOLDER_NAME}/Shared/Note.md`,
        createdByApp: true,
        isCopy: true,
        revision: 1,
      })),
      writeFile: vi.fn(async (id, content, opts) => {
        const target = files.find((f) => f.id === id) ?? files[0];
        return {
          ...target,
          content,
          overwritten: opts?.expectedRevision === 0,
          revision: (opts?.expectedRevision ?? 1) + 1,
        };
      }),
      resolvePath: vi.fn(async () => []),
    };
    store = createAppStore({ client, appRoot: APP_ROOT });
  });

  it("loads and opens default file", async () => {
    await store.actions.loadFiles();
    expect(store.getState().files.length).toBe(4);
    expect(store.getState().activeFile?.id).toBe("a");
  });

  it("creates a copy when editing external files and marks indicator", async () => {
    await store.actions.loadFiles();
    await store.actions.openFile("d");
    await store.actions.saveContent("new text");

    expect(client.ensureEditable).toHaveBeenCalledWith("d");
    const state = store.getState();
    expect(state.activeFile?.id).toBe("copy-1");
    expect(state.activeFile?.path).toBe(`${APP_ROOT}/${IMPORTED_FOLDER_NAME}/Shared/Note.md`);
    expect(state.ui.copyIndicator).toBe(true);
  });

  it("surfaces link disambiguation for wiki-style paths", async () => {
    await store.actions.loadFiles();
    await store.actions.openByPath("[[Note]]");

    const resolution = store.getState().ui.linkResolution;
    expect(resolution?.options.map((f) => f.id).sort()).toEqual(["b", "d"]);
  });

  it("resolves relative paths using the active file directory", async () => {
    await store.actions.loadFiles();
    await store.actions.openFile("b");
    await store.actions.openByPath("./index.md");

    expect(store.getState().activeFile?.id).toBe("c");
  });
});
