import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, ChatMessage, ChatThread } from '@therapy-aid/shared';
import { app } from '@/app';
import * as svc_claude from '@/services/common/svc-claude';
import { resetDatabase } from '../helpers/hlp-db';

// /chat end to end through the real app (dev-mode auth), AI stubbed.

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await app.request(path, init);
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

let tools_spy: ReturnType<typeof spyOn>;
let quiet: ReturnType<typeof spyOn>;
beforeEach(() => {
    resetDatabase();
    tools_spy = spyOn(svc_claude, 'completeWithTools').mockResolvedValue('A tight answer.');
    quiet = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    tools_spy.mockRestore();
    quiet.mockRestore();
});

const newThread = async (): Promise<ChatThread> => (await call<ChatThread>('POST', '/chat/threads', {})).body.data;

describe('threads', () => {
    it('POST creates, GET lists with message_count', async () => {
        const thread = await newThread();
        expect(thread).toMatchObject({ title: 'New chat', message_count: 0 });
        const list = await call<ChatThread[]>('GET', '/chat/threads');
        expect(list.body.data.map((t) => t.id)).toEqual([thread.id]);
    });

    it('GET /threads/:id returns { thread, messages }', async () => {
        const thread = await newThread();
        await call('POST', `/chat/threads/${thread.id}/messages`, { content: 'hello' });
        const { body } = await call<{ thread: ChatThread; messages: ChatMessage[] }>('GET', `/chat/threads/${thread.id}`);
        expect(body.data.thread).toMatchObject({ title: 'hello', message_count: 2 });
        expect(body.data.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    });

    it('DELETE removes the thread and its messages', async () => {
        const thread = await newThread();
        await call('POST', `/chat/threads/${thread.id}/messages`, { content: 'bye' });
        expect((await call('DELETE', `/chat/threads/${thread.id}`)).status).toBe(200);
        expect((await call('GET', `/chat/threads/${thread.id}`)).status).toBe(404);
        expect((await call('DELETE', `/chat/threads/${thread.id}`)).status).toBe(404);
    });

    it('404s on a missing or malformed id', async () => {
        for (const [method, path] of [['GET', '/chat/threads/999'], ['GET', '/chat/threads/abc'], ['DELETE', '/chat/threads/999']] as const) {
            expect([method, path, (await call(method, path)).status]).toEqual([method, path, 404]);
        }
        expect((await call('POST', '/chat/threads/999/messages', { content: 'hi' })).status).toBe(404);
        expect(tools_spy).not.toHaveBeenCalled();
    });
});

describe('POST /threads/:id/messages', () => {
    it('answers { user, assistant } and names the thread', async () => {
        const thread = await newThread();
        const { status, body } = await call<{ user: ChatMessage; assistant: ChatMessage }>('POST', `/chat/threads/${thread.id}/messages`, { content: 'What did David say about sleep?' });
        expect(status).toBe(200);
        expect(body.data.user).toMatchObject({ role: 'user', content: 'What did David say about sleep?', thread_id: thread.id });
        expect(body.data.assistant).toMatchObject({ role: 'assistant', content: 'A tight answer.' });
        expect((await call<ChatThread[]>('GET', '/chat/threads')).body.data[0]!.title).toBe('What did David say about sleep?');
    });

    it('400s on a missing, blank, non-string or oversized content, and calls nothing', async () => {
        const thread = await newThread();
        for (const payload of [{}, { content: '' }, { content: '   ' }, { content: 5 }, { content: 'x'.repeat(20_001) }, 'garbage']) {
            const { status, body } = await call('POST', `/chat/threads/${thread.id}/messages`, payload);
            expect([JSON.stringify(payload).slice(0, 30), status]).toEqual([JSON.stringify(payload).slice(0, 30), 400]);
            expect(body.message.length).toBeGreaterThan(0);
        }
        expect(tools_spy).not.toHaveBeenCalled();
    });

    it('surfaces an AI failure readably and stores nothing, so the client can retry', async () => {
        tools_spy.mockRejectedValue(new svc_claude.AiNotConfiguredError());
        const thread = await newThread();
        const { status, body } = await call('POST', `/chat/threads/${thread.id}/messages`, { content: 'will fail' });
        expect(status).toBe(500);
        expect(body.message).toContain('ANTHROPIC_API_KEY');
        const after = await call<{ messages: ChatMessage[] }>('GET', `/chat/threads/${thread.id}`);
        expect(after.body.data.messages).toEqual([]);
    });

    it('hides unexpected error details behind a generic message', async () => {
        tools_spy.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
        const thread = await newThread();
        const { body } = await call('POST', `/chat/threads/${thread.id}/messages`, { content: 'hi' });
        expect(body.message).not.toContain('10.0.0.5');
        expect(body.message).toContain('Try again');
    });
});
