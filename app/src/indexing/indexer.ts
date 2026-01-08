import { useEffect, useRef } from "react";
import { createBackoff } from "../lib/backoff";
import type { AppStore, VfsClient } from "../state/store";
import { summarizeFile } from "../ai/aiService";
import { createIndexStore } from "./indexStore";
import { loadApiKey } from "../ai/apiKeyStore";

const backoff = createBackoff({ baseMs: 200, factor: 2, maxMs: 2000, jitterRatio: 0.2 });
const storePromise = createIndexStore({ dbName: "ai-index.db", persist: true, maxResults: 30 }).catch((err) => {
  console.warn("Index store init failed; falling back to in-memory", err);
  return createIndexStore({ persist: false, maxResults: 30 });
});

export function useIndexer(store: AppStore, client: VfsClient) {
  const cancelled = useRef(false);
  useEffect(() => {
    const isVitest = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITEST;
    const isE2E = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITE_E2E;
    const isDev = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.DEV;
    const disableIndexer =
      Boolean(isVitest) ||
      ["true", "1"].includes(((import.meta as ImportMeta).env?.VITE_DISABLE_INDEXER ?? "").toString());
    if (disableIndexer) {
      store.actions.setIndexingState?.("idle", "Indexer disabled");
      return;
    }
    cancelled.current = false;
    const queue = new Set<string>();

    async function tick() {
      if (cancelled.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        store.actions.setIndexingState?.("paused");
        setTimeout(tick, 1000);
        return;
      }

      try {
        const indexStore = await storePromise;
        const files = await client.listFiles();
        await indexStore.enqueueFiles(
          files.map((f) => ({ id: f.id, path: f.path, lastModified: f.lastModified ?? Date.now() })),
        );
        files.forEach((f) => queue.add(f.id));
        store.actions.setIndexingState("running");

        const batch = await indexStore.nextBatch(5);
        if (batch.length === 0) {
          store.actions.setIndexingState("idle");
          setTimeout(tick, 3000);
          return;
        }

        for (const nextId of batch) {
          if (cancelled.current) break;
          const file = await client.readFile(nextId);
          try {
            if (typeof window !== "undefined") {
              const summary = await summarizeFile(file);
              await indexStore.saveIndex({
                fileId: file.id,
                path: file.path,
                lastModified: file.lastModified ?? Date.now(),
                summary: summary.summary,
                keywords: summary.keywords,
                entities: summary.entities,
              });
            }
          } catch (err) {
            console.warn("AI summary failed", err);
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        backoff.reset();
        setTimeout(tick, 800);
      } catch (error) {
        store.actions.setIndexingState("retrying", error instanceof Error ? error.message : String(error));
        const delay = backoff.nextDelay();
        setTimeout(tick, delay);
      }
    }

    tick();
    return () => {
      cancelled.current = true;
    };
  }, [client, store]);
}
