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
    id: "external-1",
    path: "/Shared/Outside.md",
    content: "External note outside the app root.",
    createdByApp: false,
    lastModified: now,
    revision: 1,
  },
];
