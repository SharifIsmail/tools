import { useEffect, useRef } from "react";
import { useActiveFile, useAppActions, useAppStoreSelector } from "../state/AppContext";

export function Editor() {
  const actions = useAppActions();
  const activeFile = useActiveFile();
  const ui = useAppStoreSelector((s) => s.ui);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerText = activeFile?.content ?? "";
    }
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
    <section className="editor">
      <header className="editor__header">
        <div>
          <div className="editor__path">{activeFile.path}</div>
          {ui.copyIndicator && <span className="editor__badge">Editing copy</span>}
          {ui.lastSaveOverwritten && <span className="editor__badge editor__badge--warn">Overwritten by another save</span>}
        </div>
        <div className="editor__status">{ui.saving ? "Saving..." : "Saved"}</div>
      </header>
      <div
        className="editor__surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Document editor"
        ref={editorRef}
        onInput={(e) => {
          const text = (e.currentTarget as HTMLDivElement).innerText;
          scheduleSave(text);
        }}
        onBlur={() => {
          const text = editorRef.current?.innerText ?? "";
          scheduleSave(text);
        }}
      />
    </section>
  );
}
