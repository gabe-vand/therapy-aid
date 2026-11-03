import { beforeEach, describe, expect, it } from 'bun:test';
import type { ApiEnvelope, Problem, ProblemDetail } from '@therapy-aid/shared';
import { app } from '@/app';
import { resetDatabase, seedProblem, seedUpdate } from '../helpers/hlp-db';

// /problems end to end through the real app (dev-mode auth: every request is dev@local).

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

const ago = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => resetDatabase());

describe('GET /problems', () => {
    it('is empty on a fresh database', async () => {
        const { status, body } = await call<Problem[]>('GET', '/problems');
        expect(status).toBe(200);
        expect(body.data).toEqual([]);
    });

    it('orders active before resolved, hides discarded, and shows them with ?all=1', async () => {
        const resolved = seedProblem({ title: 'Done', status: 'resolved' });
        const active = seedProblem({ title: 'Live' });
        const dropped = seedProblem({ title: 'Dropped', status: 'discarded' });
        expect((await call<Problem[]>('GET', '/problems')).body.data.map((p) => p.id)).toEqual([active.id, resolved.id]);
        expect((await call<Problem[]>('GET', '/problems?all=1')).body.data.map((p) => p.id)).toEqual([active.id, resolved.id, dropped.id]);
    });

    it('counts updates and reports the newest note', async () => {
        const p = seedProblem();
        seedUpdate(p.id, { body: 'older', created_at: ago(5) });
        seedUpdate(p.id, { body: 'a note', created_at: ago(1) });
        const { body } = await call<Problem[]>('GET', '/problems');
        expect(body.data[0]).toMatchObject({ update_count: 2, latest_update: 'a note', is_stale: false });
    });
});

describe('POST /problems', () => {
    it('creates a problem and returns its detail', async () => {
        const { status, body } = await call<ProblemDetail>('POST', '/problems', { title: '  Procrastination ', description: 'Starting is hard.' });
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ title: 'Procrastination', description: 'Starting is hard.', status: 'active', updates: [] });
    });

    it('allows a missing description', async () => {
        const { body } = await call<ProblemDetail>('POST', '/problems', { title: 'Just a title' });
        expect(body.data.description).toBe('');
    });

    it('rejects an empty title, a missing body and bad JSON with 400', async () => {
        for (const payload of [{ title: '   ', description: 'x' }, { description: 'x' }, '{nope']) {
            const { status, body } = await call('POST', '/problems', payload);
            expect(status).toBe(400);
            expect(body.message).toBeTruthy();
        }
        expect((await call<Problem[]>('GET', '/problems')).body.data).toEqual([]);
    });
});

describe('GET /problems/:id', () => {
    it('returns the detail with its timeline', async () => {
        const p = seedProblem();
        seedUpdate(p.id, { body: 'noted' });
        const { status, body } = await call<ProblemDetail>('GET', `/problems/${p.id}`);
        expect(status).toBe(200);
        expect(body.data.updates).toHaveLength(1);
        expect(body.data.updates[0]).toMatchObject({ body: 'noted', source: 'ai', session_title: null });
    });

    it('404s for a missing or malformed id', async () => {
        expect((await call('GET', '/problems/999')).status).toBe(404);
        expect((await call('GET', '/problems/abc')).status).toBe(404);
    });
});

describe('PATCH /problems/:id', () => {
    it('edits title, description and status', async () => {
        const p = seedProblem();
        const { status, body } = await call<ProblemDetail>('PATCH', `/problems/${p.id}`, { title: 'New title', status: 'resolved' });
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ title: 'New title', status: 'resolved', description: p.description });
    });

    it('rejects a bad status, an empty title and a wrong type with 400, changing nothing', async () => {
        const p = seedProblem();
        for (const payload of [{ status: 'done' }, { title: '' }, { description: 5 }, 'nope']) {
            const { status, body } = await call('PATCH', `/problems/${p.id}`, payload);
            expect(status).toBe(400);
            expect(body.message).toBeTruthy();
        }
        expect((await call<ProblemDetail>('GET', `/problems/${p.id}`)).body.data).toMatchObject({ title: p.title, status: 'active' });
    });

    it('names the offending field in the message', async () => {
        const p = seedProblem();
        const { body } = await call('PATCH', `/problems/${p.id}`, { status: 'done' });
        expect(body.message).toContain('status');
    });

    it('404s for a missing problem', async () => {
        expect((await call('PATCH', '/problems/999', { title: 'x' })).status).toBe(404);
    });
});

describe('POST /problems/:id/updates', () => {
    it('adds a manual note and bumps last_discussed_at', async () => {
        const p = seedProblem({ last_discussed_at: ago(40) });
        const { status, body } = await call<ProblemDetail>('POST', `/problems/${p.id}/updates`, { body: 'Tried it, it helped.' });
        expect(status).toBe(200);
        expect(body.data.updates[0]).toMatchObject({ source: 'manual', body: 'Tried it, it helped.', session_id: null });
        expect(Date.parse(body.data.last_discussed_at!)).toBeGreaterThan(Date.parse(p.last_discussed_at!));
    });

    it('rejects a blank note with 400 and a missing problem with 404', async () => {
        const p = seedProblem();
        expect((await call('POST', `/problems/${p.id}/updates`, { body: '  ' })).status).toBe(400);
        expect((await call('POST', '/problems/999/updates', { body: 'x' })).status).toBe(404);
    });
});

describe('POST /problems/:id/keep', () => {
    it('stamps last_reviewed_at without adding a note', async () => {
        const p = seedProblem();
        const { status, body } = await call<ProblemDetail>('POST', `/problems/${p.id}/keep`);
        expect(status).toBe(200);
        expect(body.data.last_reviewed_at).not.toBeNull();
        expect(body.data.updates).toEqual([]);
    });

    it('404s for a missing problem', async () => {
        expect((await call('POST', '/problems/999/keep')).status).toBe(404);
    });
});
