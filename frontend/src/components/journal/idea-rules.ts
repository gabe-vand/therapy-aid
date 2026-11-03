/* The exact rules for the "💡 I have an idea…" button (SPEC §8), kept as pure functions so they can
   be tested without a UI and cannot drift from the component:
   - visible once the draft has at least 120 characters;
   - pulses (once) when the draft has grown by 200+ characters since the last insight AND the
     writer has paused for 4 seconds — it "occasionally pops up" without ever generating by itself. */

export const IDEA_MIN_CHARS = 120;
export const IDEA_GROWTH_CHARS = 200;
export const IDEA_PAUSE_MS = 4000;

export const idea_visible = (draft_length: number): boolean => draft_length >= IDEA_MIN_CHARS;

/* `baseline` is the draft length when the entry was opened or when the last insight was made. */
export const idea_wants_pulse = (draft_length: number, baseline: number): boolean => idea_visible(draft_length) && draft_length - baseline >= IDEA_GROWTH_CHARS;

/* First non-empty line of an entry, minus markdown heading marks — the list's one-line preview. */
export const first_line = (body: string): string => {
    const line = body.split('\n').find((l) => l.trim() !== '');
    return line ? line.trim().replace(/^#+\s*/, '') || 'Untitled entry' : 'Untitled entry';
};
