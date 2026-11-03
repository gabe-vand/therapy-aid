import { describe, expect, it } from 'vitest';
import { day_key, days_ago_phrase, days_since, greeting, week_of } from '@/components/home/week';

/* Home's pure date helpers, pinned to fixed local dates. */

describe('week_of', () => {
    it('is Monday to Sunday of the current week, in local days', () => {
        const week = week_of(new Date(2026, 10, 4, 9)); // Wed Nov 4 2026
        expect(week.map((d) => d.day)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
        expect(week.map((d) => d.letter).join('')).toBe('MTWTFSS');
        expect(week[0]!.long).toBe('Monday, Nov 2');
        expect(week.filter((d) => d.is_today).map((d) => d.day)).toEqual(['2026-11-04']);
        expect(week.filter((d) => d.is_future)).toHaveLength(4);
    });

    it('treats Sunday as the end of the week, not the start', () => {
        const week = week_of(new Date(2026, 10, 8, 23, 30)); // Sun Nov 8
        expect(week[0]!.day).toBe('2026-11-02');
        expect(week[6]!.is_today).toBe(true);
        expect(week.some((d) => d.is_future)).toBe(false);
    });

    it('crosses a month boundary', () => {
        expect(week_of(new Date(2026, 11, 1))[0]!.day).toBe('2026-11-30');
    });
});

describe('greeting and days', () => {
    it('greets by hour', () => {
        expect(greeting(new Date(2026, 0, 1, 7))).toBe('Good morning');
        expect(greeting(new Date(2026, 0, 1, 12))).toBe('Good afternoon');
        expect(greeting(new Date(2026, 0, 1, 18))).toBe('Good evening');
    });

    it('counts whole local days and phrases them', () => {
        const now = new Date(2026, 10, 3, 8);
        expect(day_key(now)).toBe('2026-11-03');
        expect(days_since(new Date(2026, 10, 2, 23).toISOString(), now)).toBe(1);
        expect(days_since(new Date(2026, 9, 23, 12).toISOString(), now)).toBe(11);
        expect(days_since('garbage', now)).toBe(0);
        expect([0, 1, 11].map(days_ago_phrase)).toEqual(['today', 'yesterday', '11 days ago']);
    });
});
