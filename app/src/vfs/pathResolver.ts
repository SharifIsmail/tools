import { extractWikiTarget } from "../lib/wikiLinks";
import type { FileRecord } from "./types";

type ResolveOptions = {
  appRoot: string;
  fromPath?: string;
};

export type PathResolution = {
  query: string;
  matches: FileRecord[];
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePath(path: string): string {
  if (!path) return "/";
  const trimmed = path.trim();
  const withoutHash = trimmed.split("#")[0] ?? "";
  const cleaned = withoutHash.replace(/\\/g, "/");
  const ensureLeading = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const strippedTrailing = ensureLeading.replace(/\/+$/, "");
  return strippedTrailing || "/";
}

function hasExtension(segment: string): boolean {
  const base = segment.split("/").pop() ?? "";
  return base.includes(".");
}

function directoryOf(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}`;
}

function resolveRelative(basePath: string, relative: string): string {
  const baseParts = directoryOf(basePath)
    .split("/")
    .filter(Boolean);
  const relativeParts = relative.split("/").filter((part) => part.length > 0);
  const stack = [...baseParts];
  relativeParts.forEach((part) => {
    if (part === ".") return;
    if (part === "..") {
      stack.pop();
      return;
    }
    stack.push(part);
  });
  return `/${stack.join("/")}`;
}

function basenameWithoutExt(path: string): string {
  const base = path.split("/").pop() ?? path;
  const [name] = base.split(".");
  return name ?? base;
}

function matchCandidates(files: FileRecord[], candidates: string[]): FileRecord[] {
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  return files.filter((file) => lowerCandidates.includes(file.path.toLowerCase()));
}

function buildCandidates(normalizedPath: string): string[] {
  const candidates = new Set<string>();
  candidates.add(normalizedPath);
  if (!hasExtension(normalizedPath)) {
    candidates.add(`${normalizedPath}.md`);
    candidates.add(`${normalizedPath}/index.md`);
  }
  return Array.from(candidates);
}

export function resolvePathMatches(files: FileRecord[], rawPath: string, options: ResolveOptions): PathResolution {
  const decoded = rawPath ? safeDecode(rawPath) : "";
  const wikiTarget = extractWikiTarget(decoded);
  if (wikiTarget) {
    const matches = files.filter((file) => basenameWithoutExt(file.path).toLowerCase() === wikiTarget.toLowerCase());
    return { query: wikiTarget, matches };
  }

  const basePath = options.fromPath ?? options.appRoot;
  const normalized = normalizePath(decoded.startsWith("/") ? decoded : resolveRelative(basePath, decoded));
  const candidates = buildCandidates(normalized);
  let matches = matchCandidates(files, candidates);

  if (matches.length === 0 && !hasExtension(normalized)) {
    const shortName = normalized.replace(/^\/+/, "");
    matches = files.filter((file) => basenameWithoutExt(file.path).toLowerCase() === shortName.toLowerCase());
    return { query: shortName, matches };
  }

  return { query: normalized, matches };
}
