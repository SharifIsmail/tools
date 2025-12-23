export type FileType = 'file' | 'folder';

/**
 * Represents a file or folder in the Virtual File System.
 * Corresponds to a row in the SQLite 'files' table.
 */
export interface FileSystemItem {
    id: string;          // Google Drive ID
    parentId: string | null;
    name: string;
    type: FileType;
    mimeType: string;
    lastModified: number; // Unix Timestamp
    size?: number;
    // Note: Content is NOT loaded by default in list views
}

/**
 * The unified API exposed by the VFS Worker (via Comlink).
 * UI components interact ONLY with this interface.
 */
export interface IVirtualFileSystem {
    // --- Queries (Optimized for SQLite execution) ---
    /**
     * Returns children of a folder.
     * fast-path: Query SQLite.
     * slow-path: If folder is 'stale', sync with Drive.
     */
    listFiles(parentId: string): Promise<FileSystemItem[]>;

    /**
     * Reads full file content.
     * fast-path: Return cached content from SQLite/OPFS.
     * slow-path: Fetch from Drive, update Cache, return.
     */
    readFile(id: string): Promise<string>;

    // --- Mutations (Write-through pattern) ---
    /**
     * Writes content to a file.
     * 1. Update SQLite content (Immediate UI feedback)
     * 2. Queue background upload to Drive
     */
    writeFile(id: string, content: string): Promise<void>;

    /**
     * Creates a new file/folder.
     */
    createItem(name: string, parentId: string, type: FileType): Promise<FileSystemItem>;

    /**
     * "Copy on Edit" logic helper.
     */
    createCopy(sourceId: string, targetParentId: string): Promise<FileSystemItem>;

    // --- Maintenance ---
    /**
     * Forces a full backup of the SQLite DB to Google Drive
     */
    exportDatabase(): Promise<void>;
}

export type IndexStatus = 'idle' | 'crawling' | 'indexing';

export interface IndexStatusResult {
    indexedCount: number;
    queueSize: number;
    status: IndexStatus;
}

export type SearchMatchType = 'title' | 'content' | 'entity';

export interface SearchResult {
    fileId: string;
    path: string;
    title: string;
    snippet: string; // Context around the keyword match
    score: number;   // FTS5 rank
    matchType: SearchMatchType;
}

/**
 * The API exposed by the Index Service (Worker).
 */
export interface IIndexService {
    /**
     * FTS5 Full Text Search against SQLite.
     */
    search(query: string): Promise<SearchResult[]>;

    /**
     * Returns crawler status for UI indicators.
     */
    getStatus(): Promise<IndexStatusResult>;
}
