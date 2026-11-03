import { useCallback, useEffect, useState } from 'react';
import { type MarginNotesPreference, read_margin_notes, write_margin_notes } from '@/services/prefs';

/* The "margin notes while writing" switch, shared by Settings and the editor: both read the same
   localStorage key and hear each other's changes through the window event prefs.ts fires. */
export const useMarginNotesPref = () => {
    const [pref, set_pref_state] = useState<MarginNotesPreference>(read_margin_notes);

    useEffect(() => {
        const sync = () => set_pref_state(read_margin_notes());
        window.addEventListener('ta-prefs', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('ta-prefs', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const set_pref = useCallback((next: MarginNotesPreference) => {
        write_margin_notes(next);
        set_pref_state(next);
    }, []);

    return { pref, enabled: pref === 'on', set_pref };
};
