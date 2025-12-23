import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { useAppStore } from './store/useAppStore';
import { MarkdownEditor } from './components/MarkdownEditor';

function App() {
  const { currentFileContent, currentFileId } = useAppStore();

  return (
    <div className="flex w-screen h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          {currentFileContent !== null ? (
            <MarkdownEditor
              key={currentFileId}
              content={currentFileContent}
              fileId={currentFileId!}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a file to view
            </div>
          )}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}

export default App;
