import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { FileSystemItem } from '../shared/types';

export const Sidebar = () => {
    const { fileTree, loadFiles, openFile, currentFileId } = useAppStore();

    useEffect(() => {
        loadFiles(); // Load root on mount
    }, [loadFiles]);

    const FileItem = ({ item }: { item: FileSystemItem }) => {
        const isSelected = currentFileId === item.id;
        return (
            <div
                className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onClick={() => item.type === 'file' && openFile(item.id)}
            >
                {item.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                <span className="text-sm truncate">{item.name}</span>
            </div>
        );
    };

    return (
        <div className="w-64 h-full border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-950">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 font-semibold">
                My Notes
            </div>
            <div className="flex-1 overflow-y-auto">
                {fileTree.map(item => (
                    <FileItem key={item.id} item={item} />
                ))}
                {fileTree.length === 0 && (
                    <div className="p-4 text-xs text-gray-400">No files found.</div>
                )}
            </div>
        </div>
    );
};
