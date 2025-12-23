import { FileSystemItem, IVirtualFileSystem, FileType } from '../shared/types';

export class MockVFS implements IVirtualFileSystem {
    private files: Map<string, FileSystemItem> = new Map();
    private content: Map<string, string> = new Map();

    constructor() {
        // Seed with some dummy data
        this.seedData();
    }

    private seedData() {
        const rootId = 'root';
        const folderId = 'folder_1';

        this.files.set(folderId, {
            id: folderId,
            parentId: rootId,
            name: 'My Projects',
            type: 'folder',
            mimeType: 'application/vnd.google-apps.folder',
            lastModified: Date.now(),
        });

        const fileId = 'file_1';
        this.files.set(fileId, {
            id: fileId,
            parentId: folderId,
            name: 'Project Plan.md',
            type: 'file',
            mimeType: 'text/markdown',
            lastModified: Date.now(),
        });
        this.content.set(fileId, '# Project Plan\n\nThis is a mock file content.');

        const fileId2 = 'file_root';
        this.files.set(fileId2, {
            id: fileId2,
            parentId: rootId,
            name: 'Root Note.md',
            type: 'file',
            mimeType: 'text/markdown',
            lastModified: Date.now()
        });
        this.content.set(fileId2, '# Root Note\n\nLiving in the root.');
    }

    async listFiles(parentId: string): Promise<FileSystemItem[]> {
        console.log(`MockVFS: listFiles(${parentId})`);
        await this.delay(300); // Simulate network/db latency
        return Array.from(this.files.values()).filter(f => f.parentId === parentId);
    }

    async readFile(id: string): Promise<string> {
        console.log(`MockVFS: readFile(${id})`);
        await this.delay(100);
        return this.content.get(id) || '';
    }

    async writeFile(id: string, content: string): Promise<void> {
        console.log(`MockVFS: writeFile(${id})`);
        await this.delay(500); // Simulate write latency
        this.content.set(id, content);

        const meta = this.files.get(id);
        if (meta) {
            meta.lastModified = Date.now();
            this.files.set(id, meta);
        }
    }

    async createItem(name: string, parentId: string, type: FileType): Promise<FileSystemItem> {
        console.log(`MockVFS: createItem(${name}, ${parentId})`);
        await this.delay(500);
        const id = `mock_${Date.now()}`;
        const newItem: FileSystemItem = {
            id,
            parentId,
            name,
            type,
            mimeType: type === 'folder' ? 'application/vnd.google-apps.folder' : 'text/plain',
            lastModified: Date.now()
        };
        this.files.set(id, newItem);
        if (type === 'file') {
            this.content.set(id, '');
        }
        return newItem;
    }

    async createCopy(sourceId: string, targetParentId: string): Promise<FileSystemItem> {
        console.log(`MockVFS: createCopy(${sourceId}, ${targetParentId})`);
        await this.delay(500);
        const source = this.files.get(sourceId);
        if (!source) throw new Error('Source not found');

        const id = `copy_${Date.now()}`;
        const newItem: FileSystemItem = {
            ...source,
            id,
            parentId: targetParentId,
            name: `Copy of ${source.name}`,
            lastModified: Date.now()
        };
        this.files.set(id, newItem);
        this.content.set(id, this.content.get(sourceId) || '');
        return newItem;
    }

    async exportDatabase(): Promise<void> {
        console.log('MockVFS: exportDatabase called');
        await this.delay(1000);
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
