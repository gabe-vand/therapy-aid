import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProblemDetail from '@/pages/ProblemDetail';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { problem_detail, update } from '../helpers/hlp-problems-journal';

const requests = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);

/* The page is mounted with a sibling /problems route so a discard's navigation is observable. */
const show = () =>
    render(
        <MemoryRouter initialEntries={['/problems/1']}>
            <Routes>
                <Route path="/problems/:id" element={<ProblemDetail />} />
                <Route path="/problems" element={<p>PROBLEMS LIST</p>} />
            </Routes>
        </MemoryRouter>,
    );

describe('ProblemDetail page', () => {
    it('renders the title, description and a loading state first', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail({ title: 'Racing mind', description: 'Spirals at night.' }) });
        show();
        expect(screen.getByRole('status', { name: 'Loading problem' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { level: 1, name: 'Racing mind' })).toBeInTheDocument();
        expect(screen.getByText('Spirals at night.')).toBeInTheDocument();
    });

    it('renders the timeline: session link, Your note chip, body and date', async () => {
        stub_api({
            'GET /api/problems/1': problem_detail({
                updates: [
                    update({ id: 2, source: 'manual', session_id: null, session_title: null, body: 'Tried breathing before bed.', created_at: '2026-10-25T12:00:00.000Z' }),
                    update({ id: 1, session_id: 4, session_title: 'Racing mind, morning structure', body: 'David suggested a wind-down routine.', created_at: '2026-10-20T12:00:00.000Z' }),
                ],
            }),
        });
        show();
        const timeline = await screen.findByRole('list', { name: 'Timeline' });
        const items = within(timeline).getAllByRole('listitem');
        expect(items).toHaveLength(2);

        expect(items[0]).toHaveTextContent('Tried breathing before bed.');
        expect(items[0]).toHaveTextContent('Your note');
        expect(within(items[0]!).queryByRole('link')).not.toBeInTheDocument();
        expect(items[0]).toHaveTextContent('Oct 25, 2026');

        expect(items[1]).toHaveTextContent('David suggested a wind-down routine.');
        expect(items[1]).not.toHaveTextContent('Your note');
        expect(items[1]).toHaveTextContent('Session');
        expect(within(items[1]!).getByRole('link', { name: 'Racing mind, morning structure' })).toHaveAttribute('href', '/sessions/4');
    });

    it('shows a friendly error when the problem is gone', async () => {
        stub_api({ 'GET /api/problems/1': envelope(null, 404, 'ENTRY_NOT_FOUND') });
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent('This problem no longer exists.');
    });

    it('edits the title inline and PATCHes only the title', async () => {
        let title = 'Racing mind';
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ title }),
            'PATCH /api/problems/1': (init?: RequestInit) => {
                title = (JSON.parse(String(init?.body)) as { title: string }).title;
                return {};
            },
        });
        show();
        await screen.findByRole('heading', { name: 'Racing mind' });
        fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));
        fireEvent.change(screen.getByLabelText('title'), { target: { value: '  Racing mind at night ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save title' }));
        expect(await screen.findByRole('heading', { name: 'Racing mind at night' })).toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/1'))).toEqual({ title: 'Racing mind at night' });
    });

    it('will not save a blank title', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail() });
        show();
        await screen.findByRole('heading', { level: 1 });
        fireEvent.click(screen.getByRole('button', { name: 'Edit title' }));
        fireEvent.change(screen.getByLabelText('title'), { target: { value: '   ' } });
        expect(screen.getByRole('button', { name: 'Save title' })).toBeDisabled();
    });

    it('edits the description inline', async () => {
        let description = 'old';
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ description }),
            'PATCH /api/problems/1': (init?: RequestInit) => {
                description = (JSON.parse(String(init?.body)) as { description: string }).description;
                return {};
            },
        });
        show();
        await screen.findByText('old');
        fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
        fireEvent.change(screen.getByLabelText('description'), { target: { value: 'a new sentence' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save description' }));
        // The textarea's own text matches too, so wait for the read-only paragraph.
        await waitFor(() => expect(screen.getByText('a new sentence').tagName).toBe('P'));
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/1'))).toEqual({ description: 'a new sentence' });
    });

    it('Resolve asks first; Cancel sends nothing, Confirm PATCHes status resolved and offers Reopen', async () => {
        let status = 'active';
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ status: status as 'active' | 'resolved' }),
            'PATCH /api/problems/1': (init?: RequestInit) => {
                status = (JSON.parse(String(init?.body)) as { status: string }).status;
                return {};
            },
        });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Mark this problem resolved?');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(requests(mock).some((r) => r.startsWith('PATCH'))).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resolve' }));
        expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/1'))).toEqual({ status: 'resolved' });
        expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('Reopen needs no confirmation', async () => {
        const mock = stub_api({ 'GET /api/problems/1': problem_detail({ status: 'resolved' }), 'PATCH /api/problems/1': {} });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Reopen' }));
        await waitFor(() => expect(requests(mock)).toContain('PATCH /api/problems/1'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/1'))).toEqual({ status: 'active' });
    });

    it('Discard asks first, then PATCHes and returns to the list', async () => {
        const mock = stub_api({ 'GET /api/problems/1': problem_detail(), 'PATCH /api/problems/1': {} });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Discard this problem?');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
        expect(await screen.findByText('PROBLEMS LIST')).toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/1'))).toEqual({ status: 'discarded' });
    });

    it('a failed status change shows the message and stays on the page', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail(), 'PATCH /api/problems/1': envelope(null, 500, 'Could not save.') });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resolve' }));
        expect(await screen.findByText('Could not save.')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('a stale problem offers Keep', async () => {
        const mock = stub_api({ 'GET /api/problems/1': problem_detail({ is_stale: true }), 'POST /api/problems/1/keep': {} });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Yes, keep it' }));
        await waitFor(() => expect(requests(mock)).toContain('POST /api/problems/1/keep'));
    });

    it('"Add a note" posts a manual note, clears the box, and shows it in the timeline', async () => {
        let updates = [update({ id: 1 })];
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ updates }),
            'POST /api/problems/1/updates': (init?: RequestInit) => {
                updates = [update({ id: 2, source: 'manual', session_id: null, session_title: null, body: (JSON.parse(String(init?.body)) as { body: string }).body }), ...updates];
                return {};
            },
        });
        show();
        await screen.findByRole('list', { name: 'Timeline' });
        const box = screen.getByLabelText('Add a note');
        const add = screen.getByRole('button', { name: 'Add note' });
        expect(add).toBeDisabled();
        fireEvent.change(box, { target: { value: ' Slept through the night. ' } });
        fireEvent.click(add);
        expect(await screen.findByText('Slept through the night.')).toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('POST /api/problems/1/updates'))).toEqual({ body: 'Slept through the night.' });
        await waitFor(() => expect(screen.getByLabelText('Add a note')).toHaveValue(''));
    });

    it('keeps the note text when adding fails', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail(), 'POST /api/problems/1/updates': envelope(null, 500, 'Could not save.') });
        show();
        await screen.findByRole('list', { name: 'Timeline' });
        fireEvent.change(screen.getByLabelText('Add a note'), { target: { value: 'precious text' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
        expect(await screen.findByText('Could not save.')).toBeInTheDocument();
        expect(screen.getByLabelText('Add a note')).toHaveValue('precious text');
    });
});
