import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, FocusSnapshot } from '@therapy-aid/shared';
import { app } from '@/app';
import * as svc_claude from '@/services/common/svc-claude';
import { resetDatabase, seedFocus } from '../helpers/hlp-db';

// /focus end to end through the real app (dev-mode auth), Claude stubbed with spyOn.

const call = async <T>(method: string, path: string): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const res = await app.request(path, { method });
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

let claude: ReturnType<typeof spyOn>;
let log: ReturnType<typeof spyOn>;
beforeEach(() => {
    resetDatabase();
    log = spyOn(console, 'error').mockImplementation(() => {});
    claude = spyOn(svc_claude, 'completeStructured').mockResolvedValue({
        headline: 'Keep the evening routine.',
        items: [{ title: 'Evening routine', why: 'David suggested it on Sept 11.', action: 'Write the worry list tonight.', problem_id: null }],
    });
});
afterEach(() => {
    claude.mockRestore();
    log.mockRestore();
});

describe('GET /focus', () => {
    it('answers 200 with null before the first snapshot', async () => {
        const { status, body } = await call<FocusSnapshot | null>('GET', '/focus');
        expect(status).toBe(200);
        expect(body.data).toBeNull();
    });

    it('answers the latest snapshot', async () => {
        seedFocus({ headline: 'Older', items: [] });
        seedFocus({ headline: 'Newest', items: [{ title: 'T', why: 'W', action: 'A', problem_id: null }] });
        const { body } = await call<FocusSnapshot>('GET', '/focus');
        expect(body.data).toMatchObject({ headline: 'Newest', session_id: null, items: [{ title: 'T', problem_id: null }] });
        expect(typeof body.data.id).toBe('number');
        expect(typeof body.data.created_at).toBe('string');
    });
});

describe('POST /focus/regenerate', () => {
    it('generates, stores and returns a snapshot that GET then serves', async () => {
        const { status, body } = await call<FocusSnapshot>('POST', '/focus/regenerate');
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ headline: 'Keep the evening routine.', session_id: null });
        expect(body.data.items).toHaveLength(1);
        expect((await call<FocusSnapshot>('GET', '/focus')).body.data.id).toBe(body.data.id);
        expect((claude.mock.calls[0]![0] as { task: string }).task).toBe('focus');
    });

    it('answers 500 with the human-readable reason when AI is not configured, storing nothing', async () => {
        claude.mockRejectedValue(new svc_claude.AiNotConfiguredError());
        const { status, body } = await call('POST', '/focus/regenerate');
        expect(status).toBe(500);
        expect(body.message).toContain('ANTHROPIC_API_KEY');
        expect((await call<FocusSnapshot | null>('GET', '/focus')).body.data).toBeNull();
    });

    it('does not leak internal errors', async () => {
        claude.mockRejectedValue(new Error('socket hang up at 10.0.0.5'));
        const { status, body } = await call('POST', '/focus/regenerate');
        expect(status).toBe(500);
        expect(body.message).not.toContain('10.0.0.5');
    });
});
