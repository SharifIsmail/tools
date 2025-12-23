import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm">
            <div className="w-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-800">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        className="flex-1 h-12 px-3 bg-transparent outline-none placeholder:text-gray-400"
                        placeholder="Search files..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                    {/* Logic to be connected to IndexService */}
                    <div className="p-2 text-sm text-gray-500 text-center">Type to search...</div>
                </div>
            </div>
            <div className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </div>
    );
};
