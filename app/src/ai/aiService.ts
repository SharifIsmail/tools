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

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-1.5-flash";

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

export async function summarizeFile(file: FileRecord, config: AiConfig = {}): Promise<AiSummary> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error("Missing Gemini API key");
  const model = config.model ?? DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
