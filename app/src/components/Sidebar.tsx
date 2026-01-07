import { useMemo, useState } from "react";
import type { FileRecord } from "../vfs/virtualFileSystem";
import { APP_ROOT_PATH } from "../config";
import { useAppActions, useAppStoreSelector } from "../state/AppContext";

type TreeNode = {
  name: string;
  path: string;
  files: FileRecord[];
  children: Record<string, TreeNode>;
  indexFileId?: string;
};

function buildTree(files: FileRecord[], appRoot: string): TreeNode {
  const root: TreeNode = { name: appRoot, path: appRoot, files: [], children: {} };
  files.forEach((file) => {
    if (!file.path.startsWith(appRoot)) return;
    const relative = file.path.slice(appRoot.length).replace(/^\/+/, "");
    const parts = relative.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        const isIndex = /^index\.md$/i.test(part);
        if (isIndex) {
          node.indexFileId = file.id;
        } else {
          node.files.push(file);
        }
      } else {
        if (!node.children[part]) {
          node.children[part] = { name: part, path: `${node.path}/${part}`, files: [], children: {} };
        }
        node = node.children[part];
      }
    }
  });
  return root;
}

function TreeNodeView({ node, expanded, toggle }: { node: TreeNode; expanded: Set<string>; toggle: (path: string) => void }) {
  const actions = useAppActions();
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.files.length > 0 || Object.keys(node.children).length > 0;

  return (
    <div className="tree-node">
      <div
        className="tree-node__header"
        role="button"
        tabIndex={0}
        onClick={() => {
          console.info("[Sidebar] header click", { path: node.path, indexFile: node.indexFileId, hasChildren });
          if (node.indexFileId) actions.openFile(node.indexFileId);
          if (hasChildren) toggle(node.path);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            console.info("[Sidebar] header key", { path: node.path, key: e.key, indexFile: node.indexFileId, hasChildren });
            if (node.indexFileId) actions.openFile(node.indexFileId);
            if (hasChildren) toggle(node.path);
          }
        }}
      >
        <span className="tree-node__chevron">{hasChildren ? (isExpanded ? "▾" : "▸") : "•"}</span>
        <span>{node.name === node.path ? "Home" : node.name}</span>
      </div>
      {isExpanded && (
        <div className="tree-node__children">
          {node.files
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((file) => (
              <div
                key={file.id}
                className="tree-node__file"
                onClick={() => {
                  console.info("[Sidebar] file click", { id: file.id, path: file.path });
                  void actions.openFile(file.id);
                }}
                role="button"
                tabIndex={0}
              >
                {file.path.split("/").pop()}
              </div>
            ))}
          {Object.values(node.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <TreeNodeView key={child.path} node={child} expanded={expanded} toggle={toggle} />
            ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const files = useAppStoreSelector((s) => s.files);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([APP_ROOT_PATH]));
  const tree = useMemo(() => buildTree(files, APP_ROOT_PATH), [files]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Files</div>
      <div className="sidebar__tree">
        <TreeNodeView node={tree} expanded={expanded} toggle={toggle} />
      </div>
    </aside>
  );
}
