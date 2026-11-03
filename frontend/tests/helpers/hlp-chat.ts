import type { ChatMessage, ChatThread } from '@therapy-aid/shared';

/* Fixtures for the chat tests: threads, messages, and a manually-resolved promise so a test can
   observe the in-between state of a request that has not answered yet. */

export const thread = (over: Partial<ChatThread> = {}): ChatThread => ({ id: 1, title: 'Racing mind', created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z', message_count: 0, ...over });

export const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({ id: 1, thread_id: 1, role: 'user', content: 'hello', created_at: '2026-10-01T12:00:00.000Z', ...over });

/* A promise the test settles by hand. */
export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};
