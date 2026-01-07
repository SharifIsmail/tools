/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { handleAuthCallback, loadTokens, logout, startLogin, type TokenSet, getValidAccessToken } from "./auth";

type AuthContextValue = {
  tokens?: TokenSet;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | undefined>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<TokenSet | undefined>(() => loadTokens());
  const [loading, setLoading] = useState(false);
  const [handledCallback, setHandledCallback] = useState(false);

  useEffect(() => {
    if (handledCallback) return;
    if (window.location.pathname === "/auth/callback") {
      setLoading(true);
      handleAuthCallback()
        .then((next) => setTokens(next))
        .finally(() => {
          setLoading(false);
          setHandledCallback(true);
          const cleaned = new URL(window.location.href);
          cleaned.search = "";
          cleaned.pathname = "/";
          window.history.replaceState({}, "", cleaned.toString());
        });
    }
  }, [handledCallback]);

  const getAccessTokenMemo = useCallback(async () => {
    const token = await getValidAccessToken();
    const refreshed = loadTokens();
    setTokens(refreshed);
    return token;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      tokens,
      loading,
      login: startLogin,
      logout: () => {
        logout();
        setTokens(undefined);
      },
      getAccessToken: getAccessTokenMemo,
    }),
    [getAccessTokenMemo, loading, tokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
