import { describe, expect, it } from 'vitest';
import { elapsed_phrase, format_date, format_month, format_time, from_date_input, relative_time, to_date_input, today_input } from '@/services/dates';

// Local-time helpers: assertions build their inputs in local time so they hold in any zone.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe('format_*', () => {
    it('formats dates, times and months; null or junk is an em dash', () => {
        expect(format_date(local(2026, 9, 11))).toBe('Sep 11, 2026');
        expect(format_date(local(2026, 9, 11), { weekday: true })).toBe('Fri, Sep 11, 2026');
        expect(format_date(local(2026, 9, 11), { year: false })).toBe('Sep 11');
        expect(format_time(local(2026, 9, 11, 15, 5))).toBe('3:05 PM');
        expect(format_month(local(2026, 9, 11))).toBe('September 2026');
        for (const bad of [null, undefined, '', 'nope']) expect(format_date(bad)).toBe('—');
    });
});

describe('elapsed_phrase', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    const days = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000).toISOString();

    it('reads as a duration: days, then weeks (the stale range), then months', () => {
        expect(elapsed_phrase(days(1), now)).toBe('1 day');
        expect(elapsed_phrase(days(10), now)).toBe('10 days');
        expect(elapsed_phrase(days(35), now)).toBe('5 weeks');
        expect(elapsed_phrase(days(65), now)).toBe('9 weeks');
        expect(elapsed_phrase(days(200), now)).toBe('6 months');
        expect(elapsed_phrase(null, now)).toBe('—');
    });
});

describe('relative_time', () => {
    const now = new Date(2026, 10, 2, 12, 0);
    const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

    it('reads naturally across scales', () => {
        expect(relative_time(ago(20), now)).toBe('just now');
        expect(relative_time(ago(5 * 60), now)).toBe('5 minutes ago');
        expect(relative_time(ago(3 * 3600), now)).toBe('3 hours ago');
        expect(relative_time(ago(26 * 3600), now)).toBe('yesterday');
        expect(relative_time(ago(3 * 86400), now)).toBe('3 days ago');
        expect(relative_time(ago(21 * 86400), now)).toBe('3 weeks ago');
        expect(relative_time(ago(65 * 86400), now)).toBe('2 months ago');
        expect(relative_time(ago(-2 * 86400), now)).toBe('in 2 days');
        expect(relative_time(null, now)).toBe('—');
    });
});

describe('date inputs', () => {
    it('round-trips a YYYY-MM-DD through noon local time', () => {
        const iso = from_date_input('2026-09-11')!;
        expect(new Date(iso).getHours()).toBe(12);
        expect(to_date_input(iso)).toBe('2026-09-11');
        expect(from_date_input('')).toBeNull();
        expect(from_date_input('11/09/2026')).toBeNull();
        expect(to_date_input(null)).toBe('');
        expect(today_input(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
    });
});
