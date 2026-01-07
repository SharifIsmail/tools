import type { CacheStore } from "./cacheStore";
import { resolvePathMatches } from "./pathResolver";
import type { DriveAdapter, FileRecord } from "./types";

export type WriteOptions = {
  expectedRevision?: number;
};

export type EnsureEditableResult = FileRecord & { isCopy: boolean };

type VfsConfig = {
  appRoot: string;
  importedDir: string;
  drive: DriveAdapter;
  cache: CacheStore;
};

export class VirtualFileSystem {
  private config: VfsConfig;

  constructor(config: VfsConfig) {
    this.config = config;
  }

  private async getRevision(id: string) {
    const cached = await this.config.cache.get<{ revision: number }>(`rev:${id}`);
    if (cached?.revision) {
      return cached.revision;
    }
    return 1;
  }

  private async bumpRevision(id: string) {
    const current = await this.getRevision(id);
    const next = current + 1;
    await this.config.cache.set(`rev:${id}`, { revision: next });
    return next;
  }

  async listFiles() {
    return this.config.drive.listFiles();
  }

  async readFile(id: string): Promise<FileRecord> {
    const cached = await this.config.cache.get<FileRecord>(`file:${id}`);
    if (cached) {
      await this.config.cache.set(`rev:${id}`, { revision: cached.revision ?? 1 });
      return cached;
    }
    const file = await this.config.drive.readFile(id);
    const revision = await this.getRevision(id);
    const record = { ...file, revision };
    await this.config.cache.set(`file:${id}`, record);
    return record;
  }

  async ensureEditable(id: string): Promise<EnsureEditableResult> {
    const file = await this.readFile(id);
    const isInAppRoot = file.path.startsWith(this.config.appRoot);
    if (file.createdByApp && isInAppRoot) {
      return { ...file, isCopy: false };
    }

    const copyPath = this.buildImportPath(file.path);
    const copy = await this.config.drive.createFile(copyPath, file.content, true);
    const copyRevision = await this.getRevision(copy.id);
    const record = { ...copy, revision: copyRevision, isCopy: true };
    await this.config.cache.set(`file:${record.id}`, record);
    return record;
  }

  async writeFile(id: string, content: string, options: WriteOptions = {}) {
    const currentRevision = await this.getRevision(id);
    const overwritten = options.expectedRevision !== undefined && options.expectedRevision < currentRevision;
    const nextRevision = await this.bumpRevision(id);
    const saved = await this.config.drive.writeFile(id, content);
    const record = { ...saved, revision: nextRevision, overwritten };
    await this.config.cache.set(`file:${id}`, record);
    return record;
  }

  async resolvePath(path: string, fromPath?: string): Promise<FileRecord[]> {
    const files = await this.listFiles();
    const result = resolvePathMatches(files, path, { appRoot: this.config.appRoot, fromPath });
    return result.matches;
  }

  private buildImportPath(originalPath: string) {
    const normalized = originalPath.startsWith("/") ? originalPath.slice(1) : originalPath;
    return `${this.config.appRoot}/${this.config.importedDir}/${normalized}`;
  }
}

export type { FileRecord };
