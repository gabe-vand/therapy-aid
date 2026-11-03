import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/pages/Home';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { render_at } from '../helpers/hlp-render';
import { focus_snapshot, list_item, problem } from '../helpers/hlp-sessions';

const mount = () => render_at(<Home />, { path: '/' });
const routes = (over: Record<string, unknown> = {}) => ({ 'GET /api/focus': focus_snapshot(), 'GET /api/problems': [], 'GET /api/sessions': [list_item()], ...over });

describe('Home page', () => {
    it('shows skeletons while everything loads', async () => {
        stub_api(routes());
        mount();
        expect(screen.getByRole('status', { name: /loading your focus/i })).toBeInTheDocument();
        await screen.findByText('Protect your mornings this week.');
    });

    it('renders the focus hero, last session and the three quick actions', async () => {
        stub_api(routes());
        mount();
        expect(await screen.findByText('Protect your mornings this week.')).toBeInTheDocument();
        expect(screen.getByText('Write the first task the night before')).toBeInTheDocument();
        expect(screen.getByText(/Do it three nights this week/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /see the related problem/i })).toHaveAttribute('href', '/problems/3');
        expect(await screen.findByRole('link', { name: /Racing mind/ })).toHaveAttribute('href', '/sessions/4');
        expect(screen.getByRole('link', { name: /^Record$/ })).toHaveAttribute('href', '/sessions/record');
        expect(screen.getByRole('link', { name: /Add notes/ })).toHaveAttribute('href', '/sessions/notes');
        expect(screen.getByRole('link', { name: /^Journal$/ })).toHaveAttribute('href', '/journal');
    });

    it('explains the empty focus and the empty session list', async () => {
        stub_api(routes({ 'GET /api/focus': envelope(null, 200), 'GET /api/sessions': [] }));
        mount();
        expect(await screen.findByText('Your focus will appear here')).toBeInTheDocument();
        expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Generate my focus' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /Record a session/ })[0]).toHaveAttribute('href', '/sessions/record');
    });

    it('with sessions but no focus (a failed focus run), offers Generate my focus', async () => {
        const mock = stub_api(routes({ 'GET /api/focus': envelope(null, 200), 'POST /api/focus/regenerate': focus_snapshot({ headline: 'Generated at last.' }) }));
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Generate my focus' }));
        expect(await screen.findByText('Generated at last.')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/focus/regenerate'))).toBe(true);
    });

    it('a failed Generate my focus says why and keeps the button', async () => {
        stub_api(routes({ 'GET /api/focus': envelope(null, 200), 'POST /api/focus/regenerate': envelope(null, 500, 'ANTHROPIC_API_KEY is not set.') }));
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Generate my focus' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('ANTHROPIC_API_KEY is not set.');
        expect(screen.getByRole('button', { name: 'Generate my focus' })).toBeEnabled();
    });

    it('shows a focus error with Retry while the rest of the page still works', async () => {
        stub_api(routes({ 'GET /api/focus': envelope(null, 500, 'Focus is down.') }));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('Focus is down.');
        expect(await screen.findByRole('link', { name: /Racing mind/ })).toBeInTheDocument();
        stub_api(routes());
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('Protect your mornings this week.')).toBeInTheDocument();
    });

    it('Refresh regenerates the focus', async () => {
        const mock = stub_api(routes({ 'POST /api/focus/regenerate': focus_snapshot({ headline: 'A brand new headline.' }) }));
        mount();
        await screen.findByText('Protect your mornings this week.');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(await screen.findByText('A brand new headline.')).toBeInTheDocument();
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/focus/regenerate'))).toBe(true);
    });

    it('a failed Refresh keeps the old focus and says why', async () => {
        stub_api(routes({ 'POST /api/focus/regenerate': envelope(null, 500, 'ANTHROPIC_API_KEY is not set.') }));
        mount();
        await screen.findByText('Protect your mornings this week.');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('ANTHROPIC_API_KEY is not set.');
        expect(screen.getByText('Protect your mornings this week.')).toBeInTheDocument();
    });
});

describe('Home stale-problem prompts', () => {
    const stale = problem({ id: 5, title: 'Avoiding hard conversations', is_stale: true, last_discussed_at: '2026-07-01T12:00:00.000Z' });

    it('shows only stale problems, and Keep removes the prompt', async () => {
        stub_api(routes({ 'GET /api/problems': [stale, problem({ id: 6, title: 'Fresh one' })], 'POST /api/problems/5/keep': stale }));
        mount();
        expect(await screen.findByText(/haven’t talked about/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Avoiding hard conversations' })).toHaveAttribute('href', '/problems/5');
        expect(screen.queryByText('Fresh one')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
        await waitFor(() => expect(screen.queryByText(/haven’t talked about/)).not.toBeInTheDocument());
    });

    it('Discard asks first, then PATCHes status discarded', async () => {
        const mock = stub_api(routes({ 'GET /api/problems': [stale], 'PATCH /api/problems/5': problem({ id: 5, status: 'discarded' }) }));
        mount();
        await screen.findByText(/haven’t talked about/);
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        const dialog = await screen.findByRole('dialog');
        expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')).toBe(false);
        fireEvent.click(dialog.querySelector('button:last-of-type')!);
        await waitFor(() => expect(screen.queryByText(/haven’t talked about/)).not.toBeInTheDocument());
        const patch = mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');
        expect(sent_body(mock, patch)).toEqual({ status: 'discarded' });
    });

    it('cancelling the discard dialog changes nothing', async () => {
        stub_api(routes({ 'GET /api/problems': [stale] }));
        mount();
        await screen.findByText(/haven’t talked about/);
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText(/haven’t talked about/)).toBeInTheDocument();
    });

    it('says how long in weeks, as a sentence ("in 5 weeks"), using the newest touch', async () => {
        const ago = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
        stub_api(routes({ 'GET /api/problems': [problem({ id: 7, title: 'Racing mind', is_stale: true, last_discussed_at: ago(90), last_reviewed_at: ago(36) })] }));
        mount();
        expect(await screen.findByText(/haven’t talked about/)).toHaveTextContent('You haven’t talked about Racing mind in 5 weeks. Still relevant?');
    });

    it('shows nothing when no problem is stale', async () => {
        stub_api(routes({ 'GET /api/problems': [problem()] }));
        mount();
        await screen.findByText('Protect your mornings this week.');
        expect(screen.queryByText('Still relevant?')).not.toBeInTheDocument();
    });
});
