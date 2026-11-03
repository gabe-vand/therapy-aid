import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import { applyProblemUpdates } from '@/services/sessions/apply-problems';
import type { ProblemExtraction } from '@/services/sessions/prompts-map';
import { resetDatabase, seedProblem, seedSession } from '../../helpers/hlp-db';

// What a session does to the problem list: notes, forward-only dates, new problems, resolved
// suggestions, and the guards (unknown id, duplicates) that keep a model slip from corrupting data.

const SEPT_11 = '2026-09-11T16:00:00.000Z';
let warn: ReturnType<typeof spyOn>;

beforeEach(() => {
    resetDatabase();
    warn = spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const extraction = (over: Partial<ProblemExtraction> = {}): ProblemExtraction => ({ problem_updates: [], new_problems: [], ...over });

describe('applyProblemUpdates', () => {
    it('adds an AI note dated at the session and bumps last_discussed_at', () => {
        const session = seedSession({ occurred_at: SEPT_11 });
        const problem = seedProblem({ last_discussed_at: '2026-08-01T16:00:00.000Z' });

        const result = applyProblemUpdates(session, extraction({ problem_updates: [{ problem_id: problem.id, progress_note: 'Slept better.', suggested_status: 'active' }] }));

        expect(result).toEqual({ updated: 1, created: 0, resolved: 0, skipped: 0 });
        const [note] = repo_updates.selectUpdatesForProblem(problem.id);
        expect(note).toMatchObject({ body: 'Slept better.', source: 'ai', session_id: session.id, created_at: SEPT_11 });
        expect(repo_problems.selectProblemById(problem.id)!.last_discussed_at).toBe(SEPT_11);
    });

    it('never moves last_discussed_at backwards (a back-dated session)', () => {
        const session = seedSession({ occurred_at: '2026-06-01T16:00:00.000Z' });
        const problem = seedProblem({ last_discussed_at: '2026-09-01T16:00:00.000Z' });
        applyProblemUpdates(session, extraction({ problem_updates: [{ problem_id: problem.id, progress_note: 'Old news.', suggested_status: 'active' }] }));
        expect(repo_problems.selectProblemById(problem.id)!.last_discussed_at).toBe('2026-09-01T16:00:00.000Z');
        expect(repo_updates.selectUpdatesForProblem(problem.id)).toHaveLength(1);
    });

    it('skips an unknown problem_id with a log line and still applies the rest', () => {
        const session = seedSession();
        const problem = seedProblem();
        const result = applyProblemUpdates(
            session,
            extraction({
                problem_updates: [
                    { problem_id: 99999, progress_note: 'Ghost.', suggested_status: 'active' },
                    { problem_id: problem.id, progress_note: 'Real.', suggested_status: 'active' },
                ],
            }),
        );
        expect(result).toMatchObject({ updated: 1, skipped: 1 });
        expect(warn.mock.calls[0]![0]).toContain('problem_id=99999');
        expect(repo_updates.selectUpdatesForSession(session.id).map((u) => u.body)).toEqual(['Real.']);
    });

    it('skips a discarded problem and a repeated id', () => {
        const session = seedSession();
        const discarded = seedProblem({ status: 'discarded' });
        const problem = seedProblem({ title: 'Other' });
        const result = applyProblemUpdates(
            session,
            extraction({
                problem_updates: [
                    { problem_id: discarded.id, progress_note: 'x', suggested_status: 'active' },
                    { problem_id: problem.id, progress_note: 'first', suggested_status: 'active' },
                    { problem_id: problem.id, progress_note: 'again', suggested_status: 'active' },
                ],
            }),
        );
        expect(result).toMatchObject({ updated: 1, skipped: 2 });
        expect(repo_updates.selectUpdatesForSession(session.id).map((u) => u.body)).toEqual(['first']);
    });

    it('applies a resolved suggestion, and reopens a resolved problem that comes back as active', () => {
        const session = seedSession();
        const closing = seedProblem({ title: 'Closing' });
        const returning = seedProblem({ title: 'Returning', status: 'resolved' });
        const result = applyProblemUpdates(
            session,
            extraction({
                problem_updates: [
                    { problem_id: closing.id, progress_note: 'Done.', suggested_status: 'resolved' },
                    { problem_id: returning.id, progress_note: 'Back again.', suggested_status: 'active' },
                ],
            }),
        );
        expect(result.resolved).toBe(1);
        expect(repo_problems.selectProblemById(closing.id)!.status).toBe('resolved');
        expect(repo_problems.selectProblemById(returning.id)!.status).toBe('active');
    });

    it('creates new problems with the session as origin and a first note', () => {
        const session = seedSession({ occurred_at: SEPT_11 });
        const result = applyProblemUpdates(session, extraction({ new_problems: [{ title: 'Morning structure', description: 'Mornings fall apart.', progress_note: 'Came up today.' }] }));

        expect(result.created).toBe(1);
        const [created] = repo_problems.selectProblemsByStatus(['active']);
        expect(created).toMatchObject({ title: 'Morning structure', description: 'Mornings fall apart.', origin_session_id: session.id, last_discussed_at: SEPT_11 });
        expect(repo_updates.selectUpdatesForSession(session.id)).toEqual([expect.objectContaining({ problem_id: created!.id, body: 'Came up today.', origin_session_id: session.id })]);
    });

    it('turns a "new" problem whose title matches an existing one into a note on it', () => {
        const session = seedSession();
        const existing = seedProblem({ title: 'Racing mind at night' });
        const result = applyProblemUpdates(session, extraction({ new_problems: [{ title: 'racing mind at night!', description: 'd', progress_note: 'More of it.' }] }));
        expect(result).toMatchObject({ created: 0, updated: 1 });
        expect(repo_problems.selectProblemsByStatus(['active'])).toHaveLength(1);
        expect(repo_updates.selectUpdatesForProblem(existing.id)).toHaveLength(1);
    });
});
