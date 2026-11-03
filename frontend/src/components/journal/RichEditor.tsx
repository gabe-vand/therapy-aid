import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';
import { EditorToolbar } from './EditorToolbar';
import { tidy_markdown } from './markdown-text';
import '@/components/markdown/markdown.css';
import './journal-editor.css';

/* The journal's rich-text surface (TipTap v3). Storage stays Markdown: `value` is parsed as
   Markdown once, as the INITIAL content (the page re-keys this component per entry), and every
   edit reports `editor.getMarkdown()` — tidied, see markdown-text.ts — through `on_change`.
   Loading the content never fires `on_change`, so opening an entry does not autosave it.
   Inline code and code blocks stay enabled even though the toolbar offers neither: without them
   an old entry's `backticks` would be silently dropped the first time it is edited. Underline is
   off because Markdown cannot store it; links keep their URL but never open on a click.
   The formatting bar renders above the document, sticky (journal-editor.css). happy-dom cannot
   lay ProseMirror out, so page tests replace this component with a textarea stub. */

type Props = { value: string; on_change: (markdown: string) => void; placeholder?: string; autofocus?: boolean; label: string; on_editor?: (editor: Editor | null) => void };

export function RichEditor({ value, on_change, placeholder = '', autofocus = false, label, on_editor }: Props) {
    const on_change_ref = useRef(on_change);
    on_change_ref.current = on_change;

    const editor = useEditor({
        extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: { openOnClick: false, autolink: false } }), Markdown, Placeholder.configure({ placeholder })],
        content: value,
        contentType: 'markdown',
        autofocus: autofocus ? 'end' : false,
        editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', class: 'ta-doc' } },
        onUpdate: ({ editor: e }) => on_change_ref.current(tidy_markdown(e.getMarkdown())),
    });

    useEffect(() => {
        on_editor?.(editor);
        return () => on_editor?.(null);
    }, [editor, on_editor]);

    return (
        <div className="ta-rich">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} className="ta-rich__content" />
        </div>
    );
}
