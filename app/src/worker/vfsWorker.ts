/// <reference lib="WebWorker" />
import { VirtualFileSystem } from "../vfs/virtualFileSystem";
import { InMemoryDrive } from "../vfs/InMemoryDrive";
import { InMemoryCacheStore } from "../vfs/cacheStore";
import { APP_ROOT, seedFiles } from "../vfs/sampleData";
import { createSQLiteCache } from "../vfs/sqliteCache";
import { IMPORTED_FOLDER_NAME } from "../config";

type WorkerRequest =
  | { id: string; action: "list" }
  | { id: string; action: "read"; payload: { fileId: string } }
  | { id: string; action: "ensureEditable"; payload: { fileId: string } }
  | { id: string; action: "write"; payload: { fileId: string; content: string; expectedRevision?: number } }
  | { id: string; action: "resolvePath"; payload: { path: string; fromPath?: string } };

type WorkerResponse =
  | { id: string; result: unknown }
  | { id: string; error: string };

const drive = new InMemoryDrive(seedFiles);
const cachePromise = createSQLiteCache({ maxBytes: 5 * 1024 * 1024, persist: true, dbName: "vfs-cache.db" }).catch(() => new InMemoryCacheStore());
const vfsPromise = cachePromise.then(
  (cache) => new VirtualFileSystem({ appRoot: APP_ROOT, importedDir: IMPORTED_FOLDER_NAME, drive, cache }),
);

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  const { id } = message;
  const respond = (response: WorkerResponse) => ctx.postMessage(response);

  try {
    const vfs = await vfsPromise;
    switch (message.action) {
      case "list": {
        const files = await vfs.listFiles();
        respond({ id: message.id, result: files });
        break;
      }
      case "read": {
        const file = await vfs.readFile(message.payload.fileId);
        respond({ id: message.id, result: file });
        break;
      }
      case "ensureEditable": {
        const ensured = await vfs.ensureEditable(message.payload.fileId);
        respond({ id: message.id, result: ensured });
        break;
      }
      case "write": {
        const saved = await vfs.writeFile(message.payload.fileId, message.payload.content, {
          expectedRevision: message.payload.expectedRevision,
        });
        respond({ id: message.id, result: saved });
        break;
      }
      case "resolvePath": {
        const matches = await vfs.resolvePath(message.payload.path, message.payload.fromPath);
        respond({ id: message.id, result: matches });
        break;
      }
      default: {
        respond({ id, error: `Unknown action ${(message as WorkerRequest).action}` });
      }
    }
  } catch (error) {
    respond({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
