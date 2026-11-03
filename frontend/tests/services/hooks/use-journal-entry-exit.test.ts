import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush_outbox, parked_count, RETRY_MS } from '@/services/hooks/journal-autosave';
import { useJournalEntry } from '@/services/hooks/use-journal-entry';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { entry } from '../../helpers/hlp-problems-journal';

/* The journal editor at the edges of the page's life: the page hidden or closed mid-debounce, a
   flush that fails after the entry left the screen (the outbox), and a date changed while the
   creating POST is in flight. */

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const calls = (mock: ReturnType<typeof stub_api>, method: string) => mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === method);
const echo = (init?: RequestInit) => entry({ body: (JSON.parse(String(init?.body)) as { body: string }).body });
const hide = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    stub_api({ 'PATCH /api/journal/1': {}, 'POST /api/journal': entry({ id: 9 }) });
    await flush_outbox(); // never leak a parked doc into the next test
    vi.useRealTimers();
});

describe('useJournalEntry — page hidden or closed', () => {
    it('hiding the page (phone backgrounded) saves at once, with keepalive, without waiting for the debounce', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'a' }), 'PATCH /api/journal/1': echo });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('a last sentence'));
        act(() => hide());
        const patches = calls(mock, 'PATCH');
        expect(patches).toHaveLength(1);
        expect((patches[0]![1] as RequestInit).keepalive).toBe(true);
        await tick(5000);
        expect(calls(mock, 'PATCH')).toHaveLength(1);
    });

    it('pagehide (tab closed, refresh) saves at once too', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'a' }), 'PATCH /api/journal/1': echo });
        const { result } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('typed then closed'));
        act(() => void window.dispatchEvent(new Event('pagehide')));
        expect(sent_body(mock, mock.mock.calls.indexOf(calls(mock, 'PATCH')[0]!))).toEqual({ body: 'typed then closed' });
    });

    it('nothing unsaved: hiding the page sends nothing', async () => {
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'a' }) });
        renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => hide());
        expect(calls(mock, 'PATCH')).toHaveLength(0);
    });
});

describe('useJournalEntry — the outbox', () => {
    it('a flush that fails on unmount is kept and retried until it lands', async () => {
        let online = false;
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'a' }), 'PATCH /api/journal/1': (init?: RequestInit) => (online ? echo(init) : envelope(null, 503, 'Offline.')) });
        const { result, unmount } = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => result.current.set_body('written on a bad connection'));
        unmount();
        await tick(0);
        expect(parked_count()).toBe(1);
        online = true;
        await tick(RETRY_MS);
        expect(parked_count()).toBe(0);
        const last = calls(mock, 'PATCH').at(-1)!;
        expect(sent_body(mock, mock.mock.calls.indexOf(last))).toEqual({ body: 'written on a bad connection' });
    });

    it('reopening an entry whose save is parked shows the unsaved text, not the server copy, and saves it', async () => {
        let online = false;
        const mock = stub_api({ 'GET /api/journal/1': entry({ body: 'old server copy' }), 'PATCH /api/journal/1': (init?: RequestInit) => (online ? echo(init) : envelope(null, 503, 'Offline.')) });
        const first = renderHook(() => useJournalEntry(1));
        await tick(0);
        act(() => first.result.current.set_body('newer text'));
        first.unmount();
        await tick(0);
        online = true;
        const again = renderHook(() => useJournalEntry(1));
        expect(again.result.current.body).toBe('newer text');
        await tick(0);
        expect(parked_count()).toBe(0);
        expect(calls(mock, 'GET')).toHaveLength(1);
        expect(again.result.current.save_state).toBe('saved');
    });
});

describe('useJournalEntry — date changed during the creating POST', () => {
    it('PATCHes the new date once the entry exists', async () => {
        let release: () => void = () => undefined;
        const mock = stub_api({ 'POST /api/journal': (init?: RequestInit) => new Promise((resolve) => (release = () => resolve(entry({ id: 9, body: (JSON.parse(String(init?.body)) as { body: string }).body })))), 'PATCH /api/journal/9': echo });
        const { result } = renderHook(() => useJournalEntry(null));
        await tick(0);
        act(() => result.current.set_body('x')); // the first keystroke fires the POST with today's date
        act(() => result.current.set_date('2026-10-06'));
        release();
        await tick(2000);
        const patches = calls(mock, 'PATCH');
        expect(patches).toHaveLength(1);
        expect((sent_body(mock, mock.mock.calls.indexOf(patches[0]!)) as { occurred_at?: string }).occurred_at).toBeDefined();
        expect(new Date((sent_body(mock, mock.mock.calls.indexOf(patches[0]!)) as { occurred_at: string }).occurred_at).getDate()).toBe(6);
    });
});
