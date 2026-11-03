import { describe, expect, it } from 'vitest';
import { ago_phrase, gap_phrase, group_by_month, rhythm_sentence } from '@/components/sessions/rhythm';
import { date_line } from '@/components/sessions/SessionHeader';
import { list_item } from '../../helpers/hlp-sessions';

/* The Sessions screen's pure helpers: the rhythm subtitle, its phrases, the month groups, and
   the detail page's date line. */

const NOW = new Date('2026-11-03T12:00:00.000Z');
const days_before = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('gap_phrase', () => {
    it('speaks in days under ten, weeks from there', () => {
        expect(gap_phrase(1)).toBe('every 1 day');
        expect(gap_phrase(5)).toBe('every 5 days');
        expect(gap_phrase(7.4)).toBe('every 7 days');
        expect(gap_phrase(10)).toBe('every week');
        expect(gap_phrase(14)).toBe('every 2 weeks');
        expect(gap_phrase(22)).toBe('every 3 weeks');
    });
});

describe('ago_phrase', () => {
    it('says today, yesterday, then a duration', () => {
        expect(ago_phrase(days_before(0), NOW)).toBe('today');
        expect(ago_phrase(days_before(1), NOW)).toBe('yesterday');
        expect(ago_phrase(days_before(11), NOW)).toBe('11 days ago');
        expect(ago_phrase(days_before(21), NOW)).toBe('3 weeks ago');
    });
});

describe('rhythm_sentence', () => {
    const sessions = [list_item({ id: 3, occurred_at: days_before(11) }), list_item({ id: 2, occurred_at: days_before(25) }), list_item({ id: 1, occurred_at: '2026-08-06T16:00:00.000Z' })];

    it('counts, dates the first, adds the usual gap and how long since the last', () => {
        expect(rhythm_sentence({ sessions, typical_gap_days: 14, now: NOW })).toBe('3 sessions since Aug 6 · usually every 2 weeks · last one 11 days ago');
    });

    it('leaves the gap out until the dashboard knows it', () => {
        expect(rhythm_sentence({ sessions, typical_gap_days: null, now: NOW })).toBe('3 sessions since Aug 6 · last one 11 days ago');
    });

    it('reads naturally for a single session, and explains an empty list', () => {
        expect(rhythm_sentence({ sessions: [list_item({ occurred_at: '2026-08-06T16:00:00.000Z' })], typical_gap_days: null, now: NOW })).toMatch(/^1 session, on Aug 6 · last one/);
        expect(rhythm_sentence({ sessions: [], typical_gap_days: null, now: NOW })).toBe('Every conversation with David, in one place.');
    });
});

describe('group_by_month', () => {
    it('keeps newest-first order and splits on month changes', () => {
        const groups = group_by_month([list_item({ id: 3, occurred_at: '2026-10-15T16:00:00.000Z' }), list_item({ id: 2, occurred_at: '2026-09-20T16:00:00.000Z' }), list_item({ id: 1, occurred_at: '2026-09-02T16:00:00.000Z' })]);
        expect(groups.map((g) => [g.month, g.items.map((s) => s.id)])).toEqual([
            ['October 2026', [3]],
            ['September 2026', [2, 1]],
        ]);
    });
});

describe('date_line', () => {
    it('drops the year this year and adds the duration when known', () => {
        expect(date_line({ occurred_at: '2026-10-23T16:00:00.000Z', source: 'recording', duration_sec: 48 * 60 }, NOW)).toBe('Fri, Oct 23 · Recorded · 48 min');
        expect(date_line({ occurred_at: '2025-10-23T16:00:00.000Z', source: 'notes', duration_sec: null }, NOW)).toBe('Thu, Oct 23, 2025 · Notes');
    });
});
