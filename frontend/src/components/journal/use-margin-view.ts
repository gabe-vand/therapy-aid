import { useCallback, useEffect, useRef, useState } from 'react';
import type { JournalInsight } from '@therapy-aid/shared';
import { type Placed, useNoteAnchors } from './use-note-anchors';

/* The view state behind the margin notes of the open entry, shared by the three pieces that
   render them (MarginNotes.tsx): whether the pane is wide enough for a margin (a media query,
   kept in sync), where each note sits (use-note-anchors), which note just arrived (`fresh`, for
   the fade-in) and, on the narrow layout, the "New margin note" pill that scrolls to it. DOM
   only; no network. */

export const MARGIN_QUERY = '(min-width: 1280px)';
const FRESH_MS = 8000;

export interface MarginView {
    wide: boolean;
    column_ref: (el: HTMLElement | null) => void;
    placed: Placed[];
    fresh: number | null;
    pill: number | null;
    jump: (id: number) => void;
}

const matches = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MARGIN_QUERY).matches;

/* `loaded`: whether the entry's note history has been fetched. Notes that appear before that are
   history, not arrivals, so they never fade in or raise the pill. */
export const useMarginView = (notes: JournalInsight[], doc: HTMLElement | null, loaded = true): MarginView => {
    const [column, set_column] = useState<HTMLElement | null>(null);
    const [wide, set_wide] = useState(matches);
    const [fresh, set_fresh] = useState<number | null>(null);
    const [pill, set_pill] = useState<number | null>(null);
    const known = useRef<Set<number>>(new Set(notes.map((n) => n.id)));
    const was_loaded = useRef(loaded);
    const placed = useNoteAnchors(notes, doc, column, wide);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(MARGIN_QUERY);
        const sync = () => set_wide(query.matches);
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    // A note we have not seen before arrived: mark it fresh (and, on a phone, offer to jump to it).
    useEffect(() => {
        // The history landing (loaded flipping on, often in the same render as its notes) is not an arrival.
        const settled = was_loaded.current;
        was_loaded.current = loaded;
        const arrived = loaded && settled ? notes.find((n) => !known.current.has(n.id)) : undefined;
        for (const n of notes) known.current.add(n.id);
        if (!arrived) return;
        set_fresh(arrived.id);
        if (!wide) set_pill(arrived.id);
        const timer = setTimeout(() => {
            set_fresh(null);
            set_pill(null);
        }, FRESH_MS);
        return () => clearTimeout(timer);
    }, [notes, wide, loaded]);

    const jump = useCallback((id: number) => {
        set_pill(null);
        document.querySelector(`[data-note-id="${id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, []);

    const column_ref = useCallback((el: HTMLElement | null) => set_column(el), []);

    return { wide, column_ref, placed, fresh, pill, jump };
};
