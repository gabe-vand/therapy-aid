import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_MS, useJournalEntry } from '@/services/hooks/use-journal-entry';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { entry } from '../../helpers/hlp-problems-journal';

/* Autosave under fake timers: advance the clock inside act() so state updates and the mocked
   fetch promises settle exactly as they would in the browser. */
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const methods = (mock: ReturnType<typeof stub_api>, method: string) => mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === method);

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('useJournalEntry — loading', () => {
    it('loads an existing entry into the draft without saving anything', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'Hello there', occurred_at: '2026-10-13T12:00:00.000Z' }) });
        const { result } = renderHook(() => useJournalEntry(1));
        expect(result.current.loading).toBe(true);
        await tick(0);
        expect(result.current.loading).toBe(false);
        expect(result.current.body).toBe('Hello there');
        expect(result.current.date).toBe('2026-10-13');
        expect(result.current.loaded_body).toBe('Hello there');
        await tick(10_000);
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('reports a missing entry and offers retry', async () => {
        stub_api({ 'GET /api/journal/4': envelope(null, 404, 'ENTRY_NOT_FOUND') });
        const { result } = renderHook(() => useJournalEntry(4));
        await tick(0);
        expect(result.current.error).toBe('This entry no longer exists.');
    });
});

describe('useJournalEntry — autosave', () => {
    it('debounces: many keystrokes, one PATCH 1.5s after the last, with the latest text', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'a' }), 'PATCH /api/journal/1': (init?: RequestInit) => entry({ body: (JSON.parse(String(init?.body)) as { body: string }).body }) });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);

        act(() => result.current.set_body('ab'));
        await tick(1000);
        act(() => result.current.set_body('abc'));
        await tick(1000);
        act(() => result.current.set_body('abcd'));
        expect(result.current.save_state).toBe('saving');
        await tick(AUTOSAVE_MS - 1);
        expect(methods(mock, 'PATCH')).toHaveLength(0);

        await tick(1);
        const patches = methods(mock, 'PATCH');
        expect(patches).toHaveLength(1);
        expect(sent_body(mock, mock.mock.calls.indexOf(patches[0]!))).toEqual({ body: 'abcd' });
        expect(result.current.save_state).toBe('saved');
    });

    it('sends occurred_at only when the date was changed', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'x' }), 'PATCH /api/journal/1': entry() });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);

        act(() => result.current.set_body('xy'));
        await tick(AUTOSAVE_MS);
        const first = methods(mock, 'PATCH')[0]!;
        expect(sent_body(mock, mock.mock.calls.indexOf(first))).toEqual({ body: 'xy' });

        act(() => result.current.set_date('2026-09-01'));
        await tick(AUTOSAVE_MS);
        const second = methods(mock, 'PATCH')[1]!;
        const body = sent_body(mock, mock.mock.calls.indexOf(second)) as { body: string; occurred_at: string };
        expect(body.body).toBe('xy');
        expect(new Date(body.occurred_at).getFullYear()).toBe(2026);
        expect(new Date(body.occurred_at).getMonth()).toBe(8);
    });

    it('notifies on_change with each saved entry', async () => {
        stub_api({ 'GET /api/journal/1': entry(), 'PATCH /api/journal/1': entry({ body: 'saved text' }) });
        const on_change = vi.fn();
        const { result } = renderHook(() => useJournalEntry(1, { on_change }));
        await tick(0);
        act(() => result.current.set_body('saved text'));
        await tick(AUTOSAVE_MS);
        expect(on_change).toHaveBeenCalledWith(expect.objectContaining({ body: 'saved text' }));
    });

    it('unmounting flushes unsaved text immediately instead of dropping it', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry(), 'PATCH /api/journal/1': entry() });
        const { result, unmount } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('typed just before leaving'));
        unmount();
        await tick(0);
        const patches = methods(mock, 'PATCH');
        expect(patches).toHaveLength(1);
        expect(sent_body(mock, mock.mock.calls.indexOf(patches[0]!))).toEqual({ body: 'typed just before leaving' });
    });

    it('a failed save keeps the text, shows the error, and save_now retries', async () => {
        let fail = true;
        const mock = stub_api({ 'GET /api/journal/1': entry(), 'PATCH /api/journal/1': () => (fail ? envelope(null, 500, 'Disk is full.') : entry()) });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('keep me'));
        await tick(AUTOSAVE_MS);
        expect(result.current.save_state).toBe('error');
        expect(result.current.save_error).toBe('Disk is full.');
        expect(result.current.body).toBe('keep me');

        fail = false;
        await act(async () => {
            await result.current.save_now();
        });
        expect(result.current.save_state).toBe('saved');
        expect(methods(mock, 'PATCH')).toHaveLength(2);
    });
});

describe('useJournalEntry — new draft', () => {
    it('creates the entry on the first keystroke with POST, then switches to PATCH', async () => {
        const mock = stub_api({ 'POST /api/journal': (init?: RequestInit) => entry({ id: 12, body: (JSON.parse(String(init?.body)) as { body: string }).body }), 'PATCH /api/journal/12': entry({ id: 12 }) });
        const on_created = vi.fn();
        const { result } = renderHook(() => useJournalEntry(null, { on_created }));
        expect(result.current.entry_id).toBeNull();
        expect(result.current.loading).toBe(false);

        act(() => result.current.set_body('I'));
        await tick(0);
        expect(methods(mock, 'POST')).toHaveLength(1);
        expect(sent_body(mock, 0)).toMatchObject({ body: 'I' });
        expect(result.current.entry_id).toBe(12);
        expect(on_created).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));

        act(() => result.current.set_body('I am typing more'));
        await tick(AUTOSAVE_MS);
        expect(methods(mock, 'POST')).toHaveLength(1);
        expect(methods(mock, 'PATCH')).toHaveLength(1);
    });

    it('does not create anything for blank text', async () => {
        const mock = stub_api({});
        const { result } = renderHook(() => useJournalEntry(null));
        act(() => result.current.set_body('   '));
        await tick(AUTOSAVE_MS * 2);
        expect(mock).not.toHaveBeenCalled();
    });

    it('text typed while the create is in flight is saved afterwards, never lost', async () => {
        let release: (r: Response) => void = () => {};
        const mock = stub_api({ 'POST /api/journal': () => new Promise<Response>((resolve) => (release = resolve)), 'PATCH /api/journal/5': entry({ id: 5 }) });
        const { result } = renderHook(() => useJournalEntry(null));
        act(() => result.current.set_body('H'));
        await tick(0);
        act(() => result.current.set_body('Hello'));
        await act(async () => release(envelope(entry({ id: 5, body: 'H' }))));
        await tick(AUTOSAVE_MS);
        const patches = methods(mock, 'PATCH');
        expect(patches).toHaveLength(1);
        expect(sent_body(mock, mock.mock.calls.indexOf(patches[0]!))).toEqual({ body: 'Hello' });
    });
});

describe('useJournalEntry — delete', () => {
    it('DELETEs the entry and cancels any pending autosave', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry(), 'DELETE /api/journal/1': {} });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('about to be deleted'));
        let ok = false;
        await act(async () => {
            ok = await result.current.remove();
        });
        await tick(AUTOSAVE_MS * 2);
        expect(ok).toBe(true);
        expect(methods(mock, 'DELETE')).toHaveLength(1);
        expect(methods(mock, 'PATCH')).toHaveLength(0);
    });
});
