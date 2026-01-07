import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import type { FileRecord } from "../vfs/virtualFileSystem";

export type IndexEntry = {
  fileId: string;
  path: string;
  lastModified: number;
  summary: string;
  keywords: string[];
  entities: string[];
};

type IndexStoreOptions = {
  dbName?: string;
  persist?: boolean;
  maxResults?: number;
};

async function loadPersistedDb(dbName: string): Promise<Uint8Array | undefined> {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory || !dbName) return undefined;
  const root = await navigator.storage.getDirectory();
  try {
    const handle = await root.getFileHandle(dbName);
    const file = await handle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return undefined;
  }
}

async function persistDb(db: Database, dbName?: string) {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory || !dbName) return;
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(dbName, { create: true });
  const writable = await handle.createWritable();
  const data = db.export();
  await writable.write(new Uint8Array(data));
  await writable.close();
}

export type IndexStore = {
  enqueueFiles(files: Pick<FileRecord, "id" | "path" | "lastModified">[]): Promise<void>;
  nextBatch(limit: number): Promise<string[]>;
  markDone(fileId: string): Promise<void>;
  saveIndex(entry: IndexEntry): Promise<void>;
  search(query: string): Promise<IndexEntry[]>;
};

export async function createIndexStore(options: IndexStoreOptions = {}): Promise<IndexStore> {
  const SQL = await initSqlJs();
  const persisted = options.persist ? await loadPersistedDb(options.dbName ?? "index.db") : undefined;
  const db = persisted ? new SQL.Database(persisted) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      fileId TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      lastModified INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS queue (
      fileId TEXT PRIMARY KEY,
      enqueuedAt INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS idx (
      fileId TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      lastModified INTEGER NOT NULL,
      summary TEXT NOT NULL,
      keywords TEXT NOT NULL,
      entities TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  const persist = () => persistDb(db, options.persist ? options.dbName ?? "index.db" : undefined);

  async function enqueueFiles(files: Pick<FileRecord, "id" | "path" | "lastModified">[]) {
    const insertQueue = db.prepare(
      `INSERT INTO queue (fileId, enqueuedAt)
       VALUES (?, ?)
       ON CONFLICT(fileId) DO UPDATE SET enqueuedAt=excluded.enqueuedAt`,
    );
    const upsertFiles = db.prepare(
      `INSERT INTO files (fileId, path, lastModified)
       VALUES (?, ?, ?)
       ON CONFLICT(fileId) DO UPDATE SET path=excluded.path, lastModified=excluded.lastModified`,
    );
    const selectIdx = db.prepare("SELECT lastModified FROM idx WHERE fileId = ?");

    db.run("BEGIN");
    files.forEach((file) => {
      upsertFiles.bind([file.id, file.path, file.lastModified]);
      upsertFiles.step();
      upsertFiles.reset();

      selectIdx.bind([file.id]);
      const hasRow = selectIdx.step();
      const row = hasRow ? (selectIdx.get()[0] as number) : undefined;
      selectIdx.reset();
      if (!row || row < file.lastModified) {
        insertQueue.bind([file.id, Date.now()]);
        insertQueue.step();
        insertQueue.reset();
      }
    });
    db.run("COMMIT");
    insertQueue.free();
    upsertFiles.free();
    selectIdx.free();
    await persist();
  }

  async function nextBatch(limit: number) {
    const stmt = db.prepare("SELECT fileId FROM queue ORDER BY enqueuedAt ASC LIMIT ?");
    stmt.bind([limit]);
    const ids: string[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      ids.push(row[0] as string);
    }
    stmt.free();
    return ids;
  }

  async function markDone(fileId: string) {
    db.run("DELETE FROM queue WHERE fileId = ?", [fileId]);
    await persist();
  }

  async function saveIndex(entry: IndexEntry) {
    const stmt = db.prepare(
      `INSERT INTO idx (fileId, path, lastModified, summary, keywords, entities, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fileId) DO UPDATE SET
         path=excluded.path,
         lastModified=excluded.lastModified,
         summary=excluded.summary,
         keywords=excluded.keywords,
         entities=excluded.entities,
         updatedAt=excluded.updatedAt`,
    );
    stmt.bind([
      entry.fileId,
      entry.path,
      entry.lastModified,
      entry.summary,
      JSON.stringify(entry.keywords),
      JSON.stringify(entry.entities),
      Date.now(),
    ]);
    stmt.step();
    stmt.free();
    await markDone(entry.fileId);
    await persist();
  }

  async function search(query: string): Promise<IndexEntry[]> {
    if (!query.trim()) return [];
    const term = `%${query.trim().toLowerCase()}%`;
    const stmt = db.prepare(
      `SELECT fileId, path, lastModified, summary, keywords, entities
       FROM idx
       WHERE lower(summary) LIKE ? OR lower(keywords) LIKE ? OR lower(entities) LIKE ?
       ORDER BY updatedAt DESC
       LIMIT ?`,
    );
    stmt.bind([term, term, term, options.maxResults ?? 25]);
    const results: IndexEntry[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      results.push({
        fileId: row[0] as string,
        path: row[1] as string,
        lastModified: row[2] as number,
        summary: row[3] as string,
        keywords: JSON.parse(row[4] as string),
        entities: JSON.parse(row[5] as string),
      });
    }
    stmt.free();
    return results;
  }

  return {
    enqueueFiles,
    nextBatch,
    markDone,
    saveIndex,
    search,
  };
}
