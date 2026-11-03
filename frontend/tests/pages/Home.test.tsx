import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/pages/Home';
import { envelope, stub_api } from '../helpers/hlp-fetch';
import { dashboard, home_routes } from '../helpers/hlp-home';
import { render_at } from '../helpers/hlp-render';
import { focus_snapshot } from '../helpers/hlp-sessions';

/* Home's header and the focus card's states (loading, empty before/after sessions, error,
   Refresh). The check-in board is in Home-board.test, the dashboard blocks in Home-dashboard.test. */

const mount = () => render_at(<Home />, { path: '/' });

describe('Home header', () => {
    it('greets by time of day, shows the date and the three quick actions', async () => {
        stub_api(home_routes());
        mount();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Good (morning|afternoon|evening)$/);
        const actions = within(screen.getByRole('navigation', { name: 'Quick actions' }));
        expect(actions.getByRole('link', { name: 'Record' })).toHaveAttribute('href', '/sessions/record');
        expect(actions.getByRole('link', { name: 'Add notes' })).toHaveAttribute('href', '/sessions/notes');
        expect(actions.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/journal?new=1');
        await screen.findByText('Protect your mornings this week.');
    });
});

describe('Home focus', () => {
    it('shows skeletons while the focus loads', async () => {
        stub_api(home_routes());
        mount();
        expect(screen.getByRole('status', { name: /loading your focus/i })).toBeInTheDocument();
        await screen.findByText('Protect your mornings this week.');
    });

    it('renders the headline and each item as a board row', async () => {
        stub_api(home_routes());
        mount();
        expect(await screen.findByRole('heading', { name: 'Protect your mornings this week.' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Write the first task the night before' })).toBeInTheDocument();
        expect(screen.getByText('Do it three nights this week.')).toBeInTheDocument();
        expect(screen.getByText(/^Updated /)).toBeInTheDocument();
    });

    it('before any session, points at Record and Add notes', async () => {
        stub_api(home_routes({ 'GET /api/focus': envelope(null, 200), 'GET /api/dashboard': dashboard({ sessions: { total: 0, axis: [], last: null, typical_gap_days: null }, threads: [], since_last_session: null }) }));
        mount();
        expect(await screen.findByText('Your focus will appear here')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Generate my focus' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Record a session' })).toHaveAttribute('href', '/sessions/record');
    });

    it('with sessions but no focus (a failed focus run), offers Generate my focus', async () => {
        const mock = stub_api(home_routes({ 'GET /api/focus': envelope(null, 200), 'POST /api/focus/regenerate': focus_snapshot({ headline: 'Generated at last.' }) }));
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Generate my focus' }));
        expect(await screen.findByText('Generated at last.')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/focus/regenerate'))).toBe(true);
    });

    it('a failed Generate my focus says why and keeps the button', async () => {
        stub_api(home_routes({ 'GET /api/focus': envelope(null, 200), 'POST /api/focus/regenerate': envelope(null, 500, 'ANTHROPIC_API_KEY is not set.') }));
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Generate my focus' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('ANTHROPIC_API_KEY is not set.');
        expect(screen.getByRole('button', { name: 'Generate my focus' })).toBeEnabled();
    });

    it('shows a focus error with Retry while the dashboard still renders', async () => {
        stub_api(home_routes({ 'GET /api/focus': envelope(null, 500, 'Focus is down.') }));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('Focus is down.');
        expect(await screen.findByRole('heading', { name: 'Threads' })).toBeInTheDocument();
        stub_api(home_routes());
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('Protect your mornings this week.')).toBeInTheDocument();
    });

    it('Refresh regenerates the focus', async () => {
        const mock = stub_api(home_routes({ 'POST /api/focus/regenerate': focus_snapshot({ headline: 'A brand new headline.' }) }));
        mount();
        await screen.findByText('Protect your mornings this week.');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(await screen.findByText('A brand new headline.')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/focus/regenerate'))).toBe(true);
    });

    it('a failed Refresh keeps the old focus and says why', async () => {
        stub_api(home_routes({ 'POST /api/focus/regenerate': envelope(null, 500, 'ANTHROPIC_API_KEY is not set.') }));
        mount();
        await screen.findByText('Protect your mornings this week.');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('ANTHROPIC_API_KEY is not set.');
        expect(screen.getByText('Protect your mornings this week.')).toBeInTheDocument();
    });
});
