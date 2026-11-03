import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_problems from '@/repositories/problems';
import { createProblem, listProblems } from '@/services/problems/problems';
import { applyProblemUpdates } from '@/services/sessions/apply-problems';
import { resetDatabase, seedSession } from '../../helpers/hlp-db';

// Backfilled sessions: a problem the AI opens is born at the session's date, so staleness counts
// from when it was last discussed rather than from when the notes were imported.

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number): string => new Date(Date.now() - days * DAY).toISOString();
const open = (title: string) => ({ problem_updates: [], new_problems: [{ title, description: 'd', progress_note: 'Came up.' }] });

beforeEach(() => resetDatabase());

describe('problems opened from a backfilled session', () => {
    it('are born at the session date and read as stale when that session is 90 days old', () => {
        const occurred_at = ago(90);
        applyProblemUpdates(seedSession({ occurred_at }), open('Old worry'));

        const [created] = repo_problems.selectProblemsByStatus(['active']);
        expect(created).toMatchObject({ created_at: occurred_at, last_discussed_at: occurred_at });
        expect(listProblems().find((p) => p.id === created!.id)!.is_stale).toBe(true);
    });

    it('are fresh when the session is recent', () => {
        applyProblemUpdates(seedSession({ occurred_at: ago(5) }), open('Recent worry'));
        expect(listProblems()[0]!.is_stale).toBe(false);
    });

    it('never move created_at when a later or earlier session touches an existing problem', () => {
        const first = ago(90);
        applyProblemUpdates(seedSession({ occurred_at: first }), open('Recurring'));
        const created = repo_problems.selectProblemsByStatus(['active'])[0]!;
        const update = (occurred_at: string) => applyProblemUpdates(seedSession({ occurred_at }), { problem_updates: [{ problem_id: created.id, progress_note: 'Again.', suggested_status: 'active' }], new_problems: [] });

        const recent = ago(10);
        update(recent);
        update(ago(200));

        const after = repo_problems.selectProblemById(created.id)!;
        expect(after.created_at).toBe(first);
        expect(after.last_discussed_at).toBe(recent);
        expect(listProblems()[0]!.is_stale).toBe(false);
    });
});

describe('manually created problems', () => {
    it('keep created_at = now and are not stale', () => {
        const before = Date.now();
        const problem = createProblem({ title: 'By hand', description: 'd' });
        expect(Date.parse(problem.created_at)).toBeGreaterThanOrEqual(before);
        expect(problem.is_stale).toBe(false);
    });
});
