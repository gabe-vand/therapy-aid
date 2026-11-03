/* The exact rules for the "I have an idea…" button (SPEC §8), kept as pure functions so they can
   be tested without a UI and cannot drift from the component:
   - visible once the draft has at least 120 characters;
   - pulses (once) when the draft has grown by 200+ characters since the last insight AND the
     writer has paused for 4 seconds — it "occasionally pops up" without ever generating by itself.
   Plus the plain-text helpers the list previews and the character count use: entries are stored
   as Markdown, so the syntax is stripped before a human sees a preview or a count. */

export const IDEA_MIN_CHARS = 120;
export const IDEA_GROWTH_CHARS = 200;
export const IDEA_PAUSE_MS = 4000;

export const idea_visible = (draft_length: number): boolean => draft_length >= IDEA_MIN_CHARS;

/* `baseline` is the draft length when the entry was opened or when the last insight was made. */
export const idea_wants_pulse = (draft_length: number, baseline: number): boolean => idea_visible(draft_length) && draft_length - baseline >= IDEA_GROWTH_CHARS;

/* One line of Markdown as plain text: block markers (#, >, -, *, +, 1.) at the start, emphasis
   marks (*, _, ~~) and backslash escapes anywhere, and [link](url) reduced to its text. */
export const strip_markdown = (line: string): string =>
    line
        .trim()
        .replace(/^(?:>\s*)+/, '')
        .replace(/^#{1,6}\s+/, '')
        .replace(/^(?:[-*_]\s*){3,}$/, '') // a horizontal rule
        .replace(/^(?:[-*+]|\d+[.)])(?:\s+|$)/, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|~~|\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/\\([\\`*_[\]~#>+\-.!])/g, '$1')
        .trim();

/* First non-empty line of an entry, as plain text — the list's one-line preview. */
export const first_line = (body: string): string => {
    const line = body.split('\n').find((l) => strip_markdown(l) !== '');
    return line ? strip_markdown(line) : 'Untitled entry';
};

/* How many characters a reader would count: the text without Markdown syntax or line breaks. */
export const plain_length = (body: string): number => body.split('\n').reduce((n, line) => n + strip_markdown(line).length, 0);
