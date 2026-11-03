import { useCallback, useEffect, useState } from 'react';
import type { JournalInsight } from '@therapy-aid/shared';
import { anchor_key } from './paragraphs';

/* Where each margin note sits beside the document: finds the editor block whose plain text
   starts with (or, after edits, still contains the opening of) the note's anchor, measures its
   top relative to the margin column, and spreads overlapping notes downwards. Re-measured on
   every editor update, on resize, and when the notes change. Notes with no matching block get
   `top: null` and are listed under the document instead. DOM-only; no network. */

export const NOTE_GAP = 10;
const FALLBACK_CHARS = 24;

export interface Placed {
    note: JournalInsight;
    top: number | null;
}

const block_text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/* The block element for a note's anchor, if any. */
export const find_block = (doc: HTMLElement, anchor: string | null): HTMLElement | null => {
    if (!anchor) return null;
    const key = anchor_key(anchor);
    const short = key.slice(0, FALLBACK_CHARS);
    const blocks = Array.from(doc.children) as HTMLElement[];
    return blocks.find((el) => block_text(el).startsWith(key)) ?? blocks.find((el) => short.length >= 12 && block_text(el).includes(short)) ?? null;
};

/* Pushes later notes down so none overlap: sorted by desired top, each at least `height +
   NOTE_GAP` below the previous. Pure, exported for tests. */
export const spread = (desired: { id: number; top: number; height: number }[]): Map<number, number> => {
    const placed = new Map<number, number>();
    let floor = 0;
    for (const item of [...desired].sort((a, b) => a.top - b.top || a.id - b.id)) {
        const top = Math.max(item.top, floor);
        placed.set(item.id, top);
        floor = top + item.height + NOTE_GAP;
    }
    return placed;
};

const same = (a: Placed[], b: Placed[]): boolean => a.length === b.length && a.every((p, i) => p.note === b[i]!.note && p.top === b[i]!.top);

export const useNoteAnchors = (notes: JournalInsight[], doc: HTMLElement | null, column: HTMLElement | null, enabled: boolean) => {
    const [placed, set_placed_state] = useState<Placed[]>([]);
    // Only a real change re-renders: measuring runs on every editor mutation, and an identical
    // result must not loop (state, effect, state again).
    const set_placed = useCallback((next: Placed[]) => set_placed_state((prev) => (same(prev, next) ? prev : next)), []);

    const measure = useCallback(() => {
        if (!enabled || !doc || !column) {
            set_placed(notes.map((note) => ({ note, top: null })));
            return;
        }
        const origin = column.getBoundingClientRect().top;
        const desired: { id: number; top: number; height: number }[] = [];
        const unanchored: JournalInsight[] = [];
        for (const note of notes) {
            const block = find_block(doc, note.anchor);
            if (!block) {
                unanchored.push(note);
                continue;
            }
            const card = column.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`);
            desired.push({ id: note.id, top: Math.max(0, block.getBoundingClientRect().top - origin), height: card?.offsetHeight ?? 96 });
        }
        const tops = spread(desired);
        set_placed([...notes.filter((n) => tops.has(n.id)).map((note) => ({ note, top: tops.get(note.id)! })), ...unanchored.map((note) => ({ note, top: null }))]);
    }, [notes, doc, column, enabled, set_placed]);

    useEffect(() => {
        measure();
        if (!enabled || !doc) return;
        const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => measure()) : null;
        observer?.observe(doc, { childList: true, characterData: true, subtree: true });
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;
        resize?.observe(doc);
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            resize?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure, enabled, doc]);

    return placed;
};
