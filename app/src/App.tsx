import "./App.css";
import { AppProvider, useAppStoreSelector } from "./state/AppContext";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { CommandPalette } from "./components/CommandPalette";

function StatusBar() {
  const active = useAppStoreSelector((s) => s.activeFile);
  const ui = useAppStoreSelector((s) => s.ui);
  return (
    <div className="status-bar">
      <span>{active ? `Open: ${active.path}` : "No file selected"}</span>
      <span>
        {ui.saving ? "Saving..." : "Saved"} · {ui.indexingStatus === "running" ? "Indexing…" : `Indexing ${ui.indexingStatus}`}
      </span>
    </div>
  );
}

function Shell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Editor />
        <StatusBar />
      </main>
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
