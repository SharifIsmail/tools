import { useEffect, useRef } from "react";
import { createBackoff } from "../lib/backoff";
import type { AppStore } from "../state/store";
import type { VfsClient } from "../state/store";

const backoff = createBackoff({ baseMs: 200, factor: 2, maxMs: 2000, jitterRatio: 0.2 });

export function useIndexer(store: AppStore, client: VfsClient) {
  const cancelled = useRef(false);
  useEffect(() => {
    const isVitest = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITEST;
    if (isVitest) return;
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
        const files = await client.listFiles();
        files.forEach((f) => queue.add(f.id));
        store.actions.setIndexingState("running");

        while (queue.size > 0 && !cancelled.current) {
          const nextId = queue.values().next().value as string;
          queue.delete(nextId);
          await client.readFile(nextId); // simulate crawl
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        backoff.reset();
        store.actions.setIndexingState("idle");
        setTimeout(tick, 3000);
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
