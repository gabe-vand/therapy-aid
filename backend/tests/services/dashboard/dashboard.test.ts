import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_insights from '@/repositories/journal-insights';
import { buildDashboard } from '@/services/dashboard/dashboard';
import { dayKey, shiftDay, streakDays, typicalGapDays, wordCount } from '@/services/dashboard/rhythm';
import { resetDatabase, seedJournal, seedProblem, seedSession, seedUpdate } from '../../helpers/hlp-db';

// The dashboard is pure arithmetic over rows; `now` is pinned so the tests never drift.

const NOW = Date.parse('2026-11-03T15:00:00.000Z');
const days_ago = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => resetDatabase());

describe('rhythm', () => {
    it('dayKey renders the local day in the app timezone; shiftDay walks the calendar', () => {
        expect(dayKey('2026-11-03T03:30:00.000Z', 'America/New_York')).toBe('2026-11-02');
        expect(shiftDay('2026-03-01', 1)).toBe('2026-02-28');
    });

    it('typicalGapDays is the rounded median of the newest gaps', () => {
        expect(typicalGapDays([])).toBeNull();
        expect(typicalGapDays([days_ago(0)])).toBeNull();
        expect(typicalGapDays([days_ago(0), days_ago(14), days_ago(21), days_ago(35)])).toBe(14);
    });

    it('streakDays counts back from today, or from yesterday when today is still empty', () => {
        expect(streakDays(['2026-11-03', '2026-11-02', '2026-10-31'], '2026-11-03')).toBe(2);
        expect(streakDays(['2026-11-02', '2026-11-01'], '2026-11-03')).toBe(2);
        expect(streakDays(['2026-10-30'], '2026-11-03')).toBe(0);
    });

    it('wordCount counts whitespace-separated words', () => {
        expect(wordCount('one two\n\nthree')).toBe(3);
    });
});

describe('buildDashboard', () => {
    it('is empty but well-formed with no data', () => {
        const d = buildDashboard(NOW);
        expect(d.sessions).toEqual({ total: 0, axis: [], last: null, typical_gap_days: null });
        expect(d.threads).toEqual([]);
        expect(d.journal).toEqual({ entries_30d: 0, words_7d: 0, streak_days: 0, last_entry: null, themes: [] });
        expect(d.since_last_session).toBeNull();
    });

    it('marks which of the last sessions touched each active problem, oldest session first', () => {
        const s1 = seedSession({ occurred_at: days_ago(30) });
        const s2 = seedSession({ occurred_at: days_ago(16) });
        const s3 = seedSession({ occurred_at: days_ago(2), summary: { title: 'Latest', overview: '', key_points: [], therapist_advice: ['Do the thing'] } });
        seedSession({ occurred_at: days_ago(1), status: 'uploaded', summary: null });
        const a = seedProblem({ title: 'A', last_discussed_at: days_ago(2) });
        const b = seedProblem({ title: 'B', last_discussed_at: days_ago(16) });
        seedProblem({ title: 'Gone', status: 'discarded' });
        seedUpdate(a.id, { session_id: s1.id });
        seedUpdate(a.id, { session_id: s3.id });
        seedUpdate(b.id, { session_id: s2.id });
        seedUpdate(b.id, { source: 'manual' });

        const d = buildDashboard(NOW);
        expect(d.sessions.axis.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id]);
        expect(d.sessions.total).toBe(3);
        expect(d.sessions.last).toMatchObject({ id: s3.id, advice: ['Do the thing'] });
        expect(d.sessions.typical_gap_days).toBe(14);
        expect(d.threads.map((t) => [t.title, t.marks, t.update_count])).toEqual([
            ['A', [true, false, true], 2],
            ['B', [false, true, false], 2],
        ]);
    });

    it('counts journal entries, words, streak, themes and what came after the last session', () => {
        const session = seedSession({ occurred_at: days_ago(5) });
        const racing = seedProblem({ title: 'Racing mind' });
        const perf = seedProblem({ title: 'Perfectionism' });
        const e1 = seedJournal({ occurred_at: days_ago(0), body: 'one two three' });
        const e2 = seedJournal({ occurred_at: days_ago(1), body: 'four five' });
        const old = seedJournal({ occurred_at: days_ago(40), body: 'ancient words here' });
        for (const e of [e1, e2, old]) repo_insights.upsertJournalProblemLink({ entry_id: e.id, problem_id: racing.id, confidence: 0.8, excerpt: 'x' });
        repo_insights.upsertJournalProblemLink({ entry_id: e1.id, problem_id: perf.id, confidence: 0.7, excerpt: 'y' });
        repo_insights.insertJournalInsight({ entry_id: e1.id, body: 'n', kind: 'advice', source: 'margin', problem_id: racing.id });
        repo_insights.insertJournalInsight({ entry_id: old.id, body: 'r', kind: 'reflection', source: 'reflection' });

        const d = buildDashboard(NOW);
        expect(d.journal).toMatchObject({ entries_30d: 2, words_7d: 5, streak_days: 2, last_entry: { id: e1.id } });
        expect(d.journal.themes).toEqual([
            { problem_id: racing.id, title: 'Racing mind', mentions: 2 },
            { problem_id: perf.id, title: 'Perfectionism', mentions: 1 },
        ]);
        expect(d.threads.find((t) => t.id === racing.id)!.journal_mentions).toBe(2);
        expect(d.since_last_session).toEqual({ entries: 2, notes: 1 });
        expect(session.id).toBeGreaterThan(0);
    });
});
