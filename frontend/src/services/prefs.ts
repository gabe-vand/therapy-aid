/* Per-device preferences that need no server: today just whether margin notes are written while
   journaling. Read/written through localStorage, which can be absent or throw (private windows,
   blocked storage), so every access is guarded and the default wins. The theme has its own
   module (theme.ts) because it must run before React. */

export const MARGIN_NOTES_KEY = 'ta-margin-notes';

export type MarginNotesPreference = 'on' | 'off';

export const DEFAULT_MARGIN_NOTES: MarginNotesPreference = 'on';

export const read_margin_notes = (): MarginNotesPreference => {
    try {
        return localStorage.getItem(MARGIN_NOTES_KEY) === 'off' ? 'off' : DEFAULT_MARGIN_NOTES;
    } catch {
        return DEFAULT_MARGIN_NOTES;
    }
};

export const write_margin_notes = (pref: MarginNotesPreference): void => {
    try {
        localStorage.setItem(MARGIN_NOTES_KEY, pref);
    } catch {
        // Storage unavailable: the choice holds for this page only.
    }
    window.dispatchEvent(new Event('ta-prefs'));
};
