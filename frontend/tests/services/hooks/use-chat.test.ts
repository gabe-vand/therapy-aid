import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChat } from '@/services/hooks/use-chat';
import { deferred, message, thread } from '../../helpers/hlp-chat';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';

const history = [message({ id: 1, role: 'user', content: 'earlier question' }), message({ id: 2, role: 'assistant', content: 'earlier answer' })];
const reply = { user: message({ id: 3, role: 'user', content: 'new question' }), assistant: message({ id: 4, role: 'assistant', content: 'new answer' }) };

const loaded = async (thread_id: number | null = 1) => {
    const hook = renderHook(({ id }) => useChat(id), { initialProps: { id: thread_id } });
    if (thread_id !== null) await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
};

describe('useChat', () => {
    it('loads the thread and its messages', async () => {
        stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: history } });
        const { result } = await loaded();
        expect(result.current.thread?.title).toBe('Racing mind');
        expect(result.current.messages.map((m) => m.content)).toEqual(['earlier question', 'earlier answer']);
        expect(result.current.error).toBeNull();
    });

    it('does nothing without a thread id', async () => {
        const mock = stub_api({});
        const { result } = await loaded(null);
        expect(result.current.loading).toBe(false);
        expect(mock).not.toHaveBeenCalled();
        let ok = true;
        await act(async () => {
            ok = await result.current.send('hi');
        });
        expect(ok).toBe(false);
    });

    it('surfaces a load failure', async () => {
        stub_api({ 'GET /api/chat/threads/1': envelope(null, 404, 'That chat no longer exists.') });
        const { result } = await loaded();
        expect(result.current.error).toBe('That chat no longer exists.');
        expect(result.current.thread).toBeNull();
    });

    it('shows the message optimistically, then swaps in the stored pair', async () => {
        const gate = deferred<unknown>();
        const mock = stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: history }, 'POST /api/chat/threads/1/messages': () => gate.promise });
        const { result } = await loaded();

        let sent: Promise<boolean> = Promise.resolve(false);
        act(() => {
            sent = result.current.send('  new question  ');
        });
        await waitFor(() => expect(result.current.sending).toBe(true));
        expect(result.current.pending).toEqual({ content: 'new question', error: null });
        expect(result.current.messages).toHaveLength(2);

        await act(async () => {
            gate.resolve(reply);
            await sent;
        });
        expect(await sent).toBe(true);
        expect(result.current.pending).toBeNull();
        expect(result.current.sending).toBe(false);
        expect(result.current.messages.map((m) => m.content)).toEqual(['earlier question', 'earlier answer', 'new question', 'new answer']);
        expect(sent_body(mock, 1)).toEqual({ content: 'new question' });
    });

    it('keeps a failed message with its reason, and retry resends the same content', async () => {
        let attempts = 0;
        const mock = stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: [] }, 'POST /api/chat/threads/1/messages': () => (++attempts === 1 ? envelope(null, 500, 'The AI model is unavailable.') : reply) });
        const { result } = await loaded();

        await act(async () => {
            await result.current.send('new question');
        });
        expect(result.current.pending).toEqual({ content: 'new question', error: 'The AI model is unavailable.' });
        expect(result.current.sending).toBe(false);
        expect(result.current.messages).toHaveLength(0);

        await act(async () => {
            expect(await result.current.retry()).toBe(true);
        });
        expect(result.current.pending).toBeNull();
        expect(result.current.messages).toHaveLength(2);
        expect(sent_body(mock, 1)).toEqual(sent_body(mock, 2));
    });

    it('ignores a blank message and a second send while one is in flight', async () => {
        const gate = deferred<unknown>();
        const mock = stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: [] }, 'POST /api/chat/threads/1/messages': () => gate.promise });
        const { result } = await loaded();

        await act(async () => {
            expect(await result.current.send('   ')).toBe(false);
        });
        let first: Promise<boolean> = Promise.resolve(false);
        act(() => {
            first = result.current.send('one');
        });
        await act(async () => {
            expect(await result.current.send('two')).toBe(false);
        });
        await act(async () => {
            gate.resolve(reply);
            await first;
        });
        expect(mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toHaveLength(1);
    });

    it('discard drops a failed message but not one in flight', async () => {
        stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: [] }, 'POST /api/chat/threads/1/messages': envelope(null, 500, 'Nope.') });
        const { result } = await loaded();
        await act(async () => {
            await result.current.send('hello');
        });
        expect(result.current.pending?.error).toBe('Nope.');
        act(() => result.current.discard());
        expect(result.current.pending).toBeNull();
    });

    it('starts clean when another thread opens, and drops a reply for the old one', async () => {
        const gate = deferred<unknown>();
        stub_api({ 'GET /api/chat/threads/1': { thread: thread(), messages: history }, 'GET /api/chat/threads/2': { thread: thread({ id: 2, title: 'Other' }), messages: [] }, 'POST /api/chat/threads/1/messages': () => gate.promise });
        const { result, rerender } = await loaded();
        let sent: Promise<boolean> = Promise.resolve(false);
        act(() => {
            sent = result.current.send('question');
        });
        rerender({ id: 2 });
        await waitFor(() => expect(result.current.thread?.title).toBe('Other'));
        expect(result.current.messages).toEqual([]);
        expect(result.current.pending).toBeNull();

        await act(async () => {
            gate.resolve(reply);
            await sent;
        });
        expect(result.current.messages).toEqual([]);
        expect(result.current.pending).toBeNull();
    });
});
