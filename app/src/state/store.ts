import { createStore as createZustandStore } from "zustand/vanilla";
import type { FileRecord, EnsureEditableResult, WriteOptions } from "../vfs/virtualFileSystem";

export type VfsClient = {
  listFiles: () => Promise<FileRecord[]>;
  readFile: (id: string) => Promise<FileRecord>;
  ensureEditable: (id: string) => Promise<EnsureEditableResult>;
  writeFile: (id: string, content: string, opts?: WriteOptions) => Promise<FileRecord & { overwritten?: boolean }>;
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
  };
};

export type AppActions = {
  loadFiles: () => Promise<void>;
  openFile: (id: string) => Promise<void>;
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
      },
  }));

  const actions: AppActions = {
    loadFiles: async () => {
      const files = await config.client.listFiles();
      store.setState((state) => ({ ...state, files }));
      const firstAppFile = files.find((f) => f.path.startsWith(config.appRoot));
      if (firstAppFile) {
        await actions.openFile(firstAppFile.id);
      }
    },
    openFile: async (id: string) => {
      const file = await config.client.readFile(id);
      store.setState((state) => ({
        ...state,
        activeFile: file,
        ui: { ...state.ui, copyIndicator: false, lastSaveOverwritten: false },
      }));
    },
    saveContent: async (content: string) => {
      const current = store.getState().activeFile;
      if (!current) return;
      store.setState((state) => ({
        ...state,
        activeFile: { ...state.activeFile!, content },
        ui: { ...state.ui, saving: true },
      }));

      let target = current;
      if (!current.createdByApp || !current.path.startsWith(config.appRoot)) {
        const ensured = await config.client.ensureEditable(current.id);
        target = ensured;
        store.setState((state) => ({
          ...state,
          activeFile: ensured,
          ui: { ...state.ui, copyIndicator: ensured.isCopy },
        }));
      }

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
