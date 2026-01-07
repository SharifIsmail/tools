/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import { MilkdownProvider, Milkdown, useEditor } from "@milkdown/react";
import { Editor as MilkEditor, rootCtx, defaultValueCtx, editorViewOptionsCtx, EditorStatus } from "@milkdown/core";
import { nord } from "@milkdown/theme-nord";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { replaceAll } from "@milkdown/utils";
import { useActiveFile, useAppActions, useAppStoreSelector } from "../state/AppContext";
import { decodeWikiLinks, encodeWikiLinks } from "../lib/wikiLinks";
import { buildImagePlaceholder, guessMimeFromPath } from "../lib/media";
import { resolvePathMatches } from "../vfs/pathResolver";
import { APP_ROOT_PATH } from "../config";
import "prosemirror-view/style/prosemirror.css";

const MilkdownSurface = ({
  value,
  fileId,
  active,
  onChange,
  onLinkNavigate,
  resolveMediaSrc,
}: {
  value: string;
  fileId: string;
  active: boolean;
  onChange: (md: string) => void;
  onLinkNavigate: (href: string) => void;
  resolveMediaSrc: (src: string) => string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastApplied = useRef<string>("");
  const applyingExternal = useRef(false);
  const [ready, setReady] = useState(false);
  const { get: getEditor, loading } = useEditor(
    (root) =>
      MilkEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value);
          ctx.set(editorViewOptionsCtx, { editable: () => true });
          ctx.get(listenerCtx).markdownUpdated((_, md) => {
            lastApplied.current = md;
            if (applyingExternal.current) {
              applyingExternal.current = false;
              return;
            }
            console.debug("[Milkdown] markdownUpdated", { fileId, length: md.length });
            onChange(md);
          });
        })
        .use(commonmark)
        .use(nord)
        .use(gfm)
        .use(history)
        .use(listener),
    [],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const hasEditor = !loading && Boolean(getEditor());
    setReady(hasEditor);
    if (hasEditor) {
      node.dataset.editorReady = "true";
    } else {
      delete node.dataset.editorReady;
    }
    return () => {
      delete node.dataset.editorReady;
    };
  }, [fileId, getEditor, loading]);

  useEffect(() => {
    if (!active) return;
    if (loading) return;
    const instance = getEditor();
    if (!instance) return;
    if (instance.status !== EditorStatus.Created) {
      console.debug("[Milkdown] replaceAll deferred (not ready)", { status: instance.status, fileId });
      return;
    }
    if (value === lastApplied.current) return;
    applyingExternal.current = true;
    try {
      console.debug("[Milkdown] replaceAll", { fileId, length: value.length });
      instance.action(replaceAll(value));
      lastApplied.current = value;
    } catch (err) {
      applyingExternal.current = false;
      console.warn("[Milkdown] replaceAll skipped", err);
    }
  }, [active, getEditor, fileId, loading, value]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (/^https?:\/\//i.test(href)) return;
      event.preventDefault();
      onLinkNavigate(href);
    };
    node.addEventListener("click", handler);
    return () => node.removeEventListener("click", handler);
  }, [onLinkNavigate]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const imgs = Array.from(node.querySelectorAll("img"));
    imgs.forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;
      const resolved = resolveMediaSrc(src);
      img.setAttribute("data-resolved-src", resolved);
      img.alt = img.alt || resolved;
      if (/^data:image/.test(resolved)) {
        img.src = resolved;
      } else if (!/^https?:\/\//i.test(resolved) && resolved.startsWith("/")) {
        img.src = resolved;
      }
    });
  }, [resolveMediaSrc, value]);

  return (
    <div
      ref={containerRef}
      className="editor__surface milkdown"
      role="textbox"
      aria-label="Document editor"
      data-editor-ready={ready ? "true" : undefined}
      aria-hidden={!active}
      style={{ display: active ? "block" : "none" }}
    >
      <Milkdown />
    </div>
  );
};

export function Editor() {
  const actions = useAppActions();
  const activeFile = useActiveFile();
  const ui = useAppStoreSelector((s) => s.ui);
  const files = useAppStoreSelector((s) => s.files);
  const [mode, setMode] = useState<"wysiwyg" | "source">("wysiwyg");
  const [draft, setDraft] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [assetUrl, setAssetUrl] = useState<string>();

  useEffect(() => {
    setDraft(decodeWikiLinks(activeFile?.content ?? ""));
  }, [activeFile?.id, activeFile?.content]);

  useEffect(() => {
    if (!activeFile) return;
    const mime = guessMimeFromPath(activeFile.path);
    const blob = new Blob([activeFile.content ?? ""], { type: mime });
    const url = URL.createObjectURL(blob);
    setAssetUrl(url);
    const shouldRevoke = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.PROD;
    return () => {
      if (shouldRevoke) URL.revokeObjectURL(url);
    };
  }, [activeFile?.id, activeFile?.content, activeFile?.path]);

  const syncFromEditor = useCallback(async () => {
    return draft;
  }, [draft]);

  if (!activeFile) {
    return <div className="editor__empty">Select a file to start</div>;
  }

  const ext = activeFile.path.split(".").pop()?.toLowerCase();

  const resolveMediaSrc = (src: string) => {
    const resolution = resolvePathMatches(files, src, { appRoot: APP_ROOT_PATH, fromPath: activeFile.path });
    const resolvedPath = resolution.matches[0]?.path ?? src;
    if (/^https?:\/\//i.test(resolvedPath)) return resolvedPath;
    return buildImagePlaceholder(resolvedPath);
  };

  const handleLinkNavigate = (href: string) => {
    if (!href) return;
    actions.openByPath(href, activeFile.path);
  };

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
              onClick={async () => {
                if (mode === "source") {
                  const latest = await syncFromEditor();
                  if (latest !== undefined) scheduleSave(latest);
                }
                setMode("wysiwyg");
              }}
            >
              WYSIWYG
            </button>
            <button
              className={`mode-btn ${mode === "source" ? "mode-btn--active" : ""}`}
              onClick={async () => {
                const latest = await syncFromEditor();
                if (latest !== undefined) scheduleSave(latest);
                setMode("source");
              }}
            >
              Source
            </button>
          </div>
          <div className="editor__status">{ui.saving ? "Saving..." : "Saved"}</div>
        </header>
        {ext === "md" ? (
          <>
            <MilkdownSurface
              value={encodeWikiLinks(draft)}
              fileId={activeFile.id}
              active={mode === "wysiwyg"}
              onLinkNavigate={handleLinkNavigate}
              resolveMediaSrc={resolveMediaSrc}
              onChange={(md) => {
                const normalized = decodeWikiLinks(md);
                setDraft(normalized);
                scheduleSave(normalized);
              }}
              key={activeFile.id}
            />
            {mode === "source" && (
              <textarea
                className="editor__textarea"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  scheduleSave(e.target.value);
                }}
              />
            )}
          </>
        ) : ext === "txt" ? (
          <textarea
            className="editor__textarea"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              scheduleSave(e.target.value);
            }}
          />
        ) : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext ?? "") ? (
          <div className="editor__preview-placeholder">
            <img
              src={activeFile.downloadUrl ?? assetUrl ?? buildImagePlaceholder(activeFile.path)}
              alt={activeFile.path}
              className="editor__preview-img"
            />
            <a className="download-btn" href={activeFile.downloadUrl ?? assetUrl} download>
              Download image
            </a>
          </div>
        ) : ext === "pdf" ? (
          <div className="editor__preview-placeholder">
            {assetUrl ? (
              <object data={activeFile.downloadUrl ?? assetUrl} type="application/pdf" className="editor__pdf">
                <a href={activeFile.downloadUrl ?? assetUrl} download>
                  Download PDF
                </a>
              </object>
            ) : (
              <a className="download-btn" href={activeFile.downloadUrl ?? assetUrl ?? "#"} download>
                Download PDF
              </a>
            )}
          </div>
        ) : (
          <div className="editor__preview-placeholder">
            <div>Preview not supported.</div>
            <a className="download-btn" href={activeFile.downloadUrl ?? assetUrl} download>
              Download file
            </a>
          </div>
        )}
      </section>
    </MilkdownProvider>
  );
}
