import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { POLL_MS, useSession } from '@/services/hooks/use-session';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { session } from '../../helpers/hlp-sessions';

afterEach(() => vi.useRealTimers());

// Lets pending fetch promises settle and then moves the fake clock forward.
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe('useSession polling', () => {
    it('polls every 3s while processing and stops once ready', async () => {
        vi.useFakeTimers();
        let status = 'transcribing';
        const mock = stub_api({ 'GET /api/sessions/4': () => session({ status: status as 'ready', source: 'recording' }) });
        const { result } = renderHook(() => useSession(4));

        await advance(0);
        expect(result.current.session?.status).toBe('transcribing');
        expect(mock).toHaveBeenCalledTimes(1);

        await advance(POLL_MS);
        expect(mock).toHaveBeenCalledTimes(2);

        status = 'summarizing';
        await advance(POLL_MS);
        expect(result.current.session?.status).toBe('summarizing');

        status = 'ready';
        await advance(POLL_MS);
        expect(result.current.session?.status).toBe('ready');
        const calls = mock.mock.calls.length;

        await advance(POLL_MS * 5);
        expect(mock).toHaveBeenCalledTimes(calls);
    });

    it('does not poll a session that is already ready', async () => {
        vi.useFakeTimers();
        const mock = stub_api({ 'GET /api/sessions/4': session() });
        renderHook(() => useSession(4));
        await advance(POLL_MS * 3);
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('stops polling when the component unmounts', async () => {
        vi.useFakeTimers();
        const mock = stub_api({ 'GET /api/sessions/4': session({ status: 'summarizing' }) });
        const { unmount } = renderHook(() => useSession(4));
        await advance(0);
        unmount();
        await advance(POLL_MS * 4);
        expect(mock).toHaveBeenCalledTimes(1);
    });

    it('keeps the last data and keeps polling through a 5xx blip', async () => {
        vi.useFakeTimers();
        let fail = false;
        stub_api({ 'GET /api/sessions/4': () => (fail ? envelope(null, 502, 'Bad gateway') : session({ status: 'summarizing' })) });
        const { result } = renderHook(() => useSession(4));
        await advance(0);

        fail = true;
        await advance(POLL_MS);
        expect(result.current.session?.status).toBe('summarizing');
        expect(result.current.error).toBeNull();

        fail = false;
        await advance(POLL_MS);
        expect(result.current.error).toBeNull();
    });

    it('stops and reports a 404', async () => {
        vi.useFakeTimers();
        const mock = stub_api({ 'GET /api/sessions/9': envelope(null, 404, 'Session not found.') });
        const { result } = renderHook(() => useSession(9));
        await advance(0);
        expect(result.current.error).toBe('Session not found.');
        expect(result.current.session).toBeNull();
        await advance(POLL_MS * 3);
        expect(mock).toHaveBeenCalledTimes(1);
    });
});

describe('useSession actions', () => {
    it('reports an unreachable server on first load', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Promise.reject(new TypeError('x'))),
        );
        const { result } = renderHook(() => useSession(4));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);
    });

    it('save PATCHes only what is given and merges the result', async () => {
        const mock = stub_api({ 'GET /api/sessions/4': session(), 'PATCH /api/sessions/4': session({ title: 'Renamed' }) });
        const { result } = renderHook(() => useSession(4));
        await waitFor(() => expect(result.current.session).not.toBeNull());
        let ok = false;
        await act(async () => void (ok = await result.current.save({ title: 'Renamed' })));
        expect(ok).toBe(true);
        expect(sent_body(mock, 1)).toEqual({ title: 'Renamed' });
        expect(result.current.session?.title).toBe('Renamed');
    });

    it('save failure surfaces the message and keeps the old title', async () => {
        stub_api({ 'GET /api/sessions/4': session(), 'PATCH /api/sessions/4': envelope(null, 400, 'title: Too long.') });
        const { result } = renderHook(() => useSession(4));
        await waitFor(() => expect(result.current.session).not.toBeNull());
        await act(async () => void (await result.current.save({ title: 'x' })));
        expect(result.current.action_error).toBe('title: Too long.');
        expect(result.current.session?.title).toBe('Racing mind, ADHD, morning structure');
    });

    it('retry posts to /retry and resumes polling', async () => {
        vi.useFakeTimers();
        let status = 'failed';
        const mock = stub_api({
            'GET /api/sessions/4': () => session({ status: status as 'failed', error: status === 'failed' ? 'Boom' : null }),
            'POST /api/sessions/4/retry': () => {
                status = 'summarizing';
                return session({ status: 'summarizing' });
            },
        });
        const { result } = renderHook(() => useSession(4));
        await advance(0);
        expect(result.current.session?.status).toBe('failed');
        await advance(POLL_MS * 2);
        expect(mock).toHaveBeenCalledTimes(1);

        await act(async () => void (await result.current.retry()));
        await advance(0);
        expect(result.current.session?.status).toBe('summarizing');
        status = 'ready';
        await advance(POLL_MS);
        expect(result.current.session?.status).toBe('ready');
    });

    it('remove DELETEs the session', async () => {
        const mock = stub_api({ 'GET /api/sessions/4': session(), 'DELETE /api/sessions/4': { id: 4 } });
        const { result } = renderHook(() => useSession(4));
        await waitFor(() => expect(result.current.session).not.toBeNull());
        let ok = false;
        await act(async () => void (ok = await result.current.remove()));
        expect(ok).toBe(true);
        expect((mock.mock.calls[1]![1] as RequestInit).method).toBe('DELETE');
    });
});
