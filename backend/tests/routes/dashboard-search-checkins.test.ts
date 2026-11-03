import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, Dashboard, FocusSnapshot, JournalInsight, MarginNoteResult, SearchResult } from '@therapy-aid/shared';
import { app } from '@/app';
import * as repo_insights from '@/repositories/journal-insights';
import * as svc_claude from '@/services/common/svc-claude';
import { rebuildSearchIndex } from '@/services/search/search';
import { resetDatabase, seedFocus, seedJournal, seedProblem, seedSession } from '../helpers/hlp-db';

// The endpoints added for the dashboard, the command palette, focus check-ins and margin notes,
// end to end through the real app (dev-mode auth).

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (body !== undefined) init.headers = { 'Content-Type': 'application/json' };
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

beforeEach(() => resetDatabase());

describe('GET /dashboard', () => {
    it('answers the computed dashboard', async () => {
        seedSession();
        const { status, body } = await call<Dashboard>('GET', '/dashboard');
        expect(status).toBe(200);
        expect(body.data.sessions.total).toBe(1);
        expect(body.data.since_last_session).toEqual({ entries: 0, notes: 0 });
    });
});

describe('GET /search', () => {
    it('finds sessions and journal entries; an empty query is []', async () => {
        const session = seedSession({ notes: 'We talked about the worry list and the phone.' });
        const entry = seedJournal({ body: 'Put the phone in the other room tonight.' });
        rebuildSearchIndex();
        const { body } = await call<SearchResult[]>('GET', '/search?q=phone');
        expect(body.data.map((h) => [h.kind, h.ref_id]).sort()).toEqual([
            ['journal', entry.id],
            ['session', session.id],
        ]);
        expect((await call<SearchResult[]>('GET', '/search?q=')).body.data).toEqual([]);
        expect((await call<SearchResult[]>('GET', '/search')).body.data).toEqual([]);
    });
});

describe('PUT /focus/checkins', () => {
    it('ticks and unticks a day on the current focus, and GET /focus carries them', async () => {
        seedFocus({ headline: 'H', items: [{ title: 'A', why: 'w', action: 'a', problem_id: null }] });
        const on = await call<FocusSnapshot>('PUT', '/focus/checkins', { item_index: 0, day: '2026-11-03', done: true });
        expect(on.status).toBe(200);
        expect(on.body.data.checkins).toEqual([{ item_index: 0, day: '2026-11-03' }]);
        await call('PUT', '/focus/checkins', { item_index: 0, day: '2026-11-03', done: true }); // idempotent
        expect((await call<FocusSnapshot>('GET', '/focus')).body.data.checkins).toHaveLength(1);
        const off = await call<FocusSnapshot>('PUT', '/focus/checkins', { item_index: 0, day: '2026-11-03', done: false });
        expect(off.body.data.checkins).toEqual([]);
    });

    it('404s with no focus or an out-of-range item; 400s a bad day', async () => {
        expect((await call('PUT', '/focus/checkins', { item_index: 0, day: '2026-11-03', done: true })).status).toBe(404);
        seedFocus({ headline: 'H', items: [{ title: 'A', why: 'w', action: 'a', problem_id: null }] });
        expect((await call('PUT', '/focus/checkins', { item_index: 3, day: '2026-11-03', done: true })).status).toBe(404);
        expect((await call('PUT', '/focus/checkins', { item_index: 0, day: 'today', done: true })).status).toBe(400);
    });
});

describe('POST /journal/:id/notes and dismiss', () => {
    let claude: ReturnType<typeof spyOn>;
    let quiet: ReturnType<typeof spyOn>;
    beforeEach(() => {
        quiet = spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        claude?.mockRestore();
        quiet.mockRestore();
    });

    it('writes a note for a confident paragraph, then dismiss hides it', async () => {
        const problem = seedProblem();
        const entry = seedJournal();
        claude = spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: { task: string }) =>
            opts.task === 'classify' ? { problem_id: problem.id, confidence: 0.9, because: 'b' } : { kind: 'connection', body: 'This echoes last month.', session_id: null }) as never);

        const made = await call<MarginNoteResult>('POST', `/journal/${entry.id}/notes`, { paragraph: 'A paragraph long enough to be classified.' });
        expect(made.status).toBe(200);
        expect(made.body.data.outcome).toBe('written');
        const note = made.body.data.note!;
        expect(note).toMatchObject({ kind: 'connection', source: 'margin', problem_title: problem.title });

        const list = await call<JournalInsight[]>('GET', `/journal/${entry.id}/insights`);
        expect(list.body.data.map((n) => n.id)).toEqual([note.id]);

        const dismissed = await call<JournalInsight>('POST', `/journal/${entry.id}/insights/${note.id}/dismiss`);
        expect(dismissed.status).toBe(200);
        expect(dismissed.body.data.dismissed_at).not.toBeNull();
        expect((await call<JournalInsight[]>('GET', `/journal/${entry.id}/insights`)).body.data).toEqual([]);
        expect((await call('POST', `/journal/${entry.id}/insights/${note.id + 50}/dismiss`)).status).toBe(404);
    });

    it('validates the paragraph and 404s a missing entry; AI failures answer 500 with the message', async () => {
        const entry = seedJournal();
        expect((await call('POST', `/journal/${entry.id}/notes`, { paragraph: 'short' })).status).toBe(400);
        expect((await call('POST', `/journal/999/notes`, { paragraph: 'A paragraph long enough to be classified.' })).status).toBe(404);
        seedProblem();
        claude = spyOn(svc_claude, 'completeStructured').mockRejectedValue(new svc_claude.AiNotConfiguredError());
        const failed = await call('POST', `/journal/${entry.id}/notes`, { paragraph: 'A paragraph long enough to be classified.' });
        expect(failed.status).toBe(500);
        expect(failed.body.message).toContain('not configured');
        expect(repo_insights.countMarginNotes(entry.id)).toBe(0);
    });
});
