import { describe, expect, it } from 'bun:test';
import { bullets, estimateTokens, formatDay, truncateWords } from '@/services/context/format';

describe('formatDay', () => {
    it('renders the day in the given zone (tests run with APP_TIMEZONE=UTC)', () => {
        expect(formatDay('2026-09-11T16:00:00.000Z')).toBe('Fri Sep 11, 2026');
    });

    it('uses the local day, not the UTC day, for an evening session', () => {
        // 9pm in Toronto on Sep 10 is already Sep 11 in UTC.
        expect(formatDay('2026-09-11T01:00:00.000Z', 'America/Toronto')).toBe('Thu Sep 10, 2026');
    });

    it('returns unparseable input unchanged', () => {
        expect(formatDay('someday')).toBe('someday');
    });
});

describe('truncateWords', () => {
    it('keeps short text whole and cuts long text at a word boundary, preserving paragraphs', () => {
        expect(truncateWords('  one two  ', 5)).toBe('one two');
        expect(truncateWords('one two\n\nthree four five', 3)).toBe('one two\n\nthree …');
    });
});

describe('estimateTokens / bullets', () => {
    it('estimates 4 chars per token and renders markdown bullets', () => {
        expect(estimateTokens('x'.repeat(41))).toBe(11);
        expect(bullets([' a ', 'b'])).toBe('- a\n- b');
        expect(bullets([])).toBe('');
    });
});
