import { APP_ROOT_PATH } from "../config";
import type { FileRecord } from "./types";

const now = Date.now();

export const APP_ROOT = APP_ROOT_PATH;

export const seedFiles: FileRecord[] = [
  {
    id: "welcome",
    path: `${APP_ROOT}/Welcome.md`,
    content: "# Welcome\n\nThis is your personal assistant scratchpad.",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "guide",
    path: `${APP_ROOT}/Guide/Index.md`,
    content: "## Guide\n\n- Use the command palette with Ctrl/Cmd+K.\n- Files are cached locally.",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "wiki",
    path: `${APP_ROOT}/Wiki.md`,
    content: "See [[Note]] for details.",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "note-a",
    path: `${APP_ROOT}/Projects/Note.md`,
    content: "Project note content",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "note-b",
    path: `${APP_ROOT}/References/Note.md`,
    content: "Reference note content",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "relative",
    path: `${APP_ROOT}/Links/Relative.md`,
    content: "[Go](../Welcome.md)",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "absolute-link",
    path: `${APP_ROOT}/Links/Absolute.md`,
    content: "[Open Absolute](/MyNotes/Projects/Note.md)",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "image",
    path: `${APP_ROOT}/Media/Picture.png`,
    content: "fake image bytes",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "embedded-image",
    path: `${APP_ROOT}/Media/Embedded.md`,
    content: "Embedded image: ![Picture.png](./Picture.png)",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "pdf",
    path: `${APP_ROOT}/Docs/File.pdf`,
    content: "pdf content",
    createdByApp: true,
    lastModified: now,
    revision: 1,
  },
  {
    id: "external-1",
    path: "/Shared/Outside.md",
    content: "External note outside the app root.",
    createdByApp: false,
    lastModified: now,
    revision: 1,
  },
];
