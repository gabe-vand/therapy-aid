import { useEditorState, type ChainedCommands, type Editor } from '@tiptap/react';
import { Bold, Heading1, Heading2, Italic, List, ListOrdered, Strikethrough, TextQuote, type LucideIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';

/* The formatting bar over the journal document: eight toggles whose aria-pressed follows the
   selection (useEditorState re-renders on every transaction, picking only the booleans). Buttons
   keep focus in the editor by cancelling mousedown, so clicking Bold mid-sentence just bolds.
   The `title` shows the keyboard shortcut TipTap already binds. */

type Tool = { label: string; Icon: LucideIcon; keys: string; is_active: (e: Editor) => boolean; run: (c: ChainedCommands) => ChainedCommands };

export const TOOLS: Tool[] = [
    { label: 'Bold', Icon: Bold, keys: 'Mod+B', is_active: (e) => e.isActive('bold'), run: (c) => c.toggleBold() },
    { label: 'Italic', Icon: Italic, keys: 'Mod+I', is_active: (e) => e.isActive('italic'), run: (c) => c.toggleItalic() },
    { label: 'Strikethrough', Icon: Strikethrough, keys: 'Mod+Shift+S', is_active: (e) => e.isActive('strike'), run: (c) => c.toggleStrike() },
    { label: 'Heading 1', Icon: Heading1, keys: 'Mod+Alt+1', is_active: (e) => e.isActive('heading', { level: 1 }), run: (c) => c.toggleHeading({ level: 1 }) },
    { label: 'Heading 2', Icon: Heading2, keys: 'Mod+Alt+2', is_active: (e) => e.isActive('heading', { level: 2 }), run: (c) => c.toggleHeading({ level: 2 }) },
    { label: 'Bulleted list', Icon: List, keys: 'Mod+Shift+8', is_active: (e) => e.isActive('bulletList'), run: (c) => c.toggleBulletList() },
    { label: 'Numbered list', Icon: ListOrdered, keys: 'Mod+Shift+7', is_active: (e) => e.isActive('orderedList'), run: (c) => c.toggleOrderedList() },
    { label: 'Quote', Icon: TextQuote, keys: 'Mod+Shift+B', is_active: (e) => e.isActive('blockquote'), run: (c) => c.toggleBlockquote() },
];

const is_mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const shortcut = (keys: string) => keys.replace('Mod', is_mac ? '⌘' : 'Ctrl').replace('Alt', is_mac ? '⌥' : 'Alt');

export function EditorToolbar({ editor }: { editor: Editor | null }) {
    const active = useEditorState({ editor, selector: ({ editor: e }) => (e ? TOOLS.map((t) => t.is_active(e)) : TOOLS.map(() => false)) }) ?? [];

    return (
        <div className="ta-format-bar" role="toolbar" aria-label="Formatting">
            {TOOLS.map((tool, i) => (
                <IconButton
                    key={tool.label}
                    size="sm"
                    aria-label={tool.label}
                    aria-pressed={active[i] ?? false}
                    title={`${tool.label} (${shortcut(tool.keys)})`}
                    disabled={!editor}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor && tool.run(editor.chain().focus()).run()}>
                    <tool.Icon aria-hidden />
                </IconButton>
            ))}
        </div>
    );
}
