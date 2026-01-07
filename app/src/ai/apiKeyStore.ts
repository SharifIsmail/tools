const KEY = "app.ai.apiKey";

export function loadApiKey(): string | undefined {
  return localStorage.getItem(KEY) ?? undefined;
}

export function saveApiKey(value: string) {
  localStorage.setItem(KEY, value);
}
