import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Problems from '@/pages/Problems';
import { envelope, sent_body, stub_api, stub_unreachable } from '../helpers/hlp-fetch';
import { render_at } from '../helpers/hlp-render';
import { problem } from '../helpers/hlp-problems-journal';

const days_ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const requests = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);
const show = () => render_at(<Problems />, { path: '/problems' });

describe('Problems page', () => {
    it('shows a loading state, then active problems as rows', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1, title: 'Racing mind', last_discussed_at: days_ago(21), update_count: 3 })] });
        show();
        expect(screen.getByRole('status', { name: 'Loading problems' })).toBeInTheDocument();
        const card = await screen.findByRole('link', { name: /Racing mind/ });
        expect(card).toHaveAttribute('href', '/problems/1');
        expect(card).toHaveTextContent('Last discussed 3 weeks ago');
        expect(card).toHaveTextContent('3 updates');
    });

    it('truncates the description to one line and singularises "1 update"', async () => {
        stub_api({ 'GET /api/problems': [problem({ description: 'A long description. '.repeat(30), update_count: 1 })] });
        show();
        const card = await screen.findByRole('link', { name: /Racing mind/ });
        expect(card.querySelector('.ta-prow__desc')).toHaveClass('ta-prow__desc');
        expect(card).toHaveTextContent('1 update');
        expect(card).not.toHaveTextContent('1 updates');
    });

    it('says "not discussed yet" when a problem has never come up in a session', async () => {
        stub_api({ 'GET /api/problems': [problem({ last_discussed_at: null, created_at: days_ago(2), update_count: 0 })] });
        show();
        expect(await screen.findByText(/not discussed yet/)).toBeInTheDocument();
    });

    it('explains the empty state and offers a way to add one', async () => {
        stub_api({ 'GET /api/problems': [] });
        show();
        expect(await screen.findByText('No active problems')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'New problem' }).length).toBeGreaterThan(0);
    });

    it('shows the error with Retry that recovers', async () => {
        stub_unreachable();
        show();
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/Cannot reach the server/);
        stub_api({ 'GET /api/problems': [problem()] });
        fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('link', { name: /Racing mind/ })).toBeInTheDocument();
    });

    it('keeps resolved problems collapsed until asked', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1 }), problem({ id: 2, title: 'Old worry', status: 'resolved' })] });
        show();
        await screen.findByRole('link', { name: /Racing mind/ });
        expect(screen.queryByText('Old worry')).not.toBeInTheDocument();
        const toggle = screen.getByRole('button', { name: /Resolved \(1\)/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(screen.getByText('Old worry')).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('flags only stale problems with Keep and Discard', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1, title: 'Fresh' }), problem({ id: 2, title: 'Dusty', is_stale: true })] });
        show();
        await screen.findByRole('link', { name: /Dusty/ });
        expect(screen.getAllByText('Stale')).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Keep' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
    });

    it('Keep posts /keep and the card stops being stale after the reload', async () => {
        let stale = true;
        const mock = stub_api({
            'GET /api/problems': () => [problem({ id: 2, title: 'Dusty', is_stale: stale })],
            'POST /api/problems/2/keep': () => {
                stale = false;
                return {};
            },
        });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Keep' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument());
        expect(requests(mock)).toContain('POST /api/problems/2/keep');
    });

    it('Discard asks first; Cancel sends nothing, Confirm PATCHes status discarded', async () => {
        let gone = false;
        const mock = stub_api({
            'GET /api/problems': () => (gone ? [] : [problem({ id: 2, title: 'Dusty', is_stale: true })]),
            'PATCH /api/problems/2': () => {
                gone = true;
                return {};
            },
        });
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('Discard this problem?');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(requests(mock).some((r) => r.startsWith('PATCH'))).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
        await waitFor(() => expect(screen.queryByText('Dusty')).not.toBeInTheDocument());
        expect(sent_body(mock, requests(mock).indexOf('PATCH /api/problems/2'))).toEqual({ status: 'discarded' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('"+ New problem" opens a form that posts title and description', async () => {
        let created = false;
        const mock = stub_api({
            'GET /api/problems': () => (created ? [problem({ id: 8, title: 'Sleep' })] : []),
            'POST /api/problems': () => {
                created = true;
                return problem({ id: 8, title: 'Sleep' });
            },
        });
        show();
        await screen.findByText('No active problems');
        fireEvent.click(screen.getAllByRole('button', { name: 'New problem' })[0]!);
        const form = screen.getByRole('form', { name: 'New problem' });
        const submit = within(form).getByRole('button', { name: 'Add problem' });
        expect(submit).toBeDisabled();
        fireEvent.change(within(form).getByLabelText('Title'), { target: { value: '  Sleep  ' } });
        fireEvent.change(within(form).getByLabelText(/What is it/), { target: { value: 'Not enough.' } });
        fireEvent.click(submit);
        expect(await screen.findByRole('link', { name: /Sleep/ })).toBeInTheDocument();
        expect(sent_body(mock, requests(mock).indexOf('POST /api/problems'))).toEqual({ title: 'Sleep', description: 'Not enough.' });
        expect(screen.queryByRole('form', { name: 'New problem' })).not.toBeInTheDocument();
    });

    it('keeps the form open and shows the message when creating fails', async () => {
        stub_api({ 'GET /api/problems': [], 'POST /api/problems': envelope(null, 400, 'title: Give it a title.') });
        show();
        await screen.findByText('No active problems');
        fireEvent.click(screen.getAllByRole('button', { name: 'New problem' })[0]!);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add problem' }));
        expect(await screen.findByText('title: Give it a title.')).toBeInTheDocument();
        expect(screen.getByRole('form', { name: 'New problem' })).toBeInTheDocument();
    });
});
