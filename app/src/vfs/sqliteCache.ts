import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import type { CacheStore } from "./cacheStore";

type SQLiteCacheOptions = {
  maxBytes: number;
  dbName?: string;
  persist?: boolean;
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

export async function createSQLiteCache(options: SQLiteCacheOptions): Promise<CacheStore> {
  const SQL = await initSqlJs();
  const persisted = options.persist ? await loadPersistedDb(options.dbName ?? "cache.db") : undefined;
  const db = persisted ? new SQL.Database(persisted) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      size INTEGER NOT NULL
    );
  `);

  const encoder = new TextEncoder();

  const cache: CacheStore = {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const stmt = db.prepare("SELECT value FROM kv WHERE key = ?");
      stmt.bind([key]);
      let row: unknown[] | undefined;
      while (stmt.step()) {
        row = stmt.get();
        break;
      }
      stmt.free();
      if (!row) return undefined;
      db.run("UPDATE kv SET updatedAt = ? WHERE key = ?", [Date.now(), key]);
      return JSON.parse(row[0] as string) as T;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      const asString = JSON.stringify(value);
      const size = encoder.encode(asString).byteLength;
      db.run(
        `
        INSERT INTO kv (key, value, updatedAt, size)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updatedAt = excluded.updatedAt,
          size = excluded.size;
      `,
        [key, asString, Date.now(), size],
      );
      evictIfNeeded();
      await persistDb(db, options.persist ? options.dbName ?? "cache.db" : undefined);
    },
  };

  const evictIfNeeded = () => {
    let totalSize = db.exec("SELECT COALESCE(SUM(size), 0) as total FROM kv")[0]?.values[0][0] as number;
    while (totalSize > options.maxBytes) {
      db.run("DELETE FROM kv WHERE key IN (SELECT key FROM kv ORDER BY updatedAt ASC LIMIT 1)");
      totalSize = db.exec("SELECT COALESCE(SUM(size), 0) as total FROM kv")[0]?.values[0][0] as number;
    }
  };

  return cache;
}
