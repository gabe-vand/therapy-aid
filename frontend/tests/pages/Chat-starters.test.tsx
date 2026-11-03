import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { message, thread } from '../helpers/hlp-chat';
import { open, racing } from '../helpers/hlp-chat-page';
import { sent_body, stub_api } from '../helpers/hlp-fetch';
import { problem } from '../helpers/hlp-problems-journal';
import { focus_snapshot } from '../helpers/hlp-sessions';

/* The empty Chat pane's suggested questions: built from the focus and problems, and — with no
   thread open — a tap opens a new thread and sends the question there exactly once. */

const answer = (thread_id: number) => ({ user: message({ id: 11, thread_id, content: 'q' }), assistant: message({ id: 12, thread_id, role: 'assistant', content: 'An answer.' }) });

const posts_to = (mock: ReturnType<typeof stub_api>, url: string) => mock.mock.calls.map((c, i) => ({ url: c[0], method: (c[1] as RequestInit | undefined)?.method, i })).filter((c) => c.url === url && c.method === 'POST');

describe('Chat: suggested questions', () => {
    it('builds personal chips from the focus and the recently discussed problems', async () => {
        stub_api({
            'GET /api/chat/threads': [racing],
            'GET /api/problems': [problem({ id: 3, title: 'Racing mind at night' })],
            'GET /api/focus': focus_snapshot({ items: [{ title: 'Protect your mornings', why: '', action: '', problem_id: null }] }),
        });
        open('/chat');
        expect(await screen.findByRole('button', { name: 'How has “protect your mornings” been going?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'What did David say about racing mind at night?' })).toBeInTheDocument();
    });

    it('with no thread open, a chip creates a thread, opens it and sends the question once', async () => {
        const created = thread({ id: 9, title: 'New chat' });
        const mock = stub_api({ 'GET /api/chat/threads': [racing], 'POST /api/chat/threads': created, 'GET /api/chat/threads/9': { thread: created, messages: [] }, 'POST /api/chat/threads/9/messages': answer(9) });
        open('/chat');
        fireEvent.click(await screen.findByRole('button', { name: 'Summarise my last session' }));
        expect(await screen.findByText('An answer.')).toBeInTheDocument();
        const sent = posts_to(mock, '/api/chat/threads/9/messages');
        expect(sent).toHaveLength(1);
        expect(sent_body(mock, sent[0]!.i)).toEqual({ content: 'Summarise my last session' });
        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument());
    });

    it('reuses an untouched empty thread instead of creating another', async () => {
        const empty = thread({ id: 5, title: 'New chat', message_count: 0 });
        const mock = stub_api({ 'GET /api/chat/threads': [racing, empty], 'GET /api/chat/threads/5': { thread: empty, messages: [] }, 'POST /api/chat/threads/5/messages': answer(5) });
        open('/chat');
        fireEvent.click(await screen.findByRole('button', { name: 'What should I bring up next session?' }));
        expect(await screen.findByText('An answer.')).toBeInTheDocument();
        expect(posts_to(mock, '/api/chat/threads')).toHaveLength(0);
        expect(posts_to(mock, '/api/chat/threads/5/messages')).toHaveLength(1);
    });
});
