import { describe, expect, it } from 'bun:test';
import { applyExtraction } from '../../../scripts/lib/eval-apply';
import { contextPack, createWorld, problemMappingContext, readySessions, setSummary, summarizationContext, type Summary } from '../../../scripts/lib/eval-world';

// The model eval's in-memory world: it must hand each model the same prompts the app would build,
// and evolve the problem list the way apply-problems does. Synthetic data only — the real seed
// files are personal and never reach a test.

const seed = {
    profile: 'Gabe, 21, student.',
    notes: [
        { date: '2026-08-06', body: 'First session notes.' },
        { date: '2026-08-14', body: 'Second session notes.' },
        { date: '2026-08-21', body: 'Third session notes.' },
    ],
    journal: [
        { date: '2026-08-10', body: 'Older entry.' },
        { date: '2026-10-13', body: 'Newest entry.' },
    ],
};

const summary = (title: string): Summary => ({ title, overview: `${title} overview.`, key_points: [`${title} point`], therapist_advice: [`${title} advice`] });

describe('createWorld', () => {
    it('makes one pending session per note (ids oldest first) and one row per journal entry', () => {
        const world = createWorld(seed);
        expect(world.sessions.map((s) => [s.id, s.summary_json])).toEqual([
            [1, null],
            [2, null],
            [3, null],
        ]);
        expect(world.journal.map((e) => e.body)).toEqual(['Older entry.', 'Newest entry.']);
        expect(readySessions(world)).toEqual([]);
    });
});

describe('contexts', () => {
    it('summarization context shows only earlier ready sessions, newest first, never the session itself', () => {
        const world = createWorld(seed);
        setSummary(world, 1, summary('Racing mind'));
        setSummary(world, 2, summary('Nicole'));
        const third = summarizationContext(world, world.sessions[2]!);
        expect(third).toContain('# About Gabe\n\nGabe, 21, student.');
        expect(third.indexOf('Nicole')).toBeLessThan(third.indexOf('Racing mind'));
        const first = summarizationContext(world, world.sessions[0]!);
        expect(first).toContain('(No earlier sessions.)');
        expect(first).not.toContain('Racing mind overview');
    });

    it('the context pack is deterministic and carries every section in order', () => {
        const world = createWorld(seed);
        setSummary(world, 1, summary('Racing mind'));
        const pack = contextPack(world);
        expect(contextPack(world)).toBe(pack);
        const order = ['# About Gabe', '# Current focus', '# Problems', '# Therapy sessions', '# Recent journal entries'].map((h) => pack.indexOf(h));
        expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true);
        expect(pack.indexOf('Newest entry.')).toBeLessThan(pack.indexOf('Older entry.'));
    });
});

describe('applyExtraction', () => {
    it('opens new problems, then maps later sessions onto them by id', () => {
        const world = createWorld(seed);
        setSummary(world, 1, summary('One'));
        const first = applyExtraction(world, world.sessions[0]!, { problem_updates: [], new_problems: [{ title: 'Racing mind', description: 'Mind races at night.', progress_note: 'Came up first.' }] });
        expect(first).toEqual({ updated: 0, created: 1, resolved: 0, skipped: 0 });
        expect(problemMappingContext(world)).toContain('[problem #1] (active) Racing mind');

        const second = applyExtraction(world, world.sessions[1]!, {
            problem_updates: [
                { problem_id: 1, progress_note: 'Better this week.', suggested_status: 'resolved' },
                { problem_id: 42, progress_note: 'Invented id.', suggested_status: 'active' },
            ],
            new_problems: [],
        });
        expect(second).toEqual({ updated: 1, created: 0, resolved: 1, skipped: 1 });
        expect(world.problems[0]!.status).toBe('resolved');
        expect(world.problems[0]!.last_discussed_at).toBe(world.sessions[1]!.occurred_at);
    });

    it('turns a "new" problem with an existing title into an update, and re-applying replaces', () => {
        const world = createWorld(seed);
        applyExtraction(world, world.sessions[0]!, { problem_updates: [], new_problems: [{ title: 'Racing mind', description: 'd', progress_note: 'first' }] });
        const dup = { problem_updates: [], new_problems: [{ title: 'racing  MIND!', description: 'd', progress_note: 'again' }] };
        expect(applyExtraction(world, world.sessions[1]!, dup)).toEqual({ updated: 1, created: 0, resolved: 0, skipped: 0 });
        applyExtraction(world, world.sessions[1]!, dup);
        expect(world.problems).toHaveLength(1);
        expect(world.updates.map((u) => [u.session_id, u.body])).toEqual([
            [1, 'first'],
            [2, 'again'],
        ]);
    });
});
