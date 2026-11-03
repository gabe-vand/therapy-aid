import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { resetDatabase, seedProblem, seedSession, seedUpdate } from '../helpers/hlp-db';

beforeEach(() => resetDatabase());

describe('sessions repository', () => {
    it('inserts with timestamps and reads back by id', () => {
        const row = repo_sessions.insertSession({ occurred_at: '2026-09-11T16:00:00.000Z', source: 'recording', status: 'recording', audio_mime: 'audio/webm' });
        expect(row.id).toBeGreaterThan(0);
        expect(row.created_at).toBe(row.updated_at);
        expect(repo_sessions.selectSessionById(row.id)).toEqual(row);
        expect(repo_sessions.selectSessionById(9999)).toBeNull();
    });

    it('rejects an unknown status (CHECK constraint)', () => {
        expect(() => repo_sessions.insertSession({ occurred_at: 'x', source: 'notes', status: 'bogus' as 'ready' })).toThrow();
    });

    it('lists newest occurred_at first, ties newest id first', () => {
        const a = seedSession({ occurred_at: '2026-01-01T00:00:00.000Z' });
        const b = seedSession({ occurred_at: '2026-02-01T00:00:00.000Z' });
        const c = seedSession({ occurred_at: '2026-02-01T00:00:00.000Z' });
        expect(repo_sessions.selectSessionList().map((s) => s.id)).toEqual([c.id, b.id, a.id]);
        expect(Object.keys(repo_sessions.selectSessionList()[0]!).sort()).toEqual(['created_at', 'id', 'occurred_at', 'source', 'status', 'title']);
        expect(repo_sessions.selectAllSessions().map((s) => s.id)).toEqual([a.id, b.id, c.id]);
    });

    it('selects ready summaries with limit / before / exclude', () => {
        const a = seedSession({ occurred_at: '2026-01-01T00:00:00.000Z' });
        const b = seedSession({ occurred_at: '2026-02-01T00:00:00.000Z' });
        seedSession({ occurred_at: '2026-03-01T00:00:00.000Z', status: 'failed' });
        const d = seedSession({ occurred_at: '2026-04-01T00:00:00.000Z' });
        expect(repo_sessions.selectReadySessionSummaries().map((s) => s.id)).toEqual([d.id, b.id, a.id]);
        expect(repo_sessions.selectReadySessionSummaries({ limit: 1 }).map((s) => s.id)).toEqual([d.id]);
        expect(repo_sessions.selectReadySessionSummaries({ before: '2026-04-01T00:00:00.000Z' }).map((s) => s.id)).toEqual([b.id, a.id]);
        expect(repo_sessions.selectReadySessionSummaries({ exclude_id: b.id }).map((s) => s.id)).toEqual([d.id, a.id]);
    });

    it('selects by status, oldest first', () => {
        const a = seedSession({ status: 'transcribing' });
        seedSession({ status: 'ready' });
        const c = seedSession({ status: 'uploaded' });
        expect(repo_sessions.selectSessionsByStatus(['uploaded', 'transcribing']).map((s) => s.id)).toEqual([a.id, c.id]);
    });

    it('updates a patch and bumps updated_at; null for a missing id', async () => {
        const row = seedSession({ status: 'uploaded' });
        await Bun.sleep(2);
        const updated = repo_sessions.updateSession(row.id, { status: 'failed', error: 'boom' })!;
        expect(updated).toMatchObject({ status: 'failed', error: 'boom', notes: row.notes });
        expect(updated.updated_at > row.updated_at).toBe(true);
        expect(repo_sessions.updateSession(9999, { title: 'x' })).toBeNull();
    });

    it('deletes, nulling the session on problem updates and problem origin (FK set null)', () => {
        const s = seedSession();
        const p = seedProblem({ origin_session_id: s.id });
        seedUpdate(p.id, { session_id: s.id });
        repo_sessions.deleteSession(s.id);
        expect(repo_sessions.selectSessionById(s.id)).toBeNull();
        expect(repo_problems.selectProblemById(p.id)!.origin_session_id).toBeNull();
        expect(repo_updates.selectUpdatesForProblem(p.id).map((u) => u.session_id)).toEqual([null]);
    });
});
