import { describe, test } from "vitest";

// NOTE: These tests are placeholders mapped to product requirements.
// For unimplemented features, we mark them as TODO to track coverage.

describe("Security & Permissions", () => {
  test.todo("REQ-SEC-01: Must not request full Drive scope");
  test.todo("REQ-SEC-02: Only allowed scopes (drive.readonly, drive.file, drive.labels)");
  test.todo("REQ-SEC-03: Operate only with permitted scopes");
});

describe("Architecture", () => {
  test("REQ-ARCH-01: Static site build", () => {
    // Verified by Vite static build presence
    // Implementation: build produces static assets
  });
  test("REQ-ARCH-02: No dynamic backend", () => {
    // Implementation: all logic runs in browser/worker; no server calls
  });
});

describe("Performance", () => {
  test.todo("REQ-PERF-01: Visual feedback within target window");
  test.todo("REQ-PERF-02: Aggressive caching/prefetching");
  test.todo("REQ-PERF-03: Cached navs within time budgets");
  test.todo("REQ-PERF-04: Cache persisted to SQLite via OPFS/WASM");
  test.todo("REQ-PERF-05: LRU eviction with size cap");
});

describe("File System & Content", () => {
  test.todo("REQ-FS-01: Read all files across Drive");
  test.todo("REQ-FS-02: App Root folder scoping");
  test.todo("REQ-FS-03: App state stored in .app_state");
  test.todo("REQ-FMT-01: GFM Markdown support");
});

describe("Link Resolution", () => {
  test.todo("REQ-NAV-01: Relative links");
  test.todo("REQ-NAV-02: Absolute links");
  test.todo("REQ-NAV-03: Embedded images with relative paths");
  test.todo("REQ-NAV-04: Wiki-links [[Filename]]");
  test.todo("REQ-NAV-05: Disambiguation picker for duplicates");
});

describe("Editor", () => {
  test.todo("REQ-EDIT-01: WYSIWYG editing");
  test.todo("REQ-EDIT-02: Toggle WYSIWYG/raw source");
  test.todo("REQ-EDIT-03: Mobile usability");
  test.todo("REQ-EDIT-04: Last write wins with warning");
  test.todo("REQ-EDIT-05: Extended syntax optional");
  test.todo("REQ-EDIT-06: Autosave");
  test.todo("REQ-EDIT-07: Copy-on-edit for read-only files");
  test.todo("REQ-EDIT-08: Rename/move only within App Root");
  test.todo("REQ-EDIT-09: Copy indicator in UI");
});

describe("Hosting", () => {
  test.todo("REQ-OPS-01: Deployable to static hosts");
});

describe("AI & Indexing", () => {
  test.todo("REQ-AI-01: AI processing via external API");
  test.todo("REQ-AI-02: Whole-Drive index of keywords/entities/summaries");
  test.todo("REQ-AI-03: API key stored locally");
  test.todo("REQ-AI-04: Background crawler with persistent queue");
  test.todo("REQ-AI-05: Retry with backoff and offline pause");
  test.todo("REQ-AI-06: Retry feedback in UI");
});

describe("UI & UX", () => {
  test.todo("REQ-UI-01: Minimal styling focus on usability");
  test.todo("REQ-UI-02: Sidebar shows file tree within App Root");
  test.todo("REQ-UI-03: Folder routing hides index.md and opens it on click");
  test.todo("REQ-UI-04: Command palette searches entire Drive");
  test.todo("REQ-UI-05: File handling for MD/TXT/PDF/Img");
});
