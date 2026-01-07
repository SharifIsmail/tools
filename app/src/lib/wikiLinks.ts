const WIKI_PATTERN = /\[\[([^[\]]+)\]\]/g;
const WIKI_LINK_PATTERN = /\[([^[\]]+)\]\(\s*wiki:([^)]+?)\s*\)/g;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function encodeWikiLinks(markdown: string): string {
  return markdown.replace(WIKI_PATTERN, (_match, target: string) => {
    const trimmed = target.trim();
    const encoded = encodeURIComponent(trimmed);
    return `[${trimmed}](wiki:${encoded})`;
  });
}

export function decodeWikiLinks(markdown: string): string {
  return markdown
    .replace(WIKI_LINK_PATTERN, (_match, _text: string, target: string) => `[[${safeDecode(target.trim())}]]`)
    .replace(WIKI_PATTERN, (_match, target: string) => `[[${target.trim()}]]`);
}

export function extractWikiTarget(raw: string): string | null {
  const trimmed = safeDecode(raw.trim());
  const bracket = trimmed.match(/^\[\[([\s\S]+)\]\]$/);
  if (bracket) {
    return bracket[1].trim();
  }
  if (trimmed.toLowerCase().startsWith("wiki:")) {
    return trimmed.slice(5).trim();
  }
  return null;
}
