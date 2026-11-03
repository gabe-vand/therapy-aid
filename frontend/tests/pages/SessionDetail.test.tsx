import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SessionDetail from '@/pages/SessionDetail';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { render_with_targets } from '../helpers/hlp-routes';
import { session } from '../helpers/hlp-sessions';

const mount = () => render_with_targets(<SessionDetail />, { path: '/sessions/4', pattern: '/sessions/:id', targets: ['/sessions'] });

describe('SessionDetail ready', () => {
    it('shows skeletons first', async () => {
        stub_api({ 'GET /api/sessions/4': session() });
        mount();
        expect(screen.getByRole('status', { name: /loading session/i })).toBeInTheDocument();
        await screen.findByRole('heading', { level: 1 });
    });

    it('renders title, overview markdown, key points, David’s advice and problem updates', async () => {
        stub_api({
            'GET /api/sessions/4': session({
                problem_updates: [
                    { problem_id: 3, problem_title: 'Sleep and the racing mind', body: 'Tried the wind-down routine.', is_new_problem: false },
                    { problem_id: 9, problem_title: 'Avoiding hard talks', body: 'First time this came up.', is_new_problem: true },
                ],
            }),
        });
        mount();
        expect(await screen.findByRole('heading', { level: 1, name: 'Racing mind, ADHD, morning structure' })).toBeInTheDocument();
        expect(screen.getByText('racing mind').tagName).toBe('STRONG');
        expect(screen.getByText('Mornings set the tone')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What David suggested' })).toBeInTheDocument();
        expect(screen.getByText(/first task before bed/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sleep and the racing mind' })).toHaveAttribute('href', '/problems/3');
        const fresh = screen.getByRole('link', { name: 'Avoiding hard talks' }).parentElement!;
        expect(within(fresh).getByText('new')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: /processing/i })).not.toBeInTheDocument();
    });

    it('offers the transcript or the notes as a collapsible', async () => {
        stub_api({ 'GET /api/sessions/4': session({ source: 'recording', transcript: '[00:03] Speaker 0: Hello', notes: null }) });
        mount();
        expect(await screen.findByText('Transcript')).toBeInTheDocument();
        expect(screen.getByText(/Speaker 0: Hello/)).toBeInTheDocument();
        expect(screen.queryByText('Notes as written')).not.toBeInTheDocument();
    });

    it('edits the title and date with one PATCH of only what changed', async () => {
        const mock = stub_api({ 'GET /api/sessions/4': session(), 'PATCH /api/sessions/4': session({ title: 'Renamed' }) });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: /edit title and date/i }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Renamed' })).toBeInTheDocument();
        expect(sent_body(mock, 1)).toEqual({ title: 'Renamed' });
    });

    it('keeps the form open and shows the message when saving fails', async () => {
        stub_api({ 'GET /api/sessions/4': session(), 'PATCH /api/sessions/4': envelope(null, 400, 'title: Too long.') });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: /edit title and date/i }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('title: Too long.');
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    it('Delete asks first, then removes the session and returns to the list', async () => {
        const mock = stub_api({ 'GET /api/sessions/4': session(), 'DELETE /api/sessions/4': { id: 4 } });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Delete session' }));
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
        expect(await screen.findByText('at /sessions')).toBeInTheDocument();
    });

    it('cancelling the delete leaves the session alone', async () => {
        stub_api({ 'GET /api/sessions/4': session() });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Delete session' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
});

describe('SessionDetail processing and failure', () => {
    it('shows the stepper with the current step while processing', async () => {
        stub_api({ 'GET /api/sessions/4': session({ status: 'transcribing', source: 'recording', title: null, summary: null }) });
        mount();
        const steps = await screen.findByRole('list', { name: /processing progress/i });
        const items = within(steps).getAllByRole('listitem');
        expect(items.map((li) => li.textContent?.replace(/^\S\s*/, ''))).toEqual(['Uploaded', 'Transcribing', 'Summarizing', 'Ready']);
        expect(items[0]).toHaveAttribute('data-state', 'done');
        expect(items[1]).toHaveAttribute('data-state', 'current');
        expect(items[2]).toHaveAttribute('data-state', 'todo');
        expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    });

    it('a notes session has no transcribing step', async () => {
        stub_api({ 'GET /api/sessions/4': session({ status: 'summarizing', title: null, summary: null }) });
        mount();
        const steps = await screen.findByRole('list', { name: /processing progress/i });
        expect(within(steps).queryByText('Transcribing')).not.toBeInTheDocument();
    });

    it('failed shows the reason and Retry resumes polling', async () => {
        let status = 'failed';
        stub_api({
            'GET /api/sessions/4': () => (status === 'failed' ? session({ status: 'failed', error: 'Transcription is not configured (DEEPGRAM_API_KEY).', source: 'recording', summary: null }) : session({ source: 'recording' })),
            'POST /api/sessions/4/retry': () => {
                status = 'ready';
                return session();
            },
        });
        mount();
        expect(await screen.findByText(/Transcription is not configured/)).toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: /processing progress/i })).getAllByRole('listitem')[1]).toHaveAttribute('data-state', 'failed');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(screen.queryByText(/Transcription is not configured/)).not.toBeInTheDocument());
        expect(await screen.findByText('Overview')).toBeInTheDocument();
    });
});

describe('SessionDetail errors', () => {
    it('shows not-found with a retry', async () => {
        stub_api({ 'GET /api/sessions/4': envelope(null, 404, 'Session not found.') });
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('Session not found.');
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /sessions/i })).toHaveAttribute('href', '/sessions');
    });
});
