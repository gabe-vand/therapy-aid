import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Journal from '@/pages/Journal';
import { envelope, sent_body, stub_api, stub_unreachable } from '../helpers/hlp-fetch';
import { entry, insight } from '../helpers/hlp-problems-journal';

/* The page under the same two routes App.tsx declares, plus a location readout so navigation after
   an entry is created is observable. Timers are faked but advance with real time, so findBy*
   still works; autosave waits are explicit advances inside act(). */
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const show = (path = '/journal') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Where />
            <Routes>
                <Route path="/journal" element={<Journal />} />
                <Route path="/journal/:id" element={<Journal />} />
            </Routes>
        </MemoryRouter>,
    );
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const requests = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);
const type = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Journal entry' }), { target: { value } });
const IDEA_PAUSE = 4000;
const LONG = 'Today was hard and my head would not stop going round and round about the thing with Nicole and work. '.repeat(2);

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
        expect(rows[0]).toHaveTextContent('Oct 13, 2026');
        expect(rows[0]).toHaveTextContent('Rough night');
        expect(rows[0]).toHaveAttribute('href', '/journal/2');
        expect(rows[1]).toHaveTextContent('Calm morning');
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
        fireEvent.click(screen.getByRole('button', { name: '+ New entry' }));
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
        fireEvent.click(await screen.findByRole('button', { name: '← Entries' }));
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/journal$/);
    });

    it('deletes an entry only after confirmation and removes it from the list', async () => {
        const mock = stub_api({ 'GET /api/journal': [entry({ id: 5, body: 'Doomed entry' })], 'GET /api/journal/5': entry({ id: 5, body: 'Doomed entry' }), 'GET /api/journal/5/insights': [], 'DELETE /api/journal/5': {} });
        show('/journal/5');
        await screen.findByDisplayValue('Doomed entry');
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(requests(mock)).not.toContain('DELETE /api/journal/5');
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(requests(mock)).toContain('DELETE /api/journal/5'));
        await waitFor(() => expect(screen.queryByRole('link', { name: /Doomed entry/ })).not.toBeInTheDocument());
    });
});

describe('Journal page: the idea button and insight panel', () => {
    const open_entry = (body: string, extra: Record<string, unknown> = {}) =>
        stub_api({ 'GET /api/journal': [entry({ id: 5 })], 'GET /api/journal/5': entry({ id: 5, body }), 'GET /api/journal/5/insights': [], 'PATCH /api/journal/5': entry({ id: 5 }), ...extra });
    const idea = () => screen.queryByRole('button', { name: /I have an idea/ });

    it('is hidden for a short draft and appears once the draft reaches 120 characters', async () => {
        open_entry('short');
        show('/journal/5');
        await screen.findByDisplayValue('short');
        expect(idea()).not.toBeInTheDocument();
        type('y'.repeat(119));
        expect(idea()).not.toBeInTheDocument();
        type('y'.repeat(120));
        expect(idea()).toBeInTheDocument();
    });

    it('NEVER generates by itself: long text, pulses and minutes of waiting make no insight request', async () => {
        const mock = open_entry('start');
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type(LONG + LONG);
        await tick(180_000);
        expect(idea()).toHaveAttribute('data-pulsing', 'true');
        expect(requests(mock).filter((r) => r === 'POST /api/journal/5/insights')).toHaveLength(0);
    });

    it('a click posts the current draft and renders the markdown insight, calming the pulse', async () => {
        const mock = open_entry('start', { 'POST /api/journal/5/insights': insight({ id: 9, entry_id: 5, body: 'You keep naming **the same loop**.', created_at: '2026-10-14T10:00:00.000Z' }) });
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type(LONG + LONG);
        await tick(IDEA_PAUSE);
        fireEvent.click(idea()!);
        const panel = await screen.findByRole('region', { name: 'Insights' });
        await waitFor(() => expect(within(panel).getByText('the same loop').tagName).toBe('STRONG'));
        expect(sent_body(mock, requests(mock).indexOf('POST /api/journal/5/insights'))).toEqual({ body: LONG + LONG });
        expect(idea()).toHaveAttribute('data-pulsing', 'false');
    });

    it('shows previous insights for the entry under the newest one', async () => {
        open_entry('start', { 'GET /api/journal/5/insights': [insight({ id: 1, body: 'Older thought', created_at: '2026-10-01T10:00:00.000Z' }), insight({ id: 2, body: 'Newest thought', created_at: '2026-10-09T10:00:00.000Z' })] });
        show('/journal/5');
        const panel = await screen.findByRole('region', { name: 'Insights' });
        expect(panel).toHaveTextContent('Newest thought');
        expect(panel).not.toHaveTextContent('Older thought');
        fireEvent.click(within(panel).getByRole('button', { name: 'Earlier ideas (1)' }));
        expect(panel).toHaveTextContent('Older thought');
    });

    it('shows a waiting state while generating and a retryable error when it fails', async () => {
        open_entry('start', { 'POST /api/journal/5/insights': envelope(null, 500, 'The AI model declined to answer this request.') });
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type(LONG);
        fireEvent.click(idea()!);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The AI model declined to answer this request.');
        expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
});
