import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/pages/Home';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { dashboard, home_routes, thread } from '../helpers/hlp-home';
import { render_at } from '../helpers/hlp-render';
import { problem } from '../helpers/hlp-sessions';

/* Home's dashboard blocks: the Threads dot grid (with inline Keep / Discard on stale rows), the
   Rhythm stat tiles, the journal themes and the last session's advice — each with its empty,
   loading and error states. */

const mount = () => render_at(<Home />, { path: '/' });
const threads = async () => within(await screen.findByRole('region', { name: 'Threads' }));
const stale_problem = problem({ id: 5, title: 'Avoiding hard conversations', is_stale: true });
const no_sessions = { total: 0, axis: [], last: null, typical_gap_days: null };

describe('Home threads', () => {
    it('draws one row per active problem with a dot per session, filled where it was discussed', async () => {
        stub_api(home_routes());
        mount();
        const t = await threads();
        expect(await t.findByRole('link', { name: 'Sleep and the racing mind' })).toHaveAttribute('href', '/problems/3');
        const dots = t.getByRole('img', { name: 'Discussed in 2 of 3 sessions' });
        expect(dots.querySelectorAll('.ta-dot')).toHaveLength(3);
        expect(dots.querySelectorAll('.ta-dot--on')).toHaveLength(2);
        expect(t.getByText('4 journal mentions')).toBeInTheDocument();
        expect(t.getByText(/last 3 sessions/)).toBeInTheDocument();
    });

    it('flags a stale thread, and Keep reloads the grid', async () => {
        let kept = false;
        const mock = stub_api(
            home_routes({
                'GET /api/problems': [stale_problem],
                'GET /api/dashboard': () => (kept ? dashboard({ threads: [thread({ id: 5, title: 'Avoiding hard conversations' })] }) : dashboard()),
                'POST /api/problems/5/keep': () => {
                    kept = true;
                    return stale_problem;
                },
            }),
        );
        mount();
        const t = await threads();
        expect(await t.findByText('quiet 5w')).toBeInTheDocument();
        fireEvent.click(t.getByRole('button', { name: 'Keep Avoiding hard conversations' }));
        await waitFor(() => expect(t.queryByText(/^quiet/)).not.toBeInTheDocument());
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/problems/5/keep'))).toBe(true);
    });

    it('Discard asks first, then PATCHes status discarded', async () => {
        const mock = stub_api(home_routes({ 'GET /api/problems': [stale_problem], 'PATCH /api/problems/5': problem({ id: 5, status: 'discarded' }) }));
        mount();
        const t = await threads();
        fireEvent.click(await t.findByRole('button', { name: 'Discard Avoiding hard conversations' }));
        const dialog = await screen.findByRole('dialog');
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')).toBe(false);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const patch = mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');
        expect(sent_body(mock, patch)).toEqual({ status: 'discarded' });
    });

    it('cancelling the discard dialog changes nothing', async () => {
        stub_api(home_routes({ 'GET /api/problems': [stale_problem] }));
        mount();
        const t = await threads();
        fireEvent.click(await t.findByRole('button', { name: 'Discard Avoiding hard conversations' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(t.getByText('quiet 5w')).toBeInTheDocument();
    });

    it('explains the empty grid', async () => {
        stub_api(home_routes({ 'GET /api/dashboard': dashboard({ threads: [] }) }));
        mount();
        expect(await screen.findByText('Problems appear as sessions are summarised.')).toBeInTheDocument();
    });

    it('a dashboard error shows once with Retry, and the focus still renders', async () => {
        stub_api(home_routes({ 'GET /api/dashboard': envelope(null, 500, 'Dashboard is down.') }));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard is down.');
        expect(await screen.findByText('Protect your mornings this week.')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Rhythm' })).not.toBeInTheDocument();
        stub_api(home_routes());
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('region', { name: 'Rhythm' })).toBeInTheDocument();
    });
});

describe('Home rhythm, themes and last session', () => {
    it('shows the last session (due against the usual gap), journal numbers and what happened since', async () => {
        stub_api(home_routes({ 'GET /api/dashboard': dashboard({ sessions: { ...dashboard().sessions, typical_gap_days: 7 } }) }));
        mount();
        const r = within(await screen.findByRole('region', { name: 'Rhythm' }));
        expect(r.getByText('11 days ago · usually every 7 days')).toBeInTheDocument();
        expect(r.getByText('due')).toBeInTheDocument();
        expect(r.getByText('streak 3 days · 1,250 words this week')).toBeInTheDocument();
        expect(r.getByText('margin notes')).toBeInTheDocument();
    });

    it('is not due inside the usual gap, and hides "since" before any session', async () => {
        stub_api(home_routes({ 'GET /api/dashboard': dashboard({ since_last_session: null }) }));
        mount();
        const r = within(await screen.findByRole('region', { name: 'Rhythm' }));
        expect(r.queryByText('due')).not.toBeInTheDocument();
        expect(r.queryByText('Since your last session')).not.toBeInTheDocument();
    });

    it('lists journal themes as bars linking to the problem, and hides the block without themes', async () => {
        stub_api(home_routes());
        const { unmount } = mount();
        const themes = within(await screen.findByRole('region', { name: 'In your journal lately' }));
        expect(themes.getByRole('link', { name: /Sleep and the racing mind/ })).toHaveAttribute('href', '/problems/3');
        unmount();
        stub_api(home_routes({ 'GET /api/dashboard': dashboard({ journal: { ...dashboard().journal, themes: [] } }) }));
        mount();
        await screen.findByRole('region', { name: 'Rhythm' });
        expect(screen.queryByRole('region', { name: 'In your journal lately' })).not.toBeInTheDocument();
    });

    it('shows what David suggested last session, and nothing before the first one', async () => {
        stub_api(home_routes());
        const { unmount } = mount();
        const last = within(await screen.findByRole('region', { name: 'From your last session' }));
        expect(last.getByText('Keep the phone out of the bedroom')).toBeInTheDocument();
        expect(last.getByRole('link', { name: /Open session/ })).toHaveAttribute('href', '/sessions/4');
        unmount();
        stub_api(home_routes({ 'GET /api/dashboard': dashboard({ sessions: no_sessions, since_last_session: null }) }));
        mount();
        await screen.findByRole('region', { name: 'Rhythm' });
        expect(screen.queryByRole('region', { name: 'From your last session' })).not.toBeInTheDocument();
    });
});
