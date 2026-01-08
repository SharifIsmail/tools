import { loadApiKey } from "./apiKeyStore";
import type { FileRecord } from "../vfs/virtualFileSystem";

export type AiSummary = {
  summary: string;
  keywords: string[];
  entities: string[];
};

export type AiConfig = {
  model?: string;
};

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "models/gemini-flash-lite-latest";

function buildPrompt(text: string) {
  return `You are indexing personal notes. Extract:
- A 1-sentence summary
- 5 keywords (lowercase)
- Up to 5 entities (proper names)

Return JSON with fields: summary, keywords (array), entities (array).

Text:
${text.slice(0, 8000)}
`;
}

function isForceRealGemini() {
  return (
    ["true", "1"].includes(((import.meta as ImportMeta).env?.VITE_FORCE_REAL_GEMINI ?? "").toString()) ||
    Boolean((globalThis as { __forceRealGemini?: boolean }).__forceRealGemini)
  );
}

export async function summarizeFile(file: FileRecord, config: AiConfig = {}): Promise<AiSummary> {
  const forceReal = isForceRealGemini();
  const apiKey = loadApiKey({ force: forceReal });
  const isE2E = typeof import.meta !== "undefined" && (import.meta as ImportMeta).env?.VITE_E2E;
  const disableIndexer =
    ((import.meta as ImportMeta).env?.VITE_DISABLE_INDEXER ?? "") === "true" ||
    ((import.meta as ImportMeta).env?.DEV ?? false) === true;

  if (!forceReal && (!apiKey || isE2E || disableIndexer)) {
    const summary = file.content?.slice(0, 120) ?? "";
    return {
      summary,
      keywords: [],
      entities: [],
    };
  }

  if (!apiKey) {
    throw new Error("Gemini API key is required for live summarization");
  }

  const model =
    (globalThis as { __geminiModel?: string }).__geminiModel ??
    config.model ??
    (import.meta as ImportMeta).env?.VITE_GEMINI_MODEL ??
    DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
  if (typeof window !== "undefined") {
    (window as unknown as { __geminiDebug?: Record<string, unknown> }).__geminiDebug = {
      forceReal,
      model,
      endpoint,
    };
  }
  const body = {
    contents: [
      {
        parts: [{ text: buildPrompt(file.content) }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
    },
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${msg}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary ?? "",
      keywords: parsed.keywords ?? [],
      entities: parsed.entities ?? [],
    };
  } catch {
    return {
      summary: text.slice(0, 240),
      keywords: [],
      entities: [],
    };
  }
}
