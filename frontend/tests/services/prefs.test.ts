import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMarginNotesPref } from '@/services/hooks/use-margin-notes-pref';
import { MARGIN_NOTES_KEY, read_margin_notes, write_margin_notes } from '@/services/prefs';

/* The margin-notes preference: on by default, 'off' sticks in localStorage, and every hook
   instance hears a change. */

afterEach(() => localStorage.removeItem(MARGIN_NOTES_KEY));

describe('prefs', () => {
    it('defaults to on and only ever reads on/off', () => {
        expect(read_margin_notes()).toBe('on');
        localStorage.setItem(MARGIN_NOTES_KEY, 'garbage');
        expect(read_margin_notes()).toBe('on');
        write_margin_notes('off');
        expect(read_margin_notes()).toBe('off');
    });

    it('keeps two hook instances in step', () => {
        const a = renderHook(() => useMarginNotesPref());
        const b = renderHook(() => useMarginNotesPref());
        expect(a.result.current.enabled).toBe(true);
        act(() => a.result.current.set_pref('off'));
        expect(b.result.current.pref).toBe('off');
        expect(localStorage.getItem(MARGIN_NOTES_KEY)).toBe('off');
    });
});
