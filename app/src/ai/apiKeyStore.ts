const KEY = "app.ai.apiKey";

function isForceEnabled(opts?: { force?: boolean }) {
  const envForce = ["true", "1"].includes(((import.meta as ImportMeta).env?.VITE_FORCE_REAL_GEMINI ?? "").toString());
  const globalForce = Boolean((globalThis as { __forceRealGemini?: boolean }).__forceRealGemini);
  return opts?.force === true || envForce || globalForce;
}

export function loadApiKey(opts?: { force?: boolean }): string | undefined {
  const force = isForceEnabled(opts);
  const isE2E = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITE_E2E;
  const isDev = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.DEV;
  const disableKey =
    !force &&
    (Boolean(isE2E && isE2E !== "false") ||
      Boolean(isDev) ||
      ["true", "1"].includes(((import.meta as ImportMeta).env?.VITE_DISABLE_INDEXER ?? "").toString()));
  if (disableKey) return undefined;
  return localStorage.getItem(KEY) ?? undefined;
}

export function saveApiKey(value: string) {
  localStorage.setItem(KEY, value);
}
