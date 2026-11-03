import { describe, expect, it } from 'bun:test';
import { isStale, lastTouchedMs } from '@/services/problems/staleness';

const NOW = Date.parse('2026-11-03T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, extra_ms = 0): string => new Date(NOW - days * DAY - extra_ms).toISOString();
const problem = (over: Partial<Parameters<typeof isStale>[0]> = {}): Parameters<typeof isStale>[0] => ({ status: 'active', last_discussed_at: null, last_reviewed_at: null, created_at: ago(100), ...over });

describe('isStale boundaries', () => {
    it('is fresh at 29 days and at exactly 30 days', () => {
        expect(isStale(problem({ last_discussed_at: ago(29) }), NOW)).toBe(false);
        expect(isStale(problem({ last_discussed_at: ago(30) }), NOW)).toBe(false);
    });

    it('is stale once 30 days have passed by even a moment, and at 31 days', () => {
        expect(isStale(problem({ last_discussed_at: ago(30, 1) }), NOW)).toBe(true);
        expect(isStale(problem({ last_discussed_at: ago(31) }), NOW)).toBe(true);
    });

    it('falls back to created_at when never discussed or reviewed', () => {
        expect(isStale(problem({ created_at: ago(31) }), NOW)).toBe(true);
        expect(isStale(problem({ created_at: ago(5) }), NOW)).toBe(false);
    });

    it('uses the most recent of discussed / reviewed / created', () => {
        expect(isStale(problem({ last_discussed_at: ago(90), last_reviewed_at: ago(2) }), NOW)).toBe(false);
        expect(isStale(problem({ last_discussed_at: ago(2), last_reviewed_at: ago(90) }), NOW)).toBe(false);
        expect(lastTouchedMs(problem({ last_discussed_at: ago(40), last_reviewed_at: ago(35), created_at: ago(60) }))).toBe(NOW - 35 * DAY);
    });

    it('never flags resolved or discarded problems', () => {
        expect(isStale(problem({ status: 'resolved', created_at: ago(400) }), NOW)).toBe(false);
        expect(isStale(problem({ status: 'discarded', created_at: ago(400) }), NOW)).toBe(false);
    });
});
