import { createStore as createZustandStore } from "zustand/vanilla";
import type { FileRecord, EnsureEditableResult, WriteOptions } from "../vfs/virtualFileSystem";
import { resolvePathMatches } from "../vfs/pathResolver";

const logPrefix = "[AppStore]";

export type VfsClient = {
  listFiles: () => Promise<FileRecord[]>;
  readFile: (id: string) => Promise<FileRecord>;
  ensureEditable: (id: string) => Promise<EnsureEditableResult>;
  writeFile: (id: string, content: string, opts?: WriteOptions) => Promise<FileRecord & { overwritten?: boolean }>;
  resolvePath: (path: string, fromPath?: string) => Promise<FileRecord[]>;
  setRevisionForTest?: (id: string, revision: number) => Promise<void>;
};

export type AppState = {
  files: FileRecord[];
  activeFile?: FileRecord;
  ui: {
    commandPaletteOpen: boolean;
    copyIndicator: boolean;
    saving: boolean;
    lastSaveOverwritten: boolean;
    indexingStatus: "idle" | "running" | "retrying" | "paused";
    indexingError?: string;
    linkResolution?: { query: string; options: FileRecord[] };
  };
};

export type AppActions = {
  loadFiles: () => Promise<void>;
  openFile: (id: string) => Promise<void>;
  openByPath: (path: string, fromPath?: string) => Promise<void>;
  pickLinkTarget: (id: string) => Promise<void>;
  dismissLinkResolution: () => void;
  saveContent: (content: string) => Promise<void>;
  setCommandPalette: (open: boolean) => void;
  setIndexingState: (status: AppState["ui"]["indexingStatus"], error?: string) => void;
};

export type AppStore = ReturnType<typeof createAppStore>;

type StoreConfig = {
  client: VfsClient;
  appRoot: string;
};

export function createAppStore(config: StoreConfig) {
  const store = createZustandStore<AppState>(() => ({
    files: [],
    activeFile: undefined,
    ui: {
      commandPaletteOpen: false,
      copyIndicator: false,
      saving: false,
      lastSaveOverwritten: false,
      indexingStatus: "idle",
      linkResolution: undefined,
    },
  }));

  const actions: AppActions = {
    loadFiles: async () => {
      console.info(logPrefix, "loadFiles:start");
      try {
        const files = await config.client.listFiles();
        store.setState((state) => ({ ...state, files }));
        console.info(logPrefix, "loadFiles:loaded", { count: files.length });
        const firstAppFile = files.find((f) => f.path.startsWith(config.appRoot));
        if (firstAppFile) {
          await actions.openFile(firstAppFile.id);
        }
        void (async () => {
          await Promise.all(
            files
              .slice(0, 5)
              .map((f) =>
                config.client
                  .readFile(f.id)
                  .then(() => undefined)
                  .catch((err) => {
                    console.warn(logPrefix, "prefetch:error", { id: f.id, path: f.path, error: String(err) });
                    return undefined;
                  }),
              ),
          );
        })();
      } catch (err) {
        console.error(logPrefix, "loadFiles:error", err);
        throw err;
      }
    },
    openByPath: async (path: string, fromPath?: string) => {
      console.info(logPrefix, "openByPath", { path, fromPath });
      store.setState((state) => ({ ...state, ui: { ...state.ui, linkResolution: undefined } }));
      const resolve = (files: FileRecord[]) =>
        resolvePathMatches(files, path, {
          appRoot: config.appRoot,
          fromPath: fromPath ?? store.getState().activeFile?.path,
        });

      let files = store.getState().files;
      if (files.length === 0) {
        files = await config.client.listFiles();
        store.setState((state) => ({ ...state, files }));
        console.info(logPrefix, "openByPath:refreshedFiles", { count: files.length });
      }

      let resolution = resolve(files);
      if (resolution.matches.length === 0) {
        files = await config.client.listFiles();
        store.setState((state) => ({ ...state, files }));
        resolution = resolve(files);
      }

      if (resolution.matches.length === 1) {
        console.info(logPrefix, "openByPath:resolvedUnique", { target: resolution.matches[0].path });
        store.setState((state) => ({ ...state, ui: { ...state.ui, linkResolution: undefined } }));
        await actions.openFile(resolution.matches[0].id);
        return;
      }

      if (resolution.matches.length > 1) {
        console.info(logPrefix, "openByPath:ambiguous", { query: resolution.query, options: resolution.matches.length });
        store.setState((state) => ({
          ...state,
          ui: {
            ...state.ui,
            linkResolution: {
              query: resolution.query,
              options: [...resolution.matches].sort((a, b) => a.path.localeCompare(b.path)),
            },
          },
        }));
      }
    },
    pickLinkTarget: async (id: string) => {
      store.setState((state) => ({ ...state, ui: { ...state.ui, linkResolution: undefined } }));
      await actions.openFile(id);
    },
    dismissLinkResolution: () => {
      store.setState((state) => ({ ...state, ui: { ...state.ui, linkResolution: undefined } }));
    },
    openFile: async (id: string) => {
      console.info(logPrefix, "openFile:start", { id });
      try {
        const file = await config.client.readFile(id);
        store.setState((state) => ({
          ...state,
          activeFile: file,
          ui: {
            ...state.ui,
            copyIndicator: !file.createdByApp || !file.path.startsWith(config.appRoot),
            lastSaveOverwritten: false,
            linkResolution: undefined,
          },
        }));
        console.info(logPrefix, "openFile:done", { id, path: file.path, copyIndicator: !file.createdByApp });
      } catch (err) {
        console.error(logPrefix, "openFile:error", { id, error: err });
        throw err;
      }
    },
    saveContent: async (content: string) => {
      const current = store.getState().activeFile;
      if (!current) return;
      console.info(logPrefix, "saveContent:start", { id: current.id, path: current.path });
      store.setState((state) => ({
        ...state,
        activeFile: { ...state.activeFile!, content },
        ui: { ...state.ui, saving: true },
      }));

      let target = current;
      const needsCopy = !current.createdByApp || !current.path.startsWith(config.appRoot);
      if (needsCopy) {
        try {
          const ensured = await config.client.ensureEditable(current.id);
          target = ensured;
          store.setState((state) => ({
            ...state,
            activeFile: ensured,
            ui: { ...state.ui, copyIndicator: ensured.isCopy },
          }));
          console.info(logPrefix, "saveContent:copyEnsured", { from: current.path, to: ensured.path, isCopy: ensured.isCopy });
        } catch (err) {
          console.error(logPrefix, "saveContent:ensureEditableError", { id: current.id, error: err });
          store.setState((state) => ({ ...state, ui: { ...state.ui, saving: false } }));
          throw err;
        }
      } else {
        store.setState((state) => ({ ...state, ui: { ...state.ui, copyIndicator: false } }));
      }

      try {
        const result = await config.client.writeFile(target.id, content, { expectedRevision: target.revision });
        store.setState((state) => ({
          ...state,
          activeFile: { ...target, content: result.content, revision: result.revision },
          ui: {
            ...state.ui,
            saving: false,
            lastSaveOverwritten: Boolean(result.overwritten),
          },
        }));
        console.info(logPrefix, "saveContent:written", {
          id: target.id,
          path: target.path,
          overwritten: Boolean(result.overwritten),
          revision: result.revision,
        });
      } catch (err) {
        console.error(logPrefix, "saveContent:error", { id: target.id, error: err });
        store.setState((state) => ({ ...state, ui: { ...state.ui, saving: false } }));
        throw err;
      }
    },
    setCommandPalette: (open: boolean) => {
      store.setState((state) => ({ ...state, ui: { ...state.ui, commandPaletteOpen: open } }));
    },
    setIndexingState: (status, error) => {
      store.setState((state) => ({
        ...state,
        ui: { ...state.ui, indexingStatus: status, indexingError: error },
      }));
    },
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    actions,
  };
}
