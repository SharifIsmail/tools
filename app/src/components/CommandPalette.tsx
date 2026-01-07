import { useEffect, useMemo, useState } from "react";
import { APP_ROOT_PATH } from "../config";
import { useAppActions, useAppStoreSelector } from "../state/AppContext";
import { createIndexStore, type IndexEntry } from "../indexing/indexStore";

const indexStorePromise = createIndexStore({ dbName: "ai-index.db", persist: true, maxResults: 15 });

export function CommandPalette() {
  const actions = useAppActions();
  const { files, ui } = useAppStoreSelector((s) => ({ files: s.files, ui: s.ui }));
  const [query, setQuery] = useState("");
  const [indexResults, setIndexResults] = useState<IndexEntry[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        actions.setCommandPalette(!ui.commandPaletteOpen);
      } else if (event.key === "Escape") {
        actions.setCommandPalette(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, ui.commandPaletteOpen]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setIndexResults([]);
        return;
      }
      const store = await indexStorePromise;
      const results = await store.search(trimmed);
      if (!cancelled) setIndexResults(results);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const results = useMemo(() => {
    const lower = query.toLowerCase();
    const fileMatches = files
      .filter((file) => file.path.toLowerCase().includes(lower))
      .slice(0, 15)
      .map((file) => ({
        ...file,
        external: !file.path.startsWith(APP_ROOT_PATH),
      }));
    const extraFromIndex = indexResults
      .filter((entry) => !fileMatches.some((f) => f.id === entry.fileId))
      .map((entry) => ({
        id: entry.fileId,
        path: entry.path,
        summary: entry.summary,
        external: !entry.path.startsWith(APP_ROOT_PATH),
      }));
    return [...fileMatches, ...extraFromIndex];
  }, [files, indexResults, query]);

  if (!ui.commandPaletteOpen) return null;

  return (
    <div className="palette__backdrop" role="presentation" onClick={() => actions.setCommandPalette(false)}>
      <div className="palette" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="palette__input"
          placeholder="Search files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette__results">
          {results.map((file) => (
            <button
              key={file.id}
              className="palette__row"
              onClick={() => {
                actions.openFile(file.id);
                actions.setCommandPalette(false);
              }}
            >
              <span>{file.path}</span>
              <span className="palette__meta">
                {file.summary && <span className="palette__summary">{file.summary.slice(0, 80)}</span>}
                {file.external && <span className="palette__badge">External</span>}
              </span>
            </button>
          ))}
          {results.length === 0 && <div className="palette__empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}
