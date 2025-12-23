import { create } from 'zustand';
import { FileSystemItem, IVirtualFileSystem } from '../shared/types';
import { MockVFS } from '../services/mockVFS';
import { workerVFS } from '../services/workerClient';

// Configuration to switch between Mock and Real Worker
const USE_MOCK = true;
const vfs: IVirtualFileSystem = USE_MOCK ? new MockVFS() : workerVFS;

interface AppState {
    fileTree: FileSystemItem[];
    currentFileId: string | null;
    currentFileContent: string | null;
    sidebarOpen: boolean;
    isLoading: boolean;

    // Actions
    toggleSidebar: () => void;
    loadFiles: (parentId?: string) => Promise<void>;
    openFile: (id: string) => Promise<void>;
    saveFile: (content: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    fileTree: [],
    currentFileId: null,
    currentFileContent: null,
    sidebarOpen: true,
    isLoading: false,

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    loadFiles: async (parentId = 'root') => {
        set({ isLoading: true });
        try {
            const files = await vfs.listFiles(parentId);
            set({ fileTree: files, isLoading: false });
        } catch (err) {
            console.error('Failed to load files:', err);
            set({ isLoading: false });
        }
    },

    openFile: async (id: string) => {
        set({ isLoading: true, currentFileId: id });
        try {
            const content = await vfs.readFile(id);
            set({ currentFileContent: content, isLoading: false });
        } catch (err) {
            console.error('Failed to open file:', err);
            set({ isLoading: false });
        }
    },

    saveFile: async (content: string) => {
        const { currentFileId } = get();
        if (!currentFileId) return;
        try {
            await vfs.writeFile(currentFileId, content);
            set({ currentFileContent: content });
        } catch (err) {
            console.error('Failed to save file:', err);
        }
    }
}));
