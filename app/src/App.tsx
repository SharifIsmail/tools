import "./App.css";
import { useEffect, useState } from "react";
import { AppProvider, useAppStoreSelector } from "./state/AppContext";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { CommandPalette } from "./components/CommandPalette";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { loadApiKey, saveApiKey } from "./ai/apiKeyStore";

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
  const { tokens, login, logout, loading } = useAuth();
  const [apiKey, setApiKey] = useState(() => loadApiKey() ?? "");
  useEffect(() => {
    if (apiKey) saveApiKey(apiKey);
  }, [apiKey]);
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="auth-bar">
          {tokens ? (
            <button className="auth-btn" onClick={logout} disabled={loading}>
              Sign out
            </button>
          ) : (
            <button className="auth-btn" onClick={login} disabled={loading}>
              Sign in with Google
            </button>
          )}
          <input
            className="auth-input"
            placeholder="Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Editor />
        <StatusBar />
      </main>
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </AuthProvider>
  );
}
