/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { createAppStore, type AppStore } from "./store";
import { createVfsClient } from "../vfs/client";
import { useIndexer } from "../indexing/indexer";
import type { FileRecord } from "../vfs/virtualFileSystem";
import { useAuth } from "../auth/AuthContext";

type AppContextValue = {
  store: AppStore;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const client = useMemo(
    () => createVfsClient(auth.tokens ? { accessTokenProvider: auth.getAccessToken } : {}),
    [auth.tokens, auth.getAccessToken],
  );
  const store = useMemo(() => createAppStore({ client, appRoot: "/MyNotes" }), [client]);

  useEffect(() => {
    store.actions.loadFiles().catch((err) => {
      console.error("Failed to load files", err);
    });
  }, [store]);

  useIndexer(store, client);

  return <AppContext.Provider value={{ store }}>{children}</AppContext.Provider>;
}

export function useAppStoreSelector<T>(selector: (state: ReturnType<AppStore["getState"]>) => T): T {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppStoreSelector must be used within AppProvider");
  }

  const state = useSyncExternalStore(ctx.store.subscribe, ctx.store.getState, ctx.store.getState);
  return selector(state);
}

export function useAppActions() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppActions must be used within AppProvider");
  }
  return ctx.store.actions;
}

export function useActiveFile(): FileRecord | undefined {
  return useAppStoreSelector((s) => s.activeFile);
}
