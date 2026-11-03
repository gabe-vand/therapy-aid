import { describe, expect, it } from 'vitest';
import { anchor_key, hash_text, is_settled, MIN_CHARS, new_settled_blocks, split_blocks } from '@/components/journal/paragraphs';

/* The trigger behind margin notes: which paragraphs count as "just finished". */

const LONG = 'Lay awake again with my thoughts going a mile a minute and could not switch off at all.';

describe('split_blocks', () => {
    it('splits on blank lines, strips Markdown, skips headings and rules, keys by content', () => {
        const blocks = split_blocks(`# Title\n\n**Bold** start, _soft_ middle.\nSecond line of the same block.\n\n---\n\n- a list item\n\n> a quote`);
        expect(blocks.map((b) => b.text)).toEqual(['Bold start, soft middle. Second line of the same block.', 'a list item', 'a quote']);
        expect(blocks[0]!.key).toBe(hash_text(blocks[0]!.text));
        expect(split_blocks('')).toEqual([]);
    });
});

describe('is_settled', () => {
    it('needs a sentence end and enough characters', () => {
        expect(is_settled(LONG)).toBe(true);
        expect(is_settled(`${LONG.slice(0, -1)}?"`)).toBe(true);
        expect(is_settled(LONG.slice(0, -1))).toBe(false); // no terminator
        expect(is_settled('Short one.')).toBe(false);
        expect(is_settled('x'.repeat(MIN_CHARS - 2) + '.')).toBe(false);
        expect(is_settled('x'.repeat(MIN_CHARS - 1) + '.')).toBe(true);
    });
});

describe('new_settled_blocks', () => {
    it('returns settled blocks not yet seen, in order', () => {
        const md = `${LONG}\n\nStill typing this one\n\n${LONG} Again.`;
        const first = new_settled_blocks(md, new Set());
        expect(first.map((b) => b.text)).toEqual([LONG, `${LONG} Again.`]);
        expect(new_settled_blocks(md, new Set([first[0]!.key])).map((b) => b.text)).toEqual([`${LONG} Again.`]);
    });

    it('fires nothing for the paragraphs an entry opened with', () => {
        const seen = new Set(split_blocks(LONG).map((b) => b.key));
        expect(new_settled_blocks(LONG, seen)).toEqual([]);
        expect(new_settled_blocks(`${LONG}\n\n${LONG} More words here.`, seen)).toHaveLength(1);
    });
});

describe('anchor_key', () => {
    it('is the lower-cased opening of the text', () => {
        expect(anchor_key('  Lay Awake AGAIN, thoughts going a mile a minute, could not switch off.')).toBe('lay awake again, thoughts going a mile');
    });
});
