import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { SQLiteVFS } from './SQLiteVFS';
import 'fake-indexeddb/auto';
import fs from 'node:fs/promises';
import path from 'node:path';

// @vitest-environment happy-dom

// Mock crypto
if (!crypto.randomUUID) {
    crypto.randomUUID = () => Math.random().toString(36).substring(2);
}

// Global Fetch Mock for WASM
const WASM_PATH = path.resolve(__dirname, '../../node_modules/wa-sqlite/dist/wa-sqlite-async.wasm');

beforeAll(() => {
    // Only mock if not already working, but wa-sqlite uses fetch(url)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = input.toString();
        if (urlString.endsWith('.wasm')) {
            try {
                const buffer = await fs.readFile(WASM_PATH);
                return new Response(buffer, { headers: { 'Content-Type': 'application/wasm' } });
            } catch (e) {
                console.error("Failed to read Mock WASM", e);
                return originalFetch(input, init);
            }
        }
        return originalFetch(input, init);
    };
});


describe('SQLiteVFS', () => {
    let vfs: SQLiteVFS;

    beforeEach(async () => {
        vfs = new SQLiteVFS();
        // Wait for async init to potentially finish (though it lazily loads on first call too)
        await new Promise(r => setTimeout(r, 100));
    });

    it('should list empty files initially', async () => {
        const files = await vfs.listFiles('root');
        expect(files).toEqual([]);
    });

    it('should create and read a file', async () => {
        const file = await vfs.createItem('test.md', 'root', 'file');
        expect(file.name).toBe('test.md');
        expect(file.parentId).toBe('root');

        const content = await vfs.readFile(file.id);
        expect(content).toBe('');
    });

    it('should write and read content', async () => {
        const file = await vfs.createItem('note.md', 'root', 'file');
        await vfs.writeFile(file.id, '# Hello');
        const content = await vfs.readFile(file.id);
        expect(content).toBe('# Hello');
    });

    it('should create a copy of a file', async () => {
        const file = await vfs.createItem('original.md', 'root', 'file');
        await vfs.writeFile(file.id, 'Original Content');

        const copy = await vfs.createCopy(file.id, 'folder_1');
        expect(copy.name).toBe('Copy of original.md');
        expect(copy.parentId).toBe('folder_1');
        expect(copy.id).not.toBe(file.id);

        const copyContent = await vfs.readFile(copy.id);
        expect(copyContent).toBe('Original Content');
    });
});
