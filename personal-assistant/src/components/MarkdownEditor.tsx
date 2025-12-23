import { useEffect, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { ReactEditor, useEditor } from '@milkdown/react';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { useAppStore } from '../store/useAppStore';

interface EditorProps {
    content: string;
    fileId: string;
}

export const MarkdownEditor = ({ content, fileId }: EditorProps) => {
    const saveFile = useAppStore(state => state.saveFile);

    // Ref to track if we are currently saving to avoid loops (not strictly needed with debounce but good practice)
    const isSaving = useRef(false);

    const { get } = useEditor((root) =>
        Editor.make()
            .config((ctx) => {
                ctx.set(rootCtx, root);
                ctx.set(defaultValueCtx, content);
                ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
                    if (markdown !== prevMarkdown) {
                        saveFile(markdown);
                    }
                });
            })
            .config(nord)
            .use(commonmark)
            .use(listener),
        [fileId] // Re-create editor when fileId changes
    );

    return <ReactEditor editor={get()} className="prose dark:prose-invert max-w-none min-h-[50vh] outline-none" />;
};
