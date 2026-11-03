import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Sessions from '@/pages/Sessions';
import { envelope, stub_api, stub_unreachable } from '../helpers/hlp-fetch';
import { list_item } from '../helpers/hlp-sessions';
import { render_at } from '../helpers/hlp-render';

describe('Sessions page', () => {
    it('shows skeletons while loading', async () => {
        stub_api({ 'GET /api/sessions': [] });
        render_at(<Sessions />, { path: '/sessions' });
        expect(screen.getByRole('status', { name: /loading sessions/i })).toBeInTheDocument();
        await screen.findByText('No sessions yet');
    });

    it('groups sessions under month headings, each row linking to its session', async () => {
        stub_api({
            'GET /api/sessions': [
                list_item({ id: 3, title: 'October one', occurred_at: '2026-10-15T16:00:00.000Z' }),
                list_item({ id: 2, title: 'September two', occurred_at: '2026-09-20T16:00:00.000Z', status: 'summarizing' }),
                list_item({ id: 1, title: null, occurred_at: '2026-09-02T16:00:00.000Z', source: 'recording', status: 'failed' }),
            ],
        });
        render_at(<Sessions />, { path: '/sessions' });
        const october = await screen.findByRole('region', { name: 'October 2026' });
        const september = screen.getByRole('region', { name: 'September 2026' });
        expect(within(october).getAllByRole('link')).toHaveLength(1);
        expect(within(september).getAllByRole('link')).toHaveLength(2);
        expect(within(october).getByRole('link', { name: /October one/ })).toHaveAttribute('href', '/sessions/3');
        expect(within(september).getByText('Summarizing')).toBeInTheDocument();
        expect(within(september).getByText('Failed')).toBeInTheDocument();
        expect(within(september).getByText('Untitled session')).toBeInTheDocument();
    });

    it('draws a timeline node per session, coloured by its status', async () => {
        stub_api({ 'GET /api/sessions': [list_item({ id: 4, status: 'ready' }), list_item({ id: 3, status: 'transcribing' }), list_item({ id: 2, status: 'failed' }), list_item({ id: 1, status: 'recording' })] });
        const { container } = render_at(<Sessions />, { path: '/sessions' });
        await screen.findByRole('region');
        expect([...container.querySelectorAll('.ta-tl__node')].map((n) => n.getAttribute('data-node'))).toEqual(['ready', 'processing', 'failed', 'idle']);
    });

    it('subtitles the list with the rhythm, adding the usual gap from the dashboard', async () => {
        stub_api({
            'GET /api/sessions': [list_item({ id: 2, occurred_at: '2026-09-11T16:00:00.000Z' }), list_item({ id: 1, occurred_at: '2026-08-06T16:00:00.000Z' })],
            'GET /api/dashboard': { sessions: { total: 2, axis: [], last: null, typical_gap_days: 14 }, threads: [], journal: { entries_30d: 0, words_7d: 0, streak_days: 0, last_entry: null, themes: [] }, since_last_session: null },
        });
        render_at(<Sessions />, { path: '/sessions' });
        expect(await screen.findByText(/^2 sessions since Aug 6 · usually every 2 weeks · last one/)).toBeInTheDocument();
    });

    it('offers both ways in from the header', async () => {
        stub_api({ 'GET /api/sessions': [list_item()] });
        render_at(<Sessions />, { path: '/sessions' });
        await screen.findByRole('region');
        expect(screen.getByRole('link', { name: 'Record' })).toHaveAttribute('href', '/sessions/record');
        expect(screen.getByRole('link', { name: 'Add notes' })).toHaveAttribute('href', '/sessions/notes');
    });

    it('explains the empty state', async () => {
        stub_api({ 'GET /api/sessions': [] });
        render_at(<Sessions />, { path: '/sessions' });
        expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Record a session' })).toBeInTheDocument();
    });

    it('shows the error with a working Retry', async () => {
        stub_api({ 'GET /api/sessions': envelope(null, 500, 'Database is busy.') });
        render_at(<Sessions />, { path: '/sessions' });
        expect(await screen.findByRole('alert')).toHaveTextContent('Database is busy.');
        stub_api({ 'GET /api/sessions': [list_item()] });
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(screen.getByRole('region')).toBeInTheDocument());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so when the server is unreachable', async () => {
        stub_unreachable();
        render_at(<Sessions />, { path: '/sessions' });
        expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    });
});
