import type { CacheStore } from "./cacheStore";
import type { DriveAdapter, FileRecord } from "./types";

export type WriteOptions = {
  expectedRevision?: number;
};

export type EnsureEditableResult = FileRecord & { isCopy: boolean };

type VfsConfig = {
  appRoot: string;
  importedDir: string;
  drive: DriveAdapter;
  cache: CacheStore<{ revision: number }>;
};

export class VirtualFileSystem {
  private config: VfsConfig;

  constructor(config: VfsConfig) {
    this.config = config;
  }

  private async getRevision(id: string) {
    const cached = await this.config.cache.get(`rev:${id}`);
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
    const file = await this.config.drive.readFile(id);
    const revision = await this.getRevision(id);
    return { ...file, revision };
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
    return { ...copy, revision: copyRevision, isCopy: true };
  }

  async writeFile(id: string, content: string, options: WriteOptions = {}) {
    const currentRevision = await this.getRevision(id);
    const overwritten = options.expectedRevision !== undefined && options.expectedRevision < currentRevision;
    const nextRevision = await this.bumpRevision(id);
    const saved = await this.config.drive.writeFile(id, content);
    return { ...saved, revision: nextRevision, overwritten };
  }

  private buildImportPath(originalPath: string) {
    const normalized = originalPath.startsWith("/") ? originalPath.slice(1) : originalPath;
    return `${this.config.appRoot}/${this.config.importedDir}/${normalized}`;
  }
}

export type { FileRecord };
