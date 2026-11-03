import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sent_body, stub_api, stub_unreachable } from '../helpers/hlp-fetch';
import { requests, show, tick, type } from '../helpers/hlp-journal-page';
import { entry } from '../helpers/hlp-problems-journal';

/* The Journal page: the month-grouped list, opening entries, autosave, back and delete. The editor is the textarea stub (hlp-rich-editor.tsx). Timers are faked but advance with
   real time, so findBy* still works; autosave waits are explicit advances inside act(). */
vi.mock('@/components/journal/RichEditor', () => import('../helpers/hlp-rich-editor'));

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
    vi.useRealTimers();
});

describe('Journal page: list', () => {
    it('lists entries newest first with date and first line', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 2, occurred_at: '2026-10-13T12:00:00.000Z', body: '\nRough night\nmore' }), entry({ id: 1, occurred_at: '2026-10-01T12:00:00.000Z', body: 'Calm morning' })] });
        show();
        const nav = await screen.findByRole('navigation', { name: 'Journal entries' });
        const rows = within(nav).getAllByRole('link');
        expect(within(nav).getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
        expect(rows[0]).toHaveTextContent('Tue, Oct 13');
        expect(rows[0]).toHaveTextContent('Rough night');
        expect(rows[0]).toHaveAttribute('href', '/journal/2');
        expect(rows[1]).toHaveTextContent('Calm morning');
    });

    it('previews entries as plain text and shows the insight count', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 3, body: '## **Big** day\n\n- one', insight_count: 2 })] });
        show();
        const row = await screen.findByRole('link', { name: /Big day/ });
        expect(row).not.toHaveTextContent('#');
        expect(within(row).getByLabelText('2 notes')).toHaveTextContent('2');
    });

    it('shows a quiet empty editor pane with a way to start writing', async () => {
        stub_api({ 'GET /api/journal': [entry()] });
        show();
        await screen.findByRole('link', { name: /Rough night/ });
        expect(screen.getByText('Write today’s entry')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start writing' }));
        expect(screen.getByRole('textbox', { name: 'Journal entry' })).toHaveValue('');
    });

    it('has an empty state and an error state with retry', async () => {
        stub_api({ 'GET /api/journal': [] });
        const first = show();
        expect(await screen.findByText('No entries yet')).toBeInTheDocument();
        first.unmount();

        stub_unreachable();
        show();
        const alert = await screen.findByRole('alert');
        stub_api({ 'GET /api/journal': [entry()] });
        fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('link', { name: /Rough night/ })).toBeInTheDocument();
    });
});

describe('Journal page: editor and autosave', () => {
    it('opens an entry from the list into the editor with its date', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 5 })], 'GET /api/journal/5': entry({ id: 5, body: 'Rough night.' }), 'GET /api/journal/5/insights': [] });
        show();
        fireEvent.click(await screen.findByRole('link', { name: /Rough night/ }));
        expect(await screen.findByRole('textbox', { name: 'Journal entry' })).toHaveValue('Rough night.');
        expect(screen.getByLabelText('Entry date')).toHaveValue('2026-10-13');
        expect(screen.getByTestId('where')).toHaveTextContent('/journal/5');
    });

    it('PATCHes 1.5s after the last keystroke and shows Saving… then Saved', async () => {
        const mock = stub_api({ 'GET /api/journal': [entry({ id: 5 })], 'GET /api/journal/5': entry({ id: 5, body: 'Hi' }), 'GET /api/journal/5/insights': [], 'PATCH /api/journal/5': entry({ id: 5 }) });
        show('/journal/5');
        await screen.findByDisplayValue('Hi');
        // Load is done: from here the clock is fully manual. With shouldAdvanceTime a slow CI/load
        // pause let real time leak into the 1499ms step and fire the PATCH early.
        vi.useRealTimers();
        vi.useFakeTimers();
        type('Hi there');
        expect(screen.getByRole('status')).toHaveTextContent('Saving…');
        await tick(1499);
        expect(requests(mock)).not.toContain('PATCH /api/journal/5');
        await tick(1);
        await tick(0); // let the stubbed fetch and the state updates behind it settle
        expect(screen.getByRole('status')).toHaveTextContent('Saved');
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/journal/5'))).toEqual({ body: 'Hi there' });
    });

    it('a new entry is created on the first keystroke, the URL follows, and typing carries on', async () => {
        const mock = stub_api({
            'GET /api/journal': [],
            'POST /api/journal': (init?: RequestInit) => entry({ id: 31, body: (JSON.parse(String(init?.body)) as { body: string }).body }),
            'GET /api/journal/31/insights': [],
            'PATCH /api/journal/31': (init?: RequestInit) => entry({ id: 31, body: (JSON.parse(String(init?.body)) as { body: string }).body }),
        });
        show();
        await screen.findByText('No entries yet');
        fireEvent.click(screen.getByRole('button', { name: 'New entry' }));
        const box = screen.getByRole('textbox', { name: 'Journal entry' });
        fireEvent.change(box, { target: { value: 'F' } });
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/journal/31'));
        expect(requests(mock).filter((r) => r.startsWith('POST'))).toEqual(['POST /api/journal']);

        // Same textarea element: the editor was not remounted by the URL change.
        expect(screen.getByRole('textbox', { name: 'Journal entry' })).toBe(box);
        type('First thoughts');
        await tick(1500);
        await waitFor(() => expect(requests(mock)).toContain('PATCH /api/journal/31'));
        expect(requests(mock).filter((r) => r.startsWith('GET /api/journal/31') && !r.endsWith('insights'))).toHaveLength(0);
        expect(screen.getByRole('textbox', { name: 'Journal entry' })).toHaveValue('First thoughts');
        expect(screen.getByRole('link', { name: /First thoughts/ })).toBeInTheDocument();
    });

    it('has a way back to the list on small screens', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 5 })], 'GET /api/journal/5': entry({ id: 5 }), 'GET /api/journal/5/insights': [] });
        show('/journal/5');
        fireEvent.click(await screen.findByRole('button', { name: 'Entries' }));
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/journal$/);
    });

    it('deletes an entry only after confirmation and removes it from the list', async () => {
        const mock = stub_api({ 'GET /api/journal': [entry({ id: 5, body: 'Doomed entry' })], 'GET /api/journal/5': entry({ id: 5, body: 'Doomed entry' }), 'GET /api/journal/5/insights': [], 'DELETE /api/journal/5': {} });
        show('/journal/5');
        await screen.findByDisplayValue('Doomed entry');
        const delete_from_menu = () => {
            fireEvent.click(screen.getByRole('button', { name: 'Entry actions' }));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Delete entry' }));
        };
        delete_from_menu();
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(requests(mock)).not.toContain('DELETE /api/journal/5');
        delete_from_menu();
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(requests(mock)).toContain('DELETE /api/journal/5'));
        await waitFor(() => expect(screen.queryByRole('link', { name: /Doomed entry/ })).not.toBeInTheDocument());
    });
});

describe('Journal page: deep link', () => {
    it('opens a blank entry for /journal?new=1 and cleans the URL', async () => {
        vi.mock('@/components/journal/RichEditor', () => import('../helpers/hlp-rich-editor'));
        stub_api({ 'GET /api/journal': [entry()] });
        show('/journal?new=1');
        expect(await screen.findByRole('textbox', { name: 'Journal entry' })).toHaveValue('');
        expect(screen.getByTestId('where')).toHaveTextContent('/journal');
    });
});
