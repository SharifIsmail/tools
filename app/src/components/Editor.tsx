/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { MilkdownProvider, useEditor } from "@milkdown/react";
import { Editor as MilkEditor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { nord } from "@milkdown/theme-nord";
import { gfm } from "@milkdown/preset-gfm";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { replaceAll } from "@milkdown/utils";
import { useActiveFile, useAppActions, useAppStoreSelector } from "../state/AppContext";

function MilkdownSurface({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const editor = useEditor(
    (root) =>
      MilkEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value);
          ctx.get(listenerCtx).markdownUpdated((_, md) => {
            onChange(md);
          });
        })
        .use(nord)
        .use(gfm)
        .use(history)
        .use(listener),
    [value],
  );

  useEffect(() => {
    const instance = editor.get();
    if (!instance) return;
    instance.action(replaceAll(value));
  }, [editor, value]);

  return <div className="editor__surface milkdown" role="textbox" aria-label="Document editor" />;
}

export function Editor() {
  const actions = useAppActions();
  const activeFile = useActiveFile();
  const ui = useAppStoreSelector((s) => s.ui);
  const [mode, setMode] = useState<"wysiwyg" | "source">("wysiwyg");
  const [draft, setDraft] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(activeFile?.content ?? "");
  }, [activeFile?.id, activeFile?.content]);

  if (!activeFile) {
    return <div className="editor__empty">Select a file to start</div>;
  }

  const scheduleSave = (content: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      actions.saveContent(content);
    }, 1000);
  };

  return (
    <MilkdownProvider>
      <section className="editor">
        <header className="editor__header">
          <div>
            <div className="editor__path">{activeFile.path}</div>
            {ui.copyIndicator && <span className="editor__badge">Editing copy</span>}
            {ui.lastSaveOverwritten && <span className="editor__badge editor__badge--warn">Overwritten by another save</span>}
          </div>
          <div className="editor__mode-toggle">
            <button
              className={`mode-btn ${mode === "wysiwyg" ? "mode-btn--active" : ""}`}
              onClick={() => setMode("wysiwyg")}
            >
              WYSIWYG
            </button>
            <button
              className={`mode-btn ${mode === "source" ? "mode-btn--active" : ""}`}
              onClick={() => setMode("source")}
            >
              Source
            </button>
          </div>
          <div className="editor__status">{ui.saving ? "Saving..." : "Saved"}</div>
        </header>
        {mode === "wysiwyg" ? (
          <MilkdownSurface
            value={draft}
            onChange={(md) => {
              setDraft(md);
              scheduleSave(md);
            }}
          />
        ) : (
          <textarea
            className="editor__textarea"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              scheduleSave(e.target.value);
            }}
          />
        )}
      </section>
    </MilkdownProvider>
  );
}
