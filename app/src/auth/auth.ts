import { GOOGLE_CLIENT_ID } from "../config";

export type TokenSet = {
  accessToken: string;
  expiresAt: number;
  scope: string;
};

const STORAGE_KEY = "app.oauth.tokens";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const EXPIRY_SKEW_MS = 60_000;
let scriptPromise: Promise<void> | null = null;
let tokenClient: GisTokenClient | null = null;
let currentExchange: Promise<TokenSet | undefined> | null = null;

type GisTokenClient = {
  requestAccessToken: (options: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
};

type GisWindow = typeof window & {
  __mockGisClient?: GisTokenClient;
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: TokenResponse) => void;
        }) => GisTokenClient;
        revoke?: (token: string, done?: () => void) => void;
      };
    };
  };
};

export const ALLOWED_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.labels",
];

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

export function loadTokens(): TokenSet | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as TokenSet;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveTokens(tokens: TokenSet | undefined) {
  if (!tokens) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function trackAuthDebug(message: string) {
  try {
    const existing = (window as unknown as { __authDebug?: string[] }).__authDebug ?? [];
    const next = [...existing, `${new Date().toISOString()} ${message}`];
    (window as unknown as { __authDebug?: string[] }).__authDebug = next.slice(-50);
  } catch {
    // ignore debug failures
  }
}

function ensureGisScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== "undefined" && (window as GisWindow).__mockGisClient) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  if (typeof window !== "undefined" && (window as GisWindow).google?.accounts?.oauth2) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function ensureTokenClient(): Promise<GisTokenClient> {
  await ensureGisScript();
  if (tokenClient) return tokenClient;
  if (typeof window !== "undefined" && (window as GisWindow).__mockGisClient) {
    tokenClient = (window as GisWindow).__mockGisClient ?? null;
    return tokenClient!;
  }
  if (!(window as GisWindow).google?.accounts?.oauth2) {
    throw new Error("Google Identity Services not available");
  }
  tokenClient = (window as GisWindow).google!.accounts!.oauth2!.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: ALLOWED_SCOPES.join(" "),
    callback: () => {},
  });
  return tokenClient;
}

async function requestToken(prompt: "" | "consent" | "select_account"): Promise<TokenSet | undefined> {
  if (currentExchange) return currentExchange;
  const client = await ensureTokenClient();

  currentExchange = new Promise<TokenSet | undefined>((resolve) => {
    client.callback = (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) {
        trackAuthDebug(`[Auth] GIS token error ${resp.error ?? "unknown"}`);
        currentExchange = null;
        resolve(undefined);
        return;
      }
      const expiresInMs = (resp.expires_in ?? 3600) * 1000;
      const expiresAt = Date.now() + expiresInMs;
      const tokenSet: TokenSet = {
        accessToken: resp.access_token,
        expiresAt,
        scope: resp.scope ?? ALLOWED_SCOPES.join(" "),
      };
      saveTokens(tokenSet);
      trackAuthDebug("[Auth] GIS token success");
      currentExchange = null;
      resolve(tokenSet);
    };
    try {
      client.requestAccessToken({ prompt });
    } catch (err) {
      trackAuthDebug(`[Auth] GIS token request threw ${String(err)}`);
      currentExchange = null;
      resolve(undefined);
    }
  });

  return currentExchange;
}

export async function startLogin(): Promise<TokenSet | undefined> {
  saveTokens(undefined);
  return requestToken("consent");
}

export async function getValidAccessToken(): Promise<string | undefined> {
  const tokens = loadTokens();
  if (tokens && tokens.expiresAt > Date.now() + EXPIRY_SKEW_MS) {
    return tokens.accessToken;
  }
  const refreshed = await requestToken("");
  return refreshed?.accessToken;
}

export function logout() {
  saveTokens(undefined);
}

// Test-only utility to reset internal GIS state
export function __resetAuthForTest() {
  scriptPromise = null;
  tokenClient = null;
  currentExchange = null;
}
