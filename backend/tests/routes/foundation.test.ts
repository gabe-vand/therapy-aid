import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { AiUsage, ApiEnvelope, Me, Profile } from '@therapy-aid/shared';
import { app } from '@/app';
import { recordUsage, resetAiUsage } from '@/services/common/svc-claude-usage';
import { resetDatabase } from '../helpers/hlp-db';

// The routes FOUNDATION owns — /me, /ai/usage, /settings/profile — end to end through the real
// app (dev-mode auth: every request is dev@local), plus the mount table for the stub routers.

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

beforeEach(() => {
    resetDatabase();
    resetAiUsage();
});

describe('GET /me', () => {
    it('answers the login md-auth accepted', async () => {
        const { status, body } = await call<Me>('GET', '/me');
        expect(status).toBe(200);
        expect(body.data).toEqual({ login: 'dev@local' });
    });
});

describe('GET /ai/usage', () => {
    let log: ReturnType<typeof spyOn>;
    beforeEach(() => {
        log = spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => log.mockRestore());

    it('reports every task’s route and the spend recorded so far', async () => {
        recordUsage('summarize', 'claude-sonnet-5-5', 'high', { input_tokens: 2000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as never);
        const { status, body } = await call<AiUsage>('GET', '/ai/usage');
        expect(status).toBe(200);
        expect(body.data.rows).toHaveLength(8);
        expect(body.data.rows[0]).toMatchObject({ task: 'summarize', model: 'claude-sonnet-5-5', effort: 'high', calls: 1, input_tokens: 2000 });
        expect(body.data.total_usd).toBeCloseTo(0.009, 9);
        expect(body.data.configured).toBe(false);
    });
});

describe('/settings/profile', () => {
    it('GET is empty before the first save', async () => {
        expect((await call<Profile>('GET', '/settings/profile')).body.data).toEqual({ profile: '', updated_at: null });
    });

    it('PUT saves and GET returns it', async () => {
        const put = await call<Profile>('PUT', '/settings/profile', { profile: 'I study CS at Queen’s.' });
        expect(put.status).toBe(200);
        expect(put.body.data.profile).toBe('I study CS at Queen’s.');
        expect((await call<Profile>('GET', '/settings/profile')).body.data.profile).toBe('I study CS at Queen’s.');
    });

    it('PUT rejects a bad body with 400 and a readable message', async () => {
        for (const body of [{ profile: 5 }, {}, 'not json', { profile: 'x'.repeat(50_001) }]) {
            const res = await call('PUT', '/settings/profile', body);
            expect(res.status).toBe(400);
            expect(res.body.status_code).toBe(400);
            expect(res.body.message.length).toBeGreaterThan(5);
        }
    });
});

describe('mount table', () => {
    it('mounts every SPEC §6 module (stubs answer 404 in the envelope until implemented)', async () => {
        for (const path of ['/sessions', '/problems', '/focus', '/journal', '/chat/threads']) {
            const { status, body } = await call('GET', path);
            expect([200, 404]).toContain(status);
            expect(body).toHaveProperty('status_code');
        }
    });
});
