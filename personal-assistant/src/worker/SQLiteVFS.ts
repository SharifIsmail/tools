import { IVirtualFileSystem, FileSystemItem, FileType } from '../shared/types';
import { getDB, execute } from './db';

export class SQLiteVFS implements IVirtualFileSystem {
    constructor() {
        this.init();
    }

    private async init() {
        getDB().then(() => console.log('SQLiteVFS: DB Initialized'));
    }

    async listFiles(parentId: string): Promise<FileSystemItem[]> {
        const { sqlite3, db } = await getDB();

        const rows = await execute(sqlite3, db,
            `SELECT id, parentId, name, type, mimeType, lastModified FROM files WHERE parentId = ?`,
            [parentId]
        );

        return rows.map(row => ({
            id: row.id,
            parentId: row.parentId,
            name: row.name,
            type: row.type as FileType,
            mimeType: row.mimeType,
            lastModified: row.lastModified
        }));
    }

    async readFile(id: string): Promise<string> {
        const { sqlite3, db } = await getDB();
        const rows = await execute(sqlite3, db, `SELECT content FROM files WHERE id = ?`, [id]);
        return rows.length > 0 ? rows[0].content : '';
    }

    async writeFile(id: string, content: string): Promise<void> {
        const { sqlite3, db } = await getDB();

        // We assume file exists (created via createItem) or we do a lazy check? 
        // The previous test expected 'writeFile' to work on an existing file.

        await execute(sqlite3, db, `
        UPDATE files 
        SET content = ?, lastModified = ? 
        WHERE id = ?
    `, [content, Date.now(), id]);
    }

    async createItem(name: string, parentId: string, type: FileType): Promise<FileSystemItem> {
        const { sqlite3, db } = await getDB();
        const id = crypto.randomUUID();
        const now = Date.now();

        const newItem: FileSystemItem = {
            id,
            parentId,
            name,
            type,
            mimeType: type === 'folder' ? 'application/vnd.google-apps.folder' : 'text/plain',
            lastModified: now
        };

        await execute(sqlite3, db, `
        INSERT INTO files (id, parentId, name, type, mimeType, lastModified, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, parentId, name, type, newItem.mimeType, now, '']);

        return newItem;
    }

    async createCopy(sourceId: string, targetParentId: string): Promise<FileSystemItem> {
        const { sqlite3, db } = await getDB();

        const rows = await execute(sqlite3, db, `SELECT * FROM files WHERE id = ?`, [sourceId]);
        if (rows.length === 0) throw new Error(`Source file ${sourceId} not found`);

        const sourceItem = rows[0];
        const sourceContent = sourceItem.content; // assuming select * returns content

        const newId = crypto.randomUUID();
        const now = Date.now();
        const newName = `Copy of ${sourceItem.name}`;

        const newItem: FileSystemItem = {
            id: newId,
            parentId: targetParentId,
            name: newName,
            type: sourceItem.type as FileType,
            mimeType: sourceItem.mimeType,
            lastModified: now
        };

        await execute(sqlite3, db, `
        INSERT INTO files (id, parentId, name, type, mimeType, lastModified, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
     `, [newId, targetParentId, newName, newItem.type, newItem.mimeType, now, sourceContent]);

        return newItem;
    }

    async exportDatabase(): Promise<void> {
        console.log('SQLiteVFS: Exporting DB...');
    }
}
