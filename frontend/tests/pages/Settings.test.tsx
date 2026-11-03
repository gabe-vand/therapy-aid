import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Settings from '@/pages/Settings';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { usage, usage_row } from '../helpers/hlp-usage';

const profile = { profile: 'I am Gabe. I work on my racing mind.', updated_at: '2026-10-01T12:00:00.000Z' };
const routes = () => ({ 'GET /api/settings/profile': profile, 'GET /api/me': { login: 'gabe@example.com' }, 'GET /api/ai/usage': usage() });

const open = () =>
    render(
        <MemoryRouter>
            <Settings />
        </MemoryRouter>,
    );

const field = () => screen.getByRole('textbox', { name: 'About me' });

describe('Settings: profile', () => {
    it('loads the profile into the textarea with Save disabled until it changes', async () => {
        stub_api(routes());
        open();
        await waitFor(() => expect(field()).toHaveValue(profile.profile));
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        expect(screen.getByText(/^Saved /)).toBeInTheDocument();
    });

    it('saves edits, then shows Saved and disables Save again', async () => {
        const saved = { profile: 'Updated text', updated_at: new Date().toISOString() };
        const mock = stub_api({ ...routes(), 'PUT /api/settings/profile': saved });
        open();
        await waitFor(() => expect(field()).toHaveValue(profile.profile));

        fireEvent.change(field(), { target: { value: 'Updated text' } });
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.getByText('Saved just now')).toBeInTheDocument());
        expect(field()).toHaveValue('Updated text');
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        const put = mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
        expect(sent_body(mock, put)).toEqual({ profile: 'Updated text' });
    });

    it('keeps the draft and shows the reason when the save is rejected', async () => {
        stub_api({ ...routes(), 'PUT /api/settings/profile': envelope(null, 400, 'profile: Too long (50,000 characters max).') });
        open();
        await waitFor(() => expect(field()).toHaveValue(profile.profile));
        fireEvent.change(field(), { target: { value: 'too much' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Too long');
        expect(field()).toHaveValue('too much');
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('shows a profile load error with Retry', async () => {
        stub_api({ ...routes(), 'GET /api/settings/profile': envelope(null, 500, 'Profile is unavailable.') });
        open();
        expect(await screen.findByText('Profile is unavailable.')).toBeInTheDocument();
        stub_api(routes());
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(field()).toHaveValue(profile.profile));
    });
});

describe('Settings: account and AI usage', () => {
    it('shows the signed-in login', async () => {
        stub_api(routes());
        open();
        expect(await screen.findByText('gabe@example.com')).toBeInTheDocument();
    });

    it('explains a 401 from /me', async () => {
        stub_api({ ...routes(), 'GET /api/me': envelope({}, 401, 'UNAUTHORIZED') });
        open();
        expect(await screen.findByText(/not signed in to the tailnet/)).toBeInTheDocument();
    });

    it('renders one usage row per task with model, calls, tokens and cost, plus the total', async () => {
        stub_api(routes());
        open();
        const table = await screen.findByRole('table');
        const rows = within(table).getAllByRole('row');
        // header + 3 tasks + total
        expect(rows).toHaveLength(5);

        const summarize = within(rows[1]!).getAllByRole('cell');
        expect(summarize[0]).toHaveTextContent('Summarize');
        expect(summarize[0]).toHaveTextContent('claude-sonnet-5-5 · high');
        expect(summarize.slice(1).map((c) => c.textContent)).toEqual(['2', '15,000', '0', '1,800', '$0.03']);

        const chat = within(rows[2]!).getAllByRole('cell');
        expect(chat.slice(1).map((c) => c.textContent)).toEqual(['3', '900', '29,870', '344', '$0.0087']);

        expect(within(rows[3]!).getAllByRole('cell')[0]).toHaveTextContent('claude-haiku-5-5 · low');
        expect(within(rows[4]!).getAllByRole('cell')[1]).toHaveTextContent('$0.04');
        expect(screen.getByText(/Since /)).toBeInTheDocument();
        expect(screen.getByText(/reset whenever the server restarts/)).toBeInTheDocument();
    });

    it('warns when AI is not configured, and flags rows left by an override', async () => {
        const data = usage({ configured: false, rows: [usage_row({ task: 'focus', model: 'claude-opus-5-5', is_configured: false, calls: 1, est_usd: 0.2 })], total_usd: 0.2 });
        stub_api({ ...routes(), 'GET /api/ai/usage': data });
        open();
        expect(await screen.findByText(/AI is not configured/)).toBeInTheDocument();
        expect(screen.getByText('earlier override')).toBeInTheDocument();
    });

    it('shows a usage error with Retry that reloads', async () => {
        stub_api({ ...routes(), 'GET /api/ai/usage': envelope(null, 500, 'Usage is unavailable.') });
        open();
        const alert = await screen.findByText('Usage is unavailable.');
        stub_api(routes());
        fireEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('Refresh re-reads the numbers', async () => {
        stub_api(routes());
        open();
        await screen.findByRole('table');
        stub_api({ ...routes(), 'GET /api/ai/usage': usage({ total_usd: 2.5 }) });
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        await waitFor(() => expect(screen.getByText('$2.50')).toBeInTheDocument());
    });
});
