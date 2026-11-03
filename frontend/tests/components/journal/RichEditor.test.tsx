import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichEditor } from '@/components/journal/RichEditor';

/* The real TipTap editor, headless enough for happy-dom: it loads Markdown as its initial content
   without reporting a change (so opening an entry never autosaves it), exposes the accessible
   label on the contenteditable, and reports every edit as tidied Markdown. Layout-dependent
   behaviour (typing, selection) is not testable here; commands stand in for keystrokes. */

const mount = (value: string) => {
    const on_change = vi.fn();
    let editor: Editor | null = null;
    render(<RichEditor value={value} on_change={on_change} label="Journal entry" placeholder="What's on your mind?" on_editor={(e) => (editor = e)} />);
    return { on_change, editor: () => editor! };
};

describe('RichEditor', () => {
    it('renders the Markdown as rich text under the given label, without firing on_change', async () => {
        const { on_change, editor } = mount('# Big day\n\n- **one**\n- two');
        const box = await screen.findByRole('textbox', { name: 'Journal entry' });
        await waitFor(() => expect(editor()).toBeTruthy());
        expect(box).toHaveClass('ta-doc');
        expect(box.querySelector('h1')).toHaveTextContent('Big day');
        expect(box.querySelector('li strong')).toHaveTextContent('one');
        expect(on_change).not.toHaveBeenCalled();
    });

    it('reports edits as Markdown, with plain-text characters left readable', async () => {
        const { on_change, editor } = mount('Tom');
        await waitFor(() => expect(editor()).toBeTruthy());
        act(() => void editor().chain().focus('end').insertContent(' & Jerry').run());
        expect(on_change).toHaveBeenLastCalledWith('Tom & Jerry');
        act(() => void editor().chain().selectAll().toggleBold().run());
        expect(on_change).toHaveBeenLastCalledWith('**Tom & Jerry**');
    });
});
