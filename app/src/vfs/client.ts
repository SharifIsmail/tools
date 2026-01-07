import { nanoid } from "nanoid";
import { APP_ROOT, seedFiles } from "./sampleData";
import { VirtualFileSystem } from "./virtualFileSystem";
import { InMemoryDrive } from "./InMemoryDrive";
import { InMemoryCacheStore } from "./cacheStore";
import { DriveAdapter } from "../drive/driveAdapter";
import type { EnsureEditableResult, WriteOptions } from "./virtualFileSystem";
import type { FileRecord } from "./types";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export interface VfsClientApi {
  listFiles(): Promise<FileRecord[]>;
  readFile(id: string): Promise<FileRecord>;
  ensureEditable(id: string): Promise<EnsureEditableResult>;
  writeFile(id: string, content: string, opts?: WriteOptions): Promise<FileRecord & { overwritten?: boolean }>;
  resolvePath(path: string): Promise<FileRecord | undefined>;
}

type ClientOptions = {
  accessTokenProvider?: () => Promise<string | undefined>;
};

export function createVfsClient(options: ClientOptions = {}): VfsClientApi {
  const useDrive = Boolean(options.accessTokenProvider);

  if (useDrive || typeof Worker === "undefined") {
    const drive = useDrive
      ? new DriveAdapter(options.accessTokenProvider!)
      : new InMemoryDrive(seedFiles);
    const vfs = new VirtualFileSystem({
      appRoot: APP_ROOT,
      importedDir: "Imported",
      drive,
      cache: new InMemoryCacheStore(),
    });
    return {
      listFiles: () => vfs.listFiles(),
      readFile: (id) => vfs.readFile(id),
      ensureEditable: (id) => vfs.ensureEditable(id),
      writeFile: (id, content, opts) => vfs.writeFile(id, content, opts),
      resolvePath: async (path: string) => {
        const files = await vfs.listFiles();
        const normalized = path.startsWith("/") ? path : `/${path}`;
        return files.find((f) => f.path.toLowerCase() === normalized.toLowerCase());
      },
    };
  }

  const worker = new Worker(new URL("../worker/vfsWorker.ts", import.meta.url), { type: "module" });
  const pending = new Map<string, Pending>();

  worker.onmessage = (event: MessageEvent<{ id: string; result?: unknown; error?: string }>) => {
    const { id, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (error) {
      entry.reject(new Error(error));
    } else {
      entry.resolve(result);
    }
  };

  function call<T>(action: string, payload?: unknown): Promise<T> {
    const id = nanoid();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, action, payload });
    });
  }

  return {
    listFiles: () => call<FileRecord[]>("list"),
    readFile: (id: string) => call<FileRecord>("read", { fileId: id }),
    ensureEditable: (id: string) => call<EnsureEditableResult>("ensureEditable", { fileId: id }),
    writeFile: (id: string, content: string, opts?: WriteOptions) =>
      call<FileRecord & { overwritten?: boolean }>("write", { fileId: id, content, expectedRevision: opts?.expectedRevision }),
    resolvePath: (path: string) => call<FileRecord | undefined>("resolvePath", { path }),
  };
}
