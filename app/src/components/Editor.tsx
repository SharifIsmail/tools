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
import { decodeWikiLinks, encodeWikiLinks } from "../lib/wikiLinks";
import { buildImagePlaceholder, guessMimeFromPath } from "../lib/media";
import { resolvePathMatches } from "../vfs/pathResolver";
import { APP_ROOT_PATH } from "../config";

function MilkdownSurface({
  value,
  onChange,
  onLinkNavigate,
  resolveMediaSrc,
}: {
  value: string;
  onChange: (md: string) => void;
  onLinkNavigate: (href: string) => void;
  resolveMediaSrc: (src: string) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  return <div ref={containerRef} className="editor__surface milkdown" role="textbox" aria-label="Document editor" />;
}

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
    return () => URL.revokeObjectURL(url);
  }, [activeFile?.id, activeFile?.content, activeFile?.path]);

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
        {ext === "md" ? (
          mode === "wysiwyg" ? (
            <MilkdownSurface
              value={encodeWikiLinks(draft)}
              onLinkNavigate={handleLinkNavigate}
              resolveMediaSrc={resolveMediaSrc}
              onChange={(md) => {
                const normalized = decodeWikiLinks(md);
                setDraft(normalized);
                scheduleSave(normalized);
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
          )
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
            <img src={assetUrl ?? buildImagePlaceholder(activeFile.path)} alt={activeFile.path} className="editor__preview-img" />
            <a className="download-btn" href={assetUrl} download>
              Download image
            </a>
          </div>
        ) : ext === "pdf" ? (
          <div className="editor__preview-placeholder">
            {assetUrl ? (
              <object data={assetUrl} type="application/pdf" className="editor__pdf">
                <a href={assetUrl} download>
                  Download PDF
                </a>
              </object>
            ) : (
              <a className="download-btn" href={assetUrl ?? "#"} download>
                Download PDF
              </a>
            )}
          </div>
        ) : (
          <div className="editor__preview-placeholder">
            <div>Preview not supported.</div>
            <a className="download-btn" href={assetUrl} download>
              Download file
            </a>
          </div>
        )}
      </section>
    </MilkdownProvider>
  );
}
