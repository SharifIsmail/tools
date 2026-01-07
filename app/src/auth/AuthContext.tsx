/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { loadTokens, logout, startLogin, type TokenSet, getValidAccessToken } from "./auth";

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

  const login = useCallback(async () => {
    setLoading(true);
    try {
      const next = await startLogin();
      setTokens(next);
    } catch (err) {
      console.warn("[Auth] login failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      login,
      logout: () => {
        logout();
        setTokens(undefined);
      },
      getAccessToken: getAccessTokenMemo,
    }),
    [getAccessTokenMemo, loading, login, tokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
