import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UploadNotes from '@/pages/UploadNotes';
import { today_input } from '@/services/dates';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { render_with_targets } from '../helpers/hlp-routes';
import { session } from '../helpers/hlp-sessions';

const mount = () => render_with_targets(<UploadNotes />, { path: '/sessions/notes', pattern: '/sessions/notes', targets: ['/sessions/12', '/sessions'] });
const type_notes = (text: string) => fireEvent.change(screen.getByLabelText('Notes'), { target: { value: text } });

describe('UploadNotes page', () => {
    it('defaults the date to today and disables submit until there are notes', () => {
        mount();
        expect(screen.getByLabelText(/date of the session/i)).toHaveValue(today_input());
        expect(screen.getByRole('button', { name: /summarize/i })).toBeDisabled();
        type_notes('   ');
        expect(screen.getByRole('button', { name: /summarize/i })).toBeDisabled();
        type_notes('We talked about sleep.');
        expect(screen.getByRole('button', { name: /summarize/i })).toBeEnabled();
    });

    it('submits date, title and notes, then opens the new session', async () => {
        const mock = stub_api({ 'POST /api/sessions/notes': session({ id: 12, status: 'uploaded' }) });
        mount();
        fireEvent.change(screen.getByLabelText(/date of the session/i), { target: { value: '2026-09-11' } });
        fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Sleep talk' } });
        type_notes('We talked about sleep.');
        fireEvent.click(screen.getByRole('button', { name: /summarize/i }));
        expect(await screen.findByText('at /sessions/12')).toBeInTheDocument();
        expect(sent_body(mock)).toMatchObject({ notes: 'We talked about sleep.', title: 'Sleep talk' });
    });

    it('keeps the text and shows the server message when saving fails', async () => {
        stub_api({ 'POST /api/sessions/notes': envelope(null, 400, 'notes: Too long.') });
        mount();
        type_notes('Some notes');
        fireEvent.click(screen.getByRole('button', { name: /summarize/i }));
        expect(await screen.findByRole('alert')).toHaveTextContent('notes: Too long.');
        expect(screen.getByLabelText('Notes')).toHaveValue('Some notes');
        await waitFor(() => expect(screen.getByRole('button', { name: /summarize/i })).toBeEnabled());
    });

    it('counts words and characters as you type', () => {
        mount();
        expect(screen.getByText('0 words · 0 characters')).toBeInTheDocument();
        type_notes('We talked about sleep.');
        expect(screen.getByText('4 words · 22 characters')).toBeInTheDocument();
        expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-describedby', 'notes-count');
    });

    it('Cancel goes back to the list', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(await screen.findByText('at /sessions')).toBeInTheDocument();
    });
});
