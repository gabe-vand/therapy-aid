/* The rules for "Gabe just finished a paragraph" — the trigger behind margin notes — as pure
   functions over the stored Markdown, so they are testable without an editor:
   - a block is text between blank lines (a list item or quote counts; headings and rules don't);
   - it is "settled" when, as plain text, it ends a sentence (. ! ? …, closing quotes allowed) and
     has at least MIN_CHARS characters;
   - a block is identified by a cheap hash of its plain text, so the same paragraph never fires
     twice and the blocks an entry opened with never fire at all (they are seeded as seen).
   The hook (use-margin-notes) decides when to look: SETTLE_MS after the last keystroke. */
import { strip_markdown } from './entry-text';

export const MIN_CHARS = 60;
export const SETTLE_MS = 2000;
export const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

export interface Block {
    key: string;
    text: string;
}

/* djb2 over the text — short, stable, collision-free enough for "have I seen this paragraph". */
export const hash_text = (text: string): string => {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
};

/* Every block of the Markdown as plain text with its key, in document order. Headings, rules and
   empty blocks are left out. */
export const split_blocks = (markdown: string): Block[] =>
    markdown
        .split(/\n[ \t]*\n/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk && !/^#{1,6}\s/.test(chunk) && !/^(?:[-*_]\s*){3,}$/.test(chunk))
        .map((chunk) => chunk.split('\n').map(strip_markdown).filter(Boolean).join(' ').replace(/\s+/g, ' '))
        .filter((text) => text.length > 0)
        .map((text) => ({ key: hash_text(text), text }));

/* True when the paragraph reads as finished: long enough and ending a sentence. */
export const is_settled = (text: string): boolean => text.length >= MIN_CHARS && SENTENCE_END.test(text);

/* The settled blocks of `markdown` whose keys are not in `seen`, in document order. */
export const new_settled_blocks = (markdown: string, seen: ReadonlySet<string>): Block[] => split_blocks(markdown).filter((b) => is_settled(b.text) && !seen.has(b.key));

/* The first ~N characters of a block's plain text — what a note's `anchor` is compared against. */
export const anchor_key = (text: string, length = 40): string => text.slice(0, length).trim().toLowerCase();
