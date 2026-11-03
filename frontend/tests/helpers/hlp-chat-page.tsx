import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Chat from '@/pages/Chat';
import { message, thread } from './hlp-chat';

/* Shared setup for the Chat page tests: the page mounted with both of its routes (so create and
   delete can navigate between /chat and /chat/:id), the fixtures, and composer helpers. */

export const open = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/chat" element={<Chat />} />
                <Route path="/chat/:id" element={<Chat />} />
            </Routes>
        </MemoryRouter>,
    );

export const racing = thread({ id: 1, title: 'Racing mind', message_count: 2, updated_at: '2026-10-05T00:00:00.000Z' });
export const sleep = thread({ id: 2, title: 'Sleep routine', message_count: 1, updated_at: '2026-10-01T00:00:00.000Z' });
export const history = [message({ id: 1, role: 'user', content: 'What helps?' }), message({ id: 2, role: 'assistant', content: 'David suggested a **worry list**.' })];
export const reply = { user: message({ id: 3, content: 'And at night?' }), assistant: message({ id: 4, role: 'assistant', content: 'Try the *same wake time*.' }) };

export const textbox = () => screen.getByRole('textbox', { name: 'Message' });
export const type = (text: string) => fireEvent.change(textbox(), { target: { value: text } });
