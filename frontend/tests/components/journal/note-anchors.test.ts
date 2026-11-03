import { describe, expect, it } from 'vitest';
import { find_block, NOTE_GAP, spread } from '@/components/journal/use-note-anchors';

/* Placing margin notes beside their paragraphs: matching a note's anchor to a document block,
   and spreading overlapping cards downwards. */

const doc = (...paragraphs: string[]): HTMLElement => {
    const el = document.createElement('div');
    for (const p of paragraphs) {
        const node = document.createElement('p');
        node.textContent = p;
        el.appendChild(node);
    }
    return el;
};

describe('find_block', () => {
    it('matches the block whose text starts with the anchor, case- and whitespace-insensitively', () => {
        const d = doc('First paragraph about mornings.', '  Lay   awake again, thoughts going a mile a minute, could not switch off.');
        expect(find_block(d, 'Lay awake again, thoughts going a mile a minute')?.textContent).toContain('Lay   awake');
    });

    it('falls back to a shorter contains-match once the paragraph start was edited, else null', () => {
        const d = doc('Yesterday I lay awake again, thoughts going a mile a minute, and could not switch off.');
        expect(find_block(d, 'Lay awake again, thoughts going a mile a minute')).not.toBeNull();
        expect(find_block(d, 'Something else entirely that is not here')).toBeNull();
        expect(find_block(d, null)).toBeNull();
    });
});

describe('spread', () => {
    it('keeps non-overlapping cards where they want to be', () => {
        expect([
            ...spread([
                { id: 1, top: 0, height: 50 },
                { id: 2, top: 200, height: 50 },
            ]).entries(),
        ]).toEqual([
            [1, 0],
            [2, 200],
        ]);
    });

    it('pushes a later card below an overlapping earlier one, by height plus the gap', () => {
        const placed = spread([
            { id: 2, top: 30, height: 80 },
            { id: 1, top: 0, height: 100 },
        ]);
        expect(placed.get(1)).toBe(0);
        expect(placed.get(2)).toBe(100 + NOTE_GAP);
    });
});
