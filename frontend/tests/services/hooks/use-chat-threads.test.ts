import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useChatThreads } from '@/services/hooks/use-chat-threads';
import { thread } from '../../helpers/hlp-chat';
import { envelope, sent_body, stub_api, stub_unreachable } from '../../helpers/hlp-fetch';

const older = thread({ id: 1, title: 'Older', updated_at: '2026-09-01T00:00:00.000Z' });
const newer = thread({ id: 2, title: 'Newer', updated_at: '2026-10-05T00:00:00.000Z' });

describe('useChatThreads', () => {
    it('loads the threads, most recently updated first', async () => {
        stub_api({ 'GET /api/chat/threads': [older, newer] });
        const { result } = renderHook(() => useChatThreads());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.threads.map((t) => t.title)).toEqual(['Newer', 'Older']);
        expect(result.current.error).toBeNull();
    });

    it('surfaces a load failure, and reload recovers', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);

        stub_api({ 'GET /api/chat/threads': [older] });
        await act(() => result.current.reload());
        expect(result.current.error).toBeNull();
        expect(result.current.threads).toHaveLength(1);
    });

    it('creates a thread, puts it first and resolves with it', async () => {
        const created = thread({ id: 3, title: 'New chat', updated_at: '2026-10-09T00:00:00.000Z' });
        const mock = stub_api({ 'GET /api/chat/threads': [older, newer], 'POST /api/chat/threads': created });
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let returned = null as unknown;
        await act(async () => {
            returned = await result.current.create();
        });
        expect(returned).toEqual(created);
        expect(result.current.threads.map((t) => t.id)).toEqual([3, 2, 1]);
        expect(sent_body(mock, 1)).toEqual({});
    });

    it('reports a failed create without touching the list', async () => {
        stub_api({ 'GET /api/chat/threads': [older], 'POST /api/chat/threads': envelope(null, 500, 'Could not create the chat.') });
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));
        let returned: unknown = 'unset';
        await act(async () => {
            returned = await result.current.create();
        });
        expect(returned).toBeNull();
        expect(result.current.action_error).toBe('Could not create the chat.');
        expect(result.current.threads).toHaveLength(1);
    });

    it('deletes a thread only once the server confirms', async () => {
        const mock = stub_api({ 'GET /api/chat/threads': [older, newer], 'DELETE /api/chat/threads/2': {} });
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let ok = false;
        await act(async () => {
            ok = await result.current.remove(2);
        });
        expect(ok).toBe(true);
        expect(result.current.threads.map((t) => t.id)).toEqual([1]);
        expect(mock.mock.calls[1]![1]).toMatchObject({ method: 'DELETE' });
    });

    it('keeps the thread when the delete fails', async () => {
        stub_api({ 'GET /api/chat/threads': [older], 'DELETE /api/chat/threads/1': envelope(null, 500, 'Could not delete.') });
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));
        let ok = true;
        await act(async () => {
            ok = await result.current.remove(1);
        });
        expect(ok).toBe(false);
        expect(result.current.action_error).toBe('Could not delete.');
        expect(result.current.threads).toHaveLength(1);
    });

    it('refreshes quietly: no loading flag, and a failure keeps the list', async () => {
        stub_api({ 'GET /api/chat/threads': [older] });
        const { result } = renderHook(() => useChatThreads());
        await waitFor(() => expect(result.current.loading).toBe(false));

        stub_api({ 'GET /api/chat/threads': [older, newer] });
        await act(() => result.current.refresh());
        expect(result.current.threads).toHaveLength(2);

        stub_unreachable();
        await act(() => result.current.refresh());
        expect(result.current.threads).toHaveLength(2);
        expect(result.current.error).toBeNull();
    });
});
