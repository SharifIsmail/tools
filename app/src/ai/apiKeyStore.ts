const KEY = "app.ai.apiKey";

export function loadApiKey(): string | undefined {
  const isE2E = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITE_E2E;
  const isDev = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.DEV;
  const disableKey =
    Boolean(isE2E && isE2E !== "false") ||
    Boolean(isDev) ||
    ["true", "1"].includes(((import.meta as ImportMeta).env?.VITE_DISABLE_INDEXER ?? "").toString());
  if (disableKey) return undefined;
  return localStorage.getItem(KEY) ?? undefined;
}

export function saveApiKey(value: string) {
  localStorage.setItem(KEY, value);
}
