import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import { resetDatabase, seedProblem, seedSession, seedUpdate } from '../helpers/hlp-db';

beforeEach(() => resetDatabase());

describe('problems repository', () => {
    it('inserts active by default and reads back', () => {
        const p = repo_problems.insertProblem({ title: 'Sleep', description: 'Late nights' });
        expect(p).toMatchObject({ title: 'Sleep', status: 'active', last_discussed_at: null, origin_session_id: null });
        expect(repo_problems.selectProblemById(p.id)).toEqual(p);
        expect(repo_problems.selectProblemById(9999)).toBeNull();
    });

    it('selects by status in id order and updates with updated_at', () => {
        const a = seedProblem({ title: 'A' });
        const b = seedProblem({ title: 'B', status: 'resolved' });
        seedProblem({ title: 'C', status: 'discarded' });
        expect(repo_problems.selectProblemsByStatus(['active', 'resolved']).map((p) => p.id)).toEqual([a.id, b.id]);
        expect(repo_problems.updateProblem(a.id, { status: 'resolved', last_reviewed_at: '2026-10-01T00:00:00.000Z' })).toMatchObject({ status: 'resolved', last_reviewed_at: '2026-10-01T00:00:00.000Z' });
        expect(repo_problems.updateProblem(9999, { title: 'x' })).toBeNull();
    });
});

describe('problem_updates repository', () => {
    it('lists a problem’s notes newest first with the session title, limited', () => {
        const s = seedSession({ title: 'The Sept session' });
        const p = seedProblem();
        seedUpdate(p.id, { body: 'old', created_at: '2026-01-01T00:00:00.000Z' });
        seedUpdate(p.id, { body: 'new', session_id: s.id, created_at: '2026-02-01T00:00:00.000Z' });
        const notes = repo_updates.selectUpdatesForProblem(p.id);
        expect(notes.map((n) => [n.body, n.session_title])).toEqual([
            ['new', 'The Sept session'],
            ['old', null],
        ]);
        expect(repo_updates.selectUpdatesForProblem(p.id, 1)).toHaveLength(1);
    });

    it('lists what a session did to problems, with the origin to tell new from updated', () => {
        const s = seedSession();
        const existing = seedProblem({ title: 'Existing' });
        const opened = seedProblem({ title: 'Opened', origin_session_id: s.id });
        seedUpdate(existing.id, { session_id: s.id, body: 'progress' });
        seedUpdate(opened.id, { session_id: s.id, body: 'why it matters' });
        expect(repo_updates.selectUpdatesForSession(s.id).map((u) => [u.problem_title, u.origin_session_id === s.id])).toEqual([
            ['Existing', false],
            ['Opened', true],
        ]);
    });

    it('reports per-problem counts and latest time; deletes a session’s notes', () => {
        const s = seedSession();
        const p = seedProblem();
        seedUpdate(p.id, { created_at: '2026-01-01T00:00:00.000Z' });
        seedUpdate(p.id, { session_id: s.id, created_at: '2026-03-01T00:00:00.000Z' });
        expect(repo_updates.selectUpdateStats()).toEqual([{ problem_id: p.id, update_count: 2, latest_at: '2026-03-01T00:00:00.000Z' }]);
        repo_updates.deleteUpdatesForSession(s.id);
        expect(repo_updates.selectUpdatesForProblem(p.id)).toHaveLength(1);
    });

    it('rejects a note on an unknown problem id (foreign key)', () => {
        expect(() => repo_updates.insertProblemUpdate({ problem_id: 9999, body: 'x', source: 'ai' })).toThrow();
    });
});
