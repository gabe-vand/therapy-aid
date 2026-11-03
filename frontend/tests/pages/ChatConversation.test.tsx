import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, message, thread } from '../helpers/hlp-chat';
import { history, open, racing, reply, textbox, type } from '../helpers/hlp-chat-page';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';

const scroll = vi.fn();
beforeEach(() => {
    scroll.mockClear();
    Element.prototype.scrollIntoView = scroll;
});

describe('Chat: conversation', () => {
    it('renders history, with assistant answers as markdown, and scrolls to the newest', async () => {
        stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history } });
        open('/chat/1');
        expect(await screen.findByText('What helps?')).toBeInTheDocument();
        expect(screen.getByText('worry list').tagName).toBe('STRONG');
        expect(screen.getByRole('heading', { name: 'Racing mind', level: 2 })).toBeInTheDocument();
        await waitFor(() => expect(scroll).toHaveBeenCalled());
    });

    it('shows an error for a thread that cannot load, with Retry', async () => {
        stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': envelope(null, 404, 'That chat no longer exists.') });
        open('/chat/1');
        expect(await screen.findByText('That chat no longer exists.')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
    });

    it('sends: optimistic bubble, Thinking…, then the answer, and refreshes the list', async () => {
        const gate = deferred<unknown>();
        const mock = stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history }, 'POST /api/chat/threads/1/messages': () => gate.promise });
        open('/chat/1');
        await screen.findByText('What helps?');

        type('And at night?');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(await screen.findByText('And at night?')).toBeInTheDocument();
        expect(screen.getByText('Thinking…')).toBeInTheDocument();
        expect(textbox()).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
        const lists_before = mock.mock.calls.filter((c) => c[0] === '/api/chat/threads').length;

        gate.resolve(reply);
        expect(await screen.findByText('same wake time')).toBeInTheDocument();
        expect(screen.queryByText('Thinking…')).toBeNull();
        expect(screen.getAllByText('And at night?')).toHaveLength(1);
        expect(sent_body(mock, 2)).toEqual({ content: 'And at night?' });
        await waitFor(() => expect(mock.mock.calls.filter((c) => c[0] === '/api/chat/threads').length).toBe(lists_before + 1));
    });

    it('Enter sends and Shift+Enter does not', async () => {
        const mock = stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history }, 'POST /api/chat/threads/1/messages': reply });
        open('/chat/1');
        await screen.findByText('What helps?');
        const posts = () => mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST').length;

        type('line one');
        expect(fireEvent.keyDown(textbox(), { key: 'Enter', shiftKey: true })).toBe(true);
        expect(posts()).toBe(0);
        expect(textbox()).toHaveValue('line one');

        expect(fireEvent.keyDown(textbox(), { key: 'Enter' })).toBe(false);
        await waitFor(() => expect(posts()).toBe(1));
        await screen.findByText('same wake time');
    });

    it('does not send an empty message', async () => {
        const mock = stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history } });
        open('/chat/1');
        await screen.findByText('What helps?');
        type('   ');
        fireEvent.keyDown(textbox(), { key: 'Enter' });
        expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(false);
    });

    it('shows a failure inline and Retry resends the same content', async () => {
        let attempts = 0;
        const mock = stub_api({
            'GET /api/chat/threads': [racing],
            'GET /api/chat/threads/1': { thread: racing, messages: history },
            'POST /api/chat/threads/1/messages': () => (++attempts === 1 ? envelope(null, 500, 'The AI model is unavailable.') : reply),
        });
        open('/chat/1');
        await screen.findByText('What helps?');
        type('And at night?');
        fireEvent.keyDown(textbox(), { key: 'Enter' });

        expect(await screen.findByRole('alert')).toHaveTextContent('The AI model is unavailable.');
        expect(screen.getByText('And at night?')).toBeInTheDocument();
        expect(screen.queryByText('Thinking…')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('same wake time')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(sent_body(mock, 3)).toEqual({ content: 'And at night?' });
        expect(sent_body(mock, 2)).toEqual(sent_body(mock, 3));
    });

    it('lets a failed message be discarded', async () => {
        stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history }, 'POST /api/chat/threads/1/messages': envelope(null, 500, 'Nope.') });
        open('/chat/1');
        await screen.findByText('What helps?');
        type('draft');
        fireEvent.keyDown(textbox(), { key: 'Enter' });
        await screen.findByRole('alert');
        fireEvent.click(screen.getByRole('button', { name: 'Discard message' }));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByText('draft')).toBeNull();
    });

    it('offers starter questions in an empty thread, and they send', async () => {
        const empty = thread({ id: 5, title: 'New chat' });
        const mock = stub_api({
            'GET /api/chat/threads': [empty],
            'GET /api/chat/threads/5': { thread: empty, messages: [] },
            'POST /api/chat/threads/5/messages': { user: message({ id: 1, thread_id: 5, content: 'q' }), assistant: message({ id: 2, thread_id: 5, role: 'assistant', content: 'a' }) },
        });
        open('/chat/5');
        fireEvent.click(await screen.findByRole('button', { name: 'Summarise my last session' }));
        const post = () => mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
        await waitFor(() => expect(post()).toBeGreaterThan(-1));
        expect(sent_body(mock, post())).toEqual({ content: 'Summarise my last session' });
    });
});
