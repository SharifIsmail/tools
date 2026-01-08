import { nanoid } from "nanoid";
import type { DriveAdapter, FileRecord } from "./types";

export class InMemoryDrive implements DriveAdapter {
  private files: Map<string, FileRecord>;

  constructor(seed: FileRecord[] = []) {
    this.files = new Map(seed.map((f) => [f.id, { ...f }]));
  }

  async readFile(id: string): Promise<FileRecord> {
    const file = this.files.get(id);
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }
    return { ...file };
  }

  async listFiles(): Promise<FileRecord[]> {
    return Array.from(this.files.values()).map((f) => ({ ...f }));
  }

  async writeFile(id: string, content: string, opts?: { path?: string; createdByApp?: boolean }): Promise<FileRecord> {
    const existing = this.files.get(id);
    if (!existing) {
      throw new Error(`File not found: ${id}`);
    }
    const updated: FileRecord = {
      ...existing,
      path: opts?.path ?? existing.path,
      content,
      createdByApp: opts?.createdByApp ?? existing.createdByApp,
      lastModified: Date.now(),
    };
    this.files.set(id, updated);
    return { ...updated };
  }

  async createFile(path: string, content: string, createdByApp: boolean): Promise<FileRecord> {
    const id = nanoid();
    const record: FileRecord = {
      id,
      path,
      content,
      createdByApp,
      lastModified: Date.now(),
    };
    this.files.set(id, record);
    return { ...record };
  }
}
