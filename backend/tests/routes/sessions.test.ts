import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, Session, SessionListItem } from '@therapy-aid/shared';
import { app } from '@/app';
import * as repo_sessions from '@/repositories/sessions';
import { pipelineIdle } from '@/services/sessions/pipeline';
import { resetDatabase, seedProblem, seedSession, seedUpdate, summary as seeded_summary } from '../helpers/hlp-db';
import { clearRecordings, stubClaude, stubFocus, SUMMARY } from '../services/sessions/fixtures';

// /sessions through the real app (dev-mode auth): list, read, notes intake, edit, retry, delete,
// with Claude and the focus refresh stubbed.

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

let spies: { mockRestore: () => void }[] = [];
beforeEach(() => {
    resetDatabase();
    clearRecordings();
    spies = [stubClaude(), stubFocus(), spyOn(console, 'log').mockImplementation(() => {}), spyOn(console, 'error').mockImplementation(() => {})];
});
afterEach(async () => {
    await pipelineIdle();
    for (const s of spies) s.mockRestore();
});

describe('GET /sessions', () => {
    it('lists sessions newest first', async () => {
        seedSession({ occurred_at: '2026-09-04T16:00:00.000Z', title: 'Older' });
        seedSession({ occurred_at: '2026-09-11T16:00:00.000Z', title: 'Newer' });
        const { status, body } = await call<SessionListItem[]>('GET', '/sessions');
        expect(status).toBe(200);
        expect(body.data!.map((s) => s.title)).toEqual(['Newer', 'Older']);
        expect(body.data![0]).not.toHaveProperty('notes');
    });
});

describe('GET /sessions/:id', () => {
    it('returns the full session with the summary and what it did to problems', async () => {
        const session = seedSession();
        const existing = seedProblem({ title: 'Racing mind at night' });
        const opened = seedProblem({ title: 'Morning structure', origin_session_id: session.id });
        seedUpdate(existing.id, { session_id: session.id, body: 'Worse this week.' });
        seedUpdate(opened.id, { session_id: session.id, body: 'First time it came up.' });
        seedUpdate(existing.id, { body: 'A different session’s note.', session_id: null });

        const { status, body } = await call<Session>('GET', `/sessions/${session.id}`);

        expect(status).toBe(200);
        expect(body.data!.summary).toEqual(seeded_summary());
        expect(body.data!.notes).toBe('Raw notes from the session.');
        expect(body.data!.problem_updates).toEqual([
            { problem_id: existing.id, problem_title: 'Racing mind at night', body: 'Worse this week.', is_new_problem: false },
            { problem_id: opened.id, problem_title: 'Morning structure', body: 'First time it came up.', is_new_problem: true },
        ]);
    });

    it('404s for a missing or malformed id', async () => {
        expect((await call('GET', '/sessions/9999')).status).toBe(404);
        expect((await call('GET', '/sessions/abc')).status).toBe(404);
    });
});

describe('POST /sessions/notes', () => {
    it('creates the session, starts processing in the background and ends ready', async () => {
        const { status, body } = await call<Session>('POST', '/sessions/notes', { occurred_at: '2026-09-11T12:00:00', notes: '  We talked about sleep.  ', title: ' Week 3 ' });

        expect(status).toBe(200);
        expect(body.data).toMatchObject({ source: 'notes', status: 'uploaded', title: 'Week 3', notes: 'We talked about sleep.' });
        expect(body.data!.occurred_at).toMatch(/^2026-09-11T.*Z$/);

        await pipelineIdle();
        const done = await call<Session>('GET', `/sessions/${body.data!.id}`);
        expect(done.body.data).toMatchObject({ status: 'ready', title: 'Week 3', summary: SUMMARY });
    });

    it('defaults the date to now and accepts an empty title', async () => {
        const { body } = await call<Session>('POST', '/sessions/notes', { notes: 'Notes.', title: null });
        expect(Math.abs(Date.parse(body.data!.occurred_at) - Date.now())).toBeLessThan(5000);
    });

    it('rejects empty notes, a bad date and a body that is not JSON with a readable 400', async () => {
        const empty = await call('POST', '/sessions/notes', { occurred_at: '2026-09-11T12:00:00', notes: '   ' });
        expect(empty.status).toBe(400);
        expect(empty.body.message).toContain('notes');
        expect((await call('POST', '/sessions/notes', { occurred_at: 'not a date', notes: 'x' })).body.message).toContain('occurred_at');
        expect((await call('POST', '/sessions/notes', 'nope')).status).toBe(400);
    });
});

describe('PATCH /sessions/:id', () => {
    it('edits the date and title and keeps the search index current', async () => {
        const session = seedSession();
        const { status, body } = await call<Session>('PATCH', `/sessions/${session.id}`, { occurred_at: '2026-08-01T12:00:00.000Z', title: 'Renamed' });
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ occurred_at: '2026-08-01T12:00:00.000Z', title: 'Renamed' });
    });

    it('a blank title falls back to the summary title; an empty body and unknown id are refused', async () => {
        const session = seedSession({ title: 'Custom' });
        const blank = await call<Session>('PATCH', `/sessions/${session.id}`, { title: '  ' });
        expect(blank.body.data!.title).toBe(seeded_summary().title);
        expect((await call('PATCH', `/sessions/${session.id}`, {})).status).toBe(400);
        expect((await call('PATCH', '/sessions/9999', { title: 'x' })).status).toBe(404);
    });
});

describe('POST /sessions/:id/retry', () => {
    it('re-runs a failed session', async () => {
        const session = seedSession({ status: 'failed', summary: null, notes: 'Notes to summarize.' });
        repo_sessions.updateSession(session.id, { error: 'The AI model declined to answer this request.' });

        const { status, body } = await call<Session>('POST', `/sessions/${session.id}/retry`);
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ status: 'uploaded', error: null });

        await pipelineIdle();
        expect(repo_sessions.selectSessionById(session.id)!.status).toBe('ready');
    });

    it('409s when the session is not failed and 404s when it does not exist', async () => {
        const session = seedSession();
        expect((await call('POST', `/sessions/${session.id}/retry`)).status).toBe(409);
        expect((await call('POST', '/sessions/9999/retry')).status).toBe(404);
    });
});

describe('DELETE /sessions/:id', () => {
    it('deletes the session but keeps its problem notes, with session_id nulled', async () => {
        const session = seedSession();
        const problem = seedProblem();
        seedUpdate(problem.id, { session_id: session.id });

        const { status } = await call('DELETE', `/sessions/${session.id}`);

        expect(status).toBe(200);
        expect(repo_sessions.selectSessionById(session.id)).toBeNull();
        const detail = await call('GET', `/sessions/${session.id}`);
        expect(detail.status).toBe(404);
        const { selectUpdatesForProblem } = await import('@/repositories/problem-updates');
        expect(selectUpdatesForProblem(problem.id)).toHaveLength(1);
        expect(selectUpdatesForProblem(problem.id)[0]!.session_id).toBeNull();
    });

    it('404s for an unknown session', async () => {
        expect((await call('DELETE', '/sessions/9999')).status).toBe(404);
    });
});
