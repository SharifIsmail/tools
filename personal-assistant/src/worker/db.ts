import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import * as SQLite from 'wa-sqlite';
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';

let sqlite3: SQLiteAPI | null = null;
let db: number | null = null;

export async function getDB(): Promise<{ sqlite3: SQLiteAPI; db: number }> {
    if (sqlite3 && db) return { sqlite3, db };

    const module = await SQLiteESMFactory();
    sqlite3 = SQLite.Factory(module);

    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

    if (isTest) {
        const vfs = new MemoryVFS('test-vfs');
        sqlite3.vfs_register(vfs, true);
    } else {
        const vfs = new IDBBatchAtomicVFS('parent-vfs');
        await vfs.isReady;
        sqlite3.vfs_register(vfs, true);
    }

    db = await sqlite3.open_v2('personal-assistant.db');

    // Initialize Schema
    await sqlite3.exec(db, `
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            parentId TEXT,
            name TEXT,
            type TEXT,
            mimeType TEXT,
            lastModified INTEGER,
            size INTEGER,
            content TEXT
        );
        
        CREATE TABLE IF NOT EXISTS pending_uploads (
           id TEXT PRIMARY KEY,
           timestamp INTEGER
        );
    `);

    return { sqlite3, db };
}

export async function closeDB() {
    if (sqlite3 && db) {
        await sqlite3.close(db);
        db = null;
        sqlite3 = null;
    }
}

/**
 * Helper to run a prepared statement with parameter binding.
 */
export async function execute(sqlite3: SQLiteAPI, db: number, sql: string, params: any[] = []): Promise<any[]> {
    const str = sqlite3.str_new(db, sql);
    const sqlPtr = sqlite3.str_value(str);
    const preparation = await sqlite3.prepare_v2(db, sqlPtr);

    if (!preparation) {
        // null return means success but no statement (e.g. comment or empty string)
        sqlite3.str_finish(str);
        return [];
    }

    const { stmt } = preparation;

    try {
        // Bind Parameters
        for (let i = 0; i < params.length; i++) {
            const val = params[i];
            const index = i + 1;

            if (val === null || val === undefined) {
                sqlite3.bind_null(stmt, index);
            } else if (typeof val === 'number') {
                if (Number.isInteger(val)) {
                    sqlite3.bind_int(stmt, index, val);
                } else {
                    sqlite3.bind_double(stmt, index, val);
                }
            } else if (typeof val === 'string') {
                sqlite3.bind_text(stmt, index, val);
            } else if (val instanceof Uint8Array) {
                sqlite3.bind_blob(stmt, index, val);
            } else {
                sqlite3.bind_text(stmt, index, JSON.stringify(val));
            }
        }

        // Execute & Fetch
        const results: any[] = [];

        while (true) {
            const status = await sqlite3.step(stmt);
            if (status === SQLite.SQLITE_DONE) break;
            if (status !== SQLite.SQLITE_ROW) {
                const err = sqlite3.errmsg(db);
                throw new Error(`SQLite Step Error: ${err} (Code ${status})`);
            }

            const columnCount = sqlite3.column_count(stmt);
            const row: any = {};

            for (let i = 0; i < columnCount; i++) {
                const name = sqlite3.column_name(stmt, i);
                const type = sqlite3.column_type(stmt, i);
                let val: any;
                switch (type) {
                    case SQLite.SQLITE_INTEGER:
                        val = sqlite3.column_int(stmt, i);
                        break;
                    case SQLite.SQLITE_FLOAT:
                        val = sqlite3.column_double(stmt, i);
                        break;
                    case SQLite.SQLITE_TEXT:
                        val = sqlite3.column_text(stmt, i);
                        break;
                    case SQLite.SQLITE_BLOB:
                        val = sqlite3.column_blob(stmt, i);
                        break;
                    case SQLite.SQLITE_NULL:
                        val = null;
                        break;
                }
                row[name] = val;
            }
            results.push(row);
        }

        return results;
    } finally {
        await sqlite3.finalize(stmt);
        sqlite3.str_finish(str);
    }
}
