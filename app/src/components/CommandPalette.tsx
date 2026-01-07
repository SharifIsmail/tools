import { useEffect, useMemo, useState } from "react";
import { useAppActions, useAppStoreSelector } from "../state/AppContext";

const APP_ROOT = "/MyNotes";

export function CommandPalette() {
  const actions = useAppActions();
  const { files, ui } = useAppStoreSelector((s) => ({ files: s.files, ui: s.ui }));
  const [query, setQuery] = useState("");

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

  const results = useMemo(() => {
    const lower = query.toLowerCase();
    return files
      .filter((file) => file.path.toLowerCase().includes(lower))
      .slice(0, 15)
      .map((file) => ({
        ...file,
        external: !file.path.startsWith(APP_ROOT),
      }));
  }, [files, query]);

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
              {file.external && <span className="palette__badge">External</span>}
            </button>
          ))}
          {results.length === 0 && <div className="palette__empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}
