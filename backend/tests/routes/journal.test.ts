import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, JournalEntry, JournalInsight } from '@therapy-aid/shared';
import { app } from '@/app';
import * as svc_claude from '@/services/common/svc-claude';
import { resetDatabase, seedJournal } from '../helpers/hlp-db';

// /journal end to end through the real app (dev-mode auth), AI stubbed.

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

beforeEach(() => resetDatabase());

describe('entries', () => {
    it('POST creates, GET lists newest first with insight_count, GET/:id reads', async () => {
        const created = await call<JournalEntry>('POST', '/journal', { occurred_at: '2026-10-01T12:00:00.000Z', body: 'older' });
        expect(created.status).toBe(200);
        const newer = await call<JournalEntry>('POST', '/journal', { occurred_at: '2026-10-09', body: 'newer' });
        expect(newer.body.data.occurred_at).toStartWith('2026-10-09');

        const list = await call<JournalEntry[]>('GET', '/journal');
        expect(list.body.data.map((e) => e.body)).toEqual(['newer', 'older']);
        expect(list.body.data[0]).toHaveProperty('insight_count', 0);
        expect((await call<JournalEntry>('GET', `/journal/${created.body.data.id}`)).body.data.body).toBe('older');
    });

    it('POST without occurred_at defaults to now; an empty body is allowed', async () => {
        const { status, body } = await call<JournalEntry>('POST', '/journal', { body: '' });
        expect(status).toBe(200);
        expect(Number.isNaN(new Date(body.data.occurred_at).getTime())).toBe(false);
    });

    it('PATCH updates body and date independently', async () => {
        const row = seedJournal({ body: 'before' });
        const body_only = await call<JournalEntry>('PATCH', `/journal/${row.id}`, { body: 'after' });
        expect(body_only.body.data).toMatchObject({ body: 'after', occurred_at: row.occurred_at });
        const date_only = await call<JournalEntry>('PATCH', `/journal/${row.id}`, { occurred_at: '2026-01-02T12:00:00.000Z' });
        expect(date_only.body.data).toMatchObject({ body: 'after', occurred_at: '2026-01-02T12:00:00.000Z' });
    });

    it('DELETE removes the entry', async () => {
        const row = seedJournal();
        expect((await call('DELETE', `/journal/${row.id}`)).status).toBe(200);
        expect((await call('GET', `/journal/${row.id}`)).status).toBe(404);
    });

    it('answers 404 for a missing or malformed id', async () => {
        for (const [method, path] of [
            ['GET', '/journal/999'],
            ['PATCH', '/journal/999'],
            ['DELETE', '/journal/999'],
            ['GET', '/journal/999/insights'],
            ['GET', '/journal/abc'],
        ] as const) {
            const { status, body } = await call(method, path, method === 'PATCH' ? { body: 'x' } : undefined);
            expect([method, path, status]).toEqual([method, path, 404]);
            expect(body.status_code).toBe(404);
        }
    });

    it('answers 400 VALIDATION with a readable message for bad bodies', async () => {
        const row = seedJournal();
        const cases: [string, string, unknown][] = [
            ['POST', '/journal', { occurred_at: 'not a date', body: 'x' }],
            ['POST', '/journal', { body: 42 }],
            ['POST', '/journal', {}],
            ['POST', '/journal', 'not json'],
            ['PATCH', `/journal/${row.id}`, { occurred_at: 'yesterday-ish' }],
            ['PATCH', `/journal/${row.id}`, { body: 5 }],
        ];
        for (const [method, path, payload] of cases) {
            const { status, body } = await call(method, path, payload);
            expect([method, path, status]).toEqual([method, path, 400]);
            expect(body.message.length).toBeGreaterThan(0);
        }
        expect((await call('POST', '/journal', { occurred_at: 'not a date', body: 'x' })).body.message).toContain('occurred_at');
    });
});

describe('insights', () => {
    let structured: ReturnType<typeof spyOn>;
    let quiet: ReturnType<typeof spyOn>;
    beforeEach(() => {
        structured = spyOn(svc_claude, 'completeStructured').mockResolvedValue({ body: 'A grounded note.' } as never);
        quiet = spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        structured.mockRestore();
        quiet.mockRestore();
    });

    it('POST saves the draft, returns the insight, and GET lists the history', async () => {
        const row = seedJournal({ body: 'old' });
        const made = await call<JournalInsight>('POST', `/journal/${row.id}/insights`, { body: 'The current draft' });
        expect(made.status).toBe(200);
        expect(made.body.data).toMatchObject({ entry_id: row.id, body: 'A grounded note.' });

        expect((await call<JournalEntry>('GET', `/journal/${row.id}`)).body.data).toMatchObject({ body: 'The current draft', insight_count: 1 });
        const history = await call<JournalInsight[]>('GET', `/journal/${row.id}/insights`);
        expect(history.body.data.map((i) => i.body)).toEqual(['A grounded note.']);
    });

    it('rejects a blank draft with 400 and generates nothing', async () => {
        const row = seedJournal();
        const { status } = await call('POST', `/journal/${row.id}/insights`, { body: '   ' });
        expect(status).toBe(400);
        expect(structured).not.toHaveBeenCalled();
    });

    it('404s for a missing entry without calling the model', async () => {
        expect((await call('POST', '/journal/999/insights', { body: 'draft' })).status).toBe(404);
        expect(structured).not.toHaveBeenCalled();
    });

    it('surfaces an AI failure with its readable message, and the draft stays saved', async () => {
        structured.mockRejectedValue(new svc_claude.AiRefusalError());
        const row = seedJournal({ body: 'old' });
        const { status, body } = await call('POST', `/journal/${row.id}/insights`, { body: 'keep me' });
        expect(status).toBe(500);
        expect(body.message).toBe('The AI model declined to answer this request.');
        expect((await call<JournalEntry>('GET', `/journal/${row.id}`)).body.data.body).toBe('keep me');
    });

    it('hides unexpected error details behind a generic message', async () => {
        structured.mockRejectedValue(new Error('secret internals: sk-ant-123'));
        const row = seedJournal();
        const { body } = await call('POST', `/journal/${row.id}/insights`, { body: 'draft' });
        expect(body.message).not.toContain('sk-ant');
        expect(body.message).toContain('Your draft is saved');
    });

    it('is not generated by any other call', async () => {
        const row = seedJournal();
        await call('POST', '/journal', { body: 'new' });
        await call('PATCH', `/journal/${row.id}`, { body: 'edit' });
        await call('GET', `/journal/${row.id}`);
        expect(structured).not.toHaveBeenCalled();
    });
});
