import { GOOGLE_CLIENT_ID } from "../config";
import { generateCodeVerifier, sha256 } from "./pkce";

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
};

const STORAGE_KEY = "app.oauth.tokens";
const VERIFIER_KEY = "app.oauth.verifier";
const STATE_KEY = "app.oauth.state";
const HANDLED_KEY = "app.oauth.handled";
let currentExchange: Promise<TokenSet | undefined> | null = null;

export const ALLOWED_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.labels",
];

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

function saveVerifier(verifier: string, state: string) {
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
}

function consumeVerifier() {
  const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? "";
  const state = sessionStorage.getItem(STATE_KEY) ?? "";
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return { verifier, state };
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

export async function buildAuthRequest() {
  currentExchange = null;
  sessionStorage.removeItem(HANDLED_KEY);
  const verifier = generateCodeVerifier();
  const state = crypto.randomUUID();
  const redirectUri = `${window.location.origin}/auth/callback`;
  const challenge = await sha256(verifier);
  saveVerifier(verifier, state);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ALLOWED_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
    verifier,
    redirectUri,
  };
}

export function startLogin() {
  currentExchange = null;
  sessionStorage.removeItem(HANDLED_KEY);
  buildAuthRequest().then(({ url }) => {
    window.location.href = url;
  });
}

export async function handleAuthCallback(): Promise<TokenSet | undefined> {
  if (currentExchange) {
    return currentExchange;
  }
  const handledState = sessionStorage.getItem(HANDLED_KEY);
  if (handledState === "true") {
    return loadTokens();
  }
  if (handledState === "pending") {
    if (currentExchange) return currentExchange;
    return loadTokens();
  }
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return undefined;
  const { verifier, state: expectedState } = consumeVerifier();
  if (!verifier || !state || state !== expectedState) {
    console.warn("[Auth] Invalid OAuth state; skipping token exchange", { state, expectedState });
    trackAuthDebug(`[Auth] Invalid OAuth state; state=${state} expected=${expectedState}`);
    return undefined;
  }
  if (handledState !== "true") {
    sessionStorage.setItem(HANDLED_KEY, "pending");
  }
  currentExchange = (async () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("[Auth] Token exchange failed", { status: response.status, body: text.slice(0, 500) });
      trackAuthDebug(`[Auth] Token exchange failed status=${response.status} body=${text.slice(0, 120)}`);
      sessionStorage.removeItem(HANDLED_KEY);
      currentExchange = null;
      return undefined;
    }
    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    const tokenSet: TokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scope: data.scope,
    };
    saveTokens(tokenSet);
    sessionStorage.setItem(HANDLED_KEY, "true");
    trackAuthDebug("[Auth] Token exchange succeeded");
    currentExchange = Promise.resolve(tokenSet);
    return tokenSet;
  })();

  return currentExchange;
}

export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  const data = await response.json();
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  const tokenSet: TokenSet = {
    accessToken: data.access_token,
    refreshToken,
    expiresAt,
    scope: data.scope,
  };
  saveTokens(tokenSet);
  return tokenSet;
}

export async function getValidAccessToken(): Promise<string | undefined> {
  const tokens = loadTokens();
  if (!tokens) return undefined;
  if (tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) return undefined;
  const refreshed = await refreshTokens(tokens.refreshToken);
  return refreshed.accessToken;
}

export function logout() {
  saveTokens(undefined);
}
