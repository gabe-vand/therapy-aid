import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { thread } from '../helpers/hlp-chat';
import { history, open, racing, sleep, textbox } from '../helpers/hlp-chat-page';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';

describe('Chat: thread list', () => {
    it('shows a skeleton, then the threads with message counts', async () => {
        stub_api({ 'GET /api/chat/threads': [sleep, racing] });
        open('/chat');
        expect(screen.getByRole('status', { name: 'Loading chats…' })).toBeInTheDocument();
        const links = await screen.findAllByRole('link', { name: /messages?/ });
        expect(links.map((a) => a.textContent)).toEqual([expect.stringContaining('Racing mind'), expect.stringContaining('Sleep routine')]);
        expect(links[0]).toHaveTextContent('2 messages');
        expect(links[1]).toHaveTextContent('1 message');
        expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    });

    it('explains an empty list', async () => {
        stub_api({ 'GET /api/chat/threads': [] });
        open('/chat');
        expect(await screen.findByText('No chats yet')).toBeInTheDocument();
    });

    it('shows a load error with a working Retry', async () => {
        stub_api({ 'GET /api/chat/threads': envelope(null, 500, 'Chats are unavailable.') });
        open('/chat');
        expect(await screen.findByRole('alert')).toHaveTextContent('Chats are unavailable.');
        stub_api({ 'GET /api/chat/threads': [racing] });
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('Racing mind')).toBeInTheDocument();
    });

    it('creates a chat and opens it', async () => {
        const created = thread({ id: 9, title: 'New chat' });
        const mock = stub_api({ 'GET /api/chat/threads': [racing], 'POST /api/chat/threads': created, 'GET /api/chat/threads/9': { thread: created, messages: [] } });
        open('/chat');
        fireEvent.click(await screen.findByRole('button', { name: 'New chat' }));
        expect(await screen.findByText('Ask anything about your therapy')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => c[0] === '/api/chat/threads/9')).toBe(true);
        expect(textbox()).toBeInTheDocument();
    });

    it('New chat reopens an untouched empty thread instead of creating another', async () => {
        const empty = thread({ id: 5, title: 'New chat', message_count: 0 });
        const mock = stub_api({ 'GET /api/chat/threads': [racing, empty], 'GET /api/chat/threads/5': { thread: empty, messages: [] } });
        open('/chat');
        fireEvent.click(await screen.findByRole('button', { name: 'New chat' }));
        expect(await screen.findByText('Ask anything about your therapy')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(false);
    });
});

/* A row's Delete lives in its overflow menu: open it, then choose Delete chat. */
const delete_via_menu = async (title: string) => {
    fireEvent.click(await screen.findByRole('button', { name: `Chat actions: ${title}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete chat' }));
};

describe('Chat: deleting', () => {
    it('asks first, and does nothing on Cancel', async () => {
        const mock = stub_api({ 'GET /api/chat/threads': [racing, sleep] });
        open('/chat');
        await delete_via_menu('Sleep routine');
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Sleep routine');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
    });

    it('deletes after confirmation and removes the row', async () => {
        const mock = stub_api({ 'GET /api/chat/threads': [racing, sleep], 'DELETE /api/chat/threads/2': {} });
        open('/chat');
        await delete_via_menu('Sleep routine');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete chat' }));
        await waitFor(() => expect(screen.queryByText('Sleep routine')).toBeNull());
        expect(mock.mock.calls.some((c) => c[0] === '/api/chat/threads/2' && (c[1] as RequestInit).method === 'DELETE')).toBe(true);
        expect(screen.getByText('Racing mind')).toBeInTheDocument();
    });

    it('leaves the conversation when its own thread is deleted', async () => {
        stub_api({ 'GET /api/chat/threads': [racing], 'GET /api/chat/threads/1': { thread: racing, messages: history }, 'DELETE /api/chat/threads/1': {} });
        open('/chat/1');
        await screen.findByText('What helps?');
        fireEvent.click(screen.getByRole('button', { name: 'Chat actions' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete chat' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete chat' }));
        expect(await screen.findByText('Pick a chat')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
    });

    it('shows why a delete failed and keeps the row', async () => {
        stub_api({ 'GET /api/chat/threads': [racing], 'DELETE /api/chat/threads/1': envelope(null, 500, 'Could not delete the chat.') });
        open('/chat');
        await delete_via_menu('Racing mind');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete chat' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the chat.');
        expect(screen.getByText('Racing mind')).toBeInTheDocument();
    });
});
