import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { EditorToolbar } from '@/components/journal/EditorToolbar';

/* The journal's formatting bar against a fake editor (happy-dom cannot lay out ProseMirror):
   aria-pressed mirrors editor.isActive, a click runs the matching command through
   chain().focus()…run(), mousedown is cancelled so the editor keeps its selection, and with no
   editor yet every button is disabled. */

const fake_editor = (active: string[] = []) => {
    const calls: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const name of ['focus', 'toggleBold', 'toggleItalic', 'toggleStrike', 'toggleHeading', 'toggleBulletList', 'toggleOrderedList', 'toggleBlockquote']) {
        chain[name] = (arg?: { level: number }) => {
            calls.push(arg ? `${name}:${arg.level}` : name);
            return chain;
        };
    }
    chain.run = () => calls.push('run');
    const editor = { isActive: (name: string, attrs?: { level: number }) => active.includes(attrs ? `${name}:${attrs.level}` : name), chain: () => chain, on: vi.fn(), off: vi.fn(), isDestroyed: false };
    return { editor: editor as unknown as Editor, calls };
};

const LABELS = ['Bold', 'Italic', 'Strikethrough', 'Heading 1', 'Heading 2', 'Bulleted list', 'Numbered list', 'Quote'];

describe('EditorToolbar', () => {
    it('offers the eight formatting toggles in a labelled toolbar', () => {
        render(<EditorToolbar editor={fake_editor().editor} />);
        const buttons = screen.getAllByRole('button');
        expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
        expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(LABELS);
        expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('title')).toMatch(/Bold \((Ctrl|⌘)\+B\)/);
    });

    it('reflects the selection in aria-pressed', () => {
        render(<EditorToolbar editor={fake_editor(['bold', 'heading:2', 'blockquote']).editor} />);
        const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
        expect(pressed.map((b) => b.getAttribute('aria-label'))).toEqual(['Bold', 'Heading 2', 'Quote']);
    });

    it('runs the matching command, focused, on click', () => {
        const { editor, calls } = fake_editor();
        render(<EditorToolbar editor={editor} />);
        fireEvent.click(screen.getByRole('button', { name: 'Heading 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Numbered list' }));
        expect(calls).toEqual(['focus', 'toggleHeading:1', 'run', 'focus', 'toggleOrderedList', 'run']);
    });

    it('keeps the editor focused: mousedown on a button is cancelled', () => {
        render(<EditorToolbar editor={fake_editor().editor} />);
        const allowed = fireEvent.mouseDown(screen.getByRole('button', { name: 'Italic' }));
        expect(allowed).toBe(false);
    });

    it('is disabled until the editor exists', () => {
        render(<EditorToolbar editor={null} />);
        for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
    });
});
