import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SessionDetail from '@/pages/SessionDetail';
import { sent_body, stub_api } from '../helpers/hlp-fetch';
import { render_with_targets } from '../helpers/hlp-routes';
import { session } from '../helpers/hlp-sessions';

/* SessionDetail's recovery paths: a failure after the summary was saved (the summary stays
   readable, the stepper blames the right step) and a recording whose browser died before it was
   finished (Finish this recording). */

const mount = () => render_with_targets(<SessionDetail />, { path: '/sessions/4', pattern: '/sessions/:id', targets: ['/sessions'] });
const minutes_ago = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

describe('SessionDetail failed after summarizing', () => {
    it('shows the saved summary under the error, and marks Ready (not Summarizing) as the failed step', async () => {
        stub_api({ 'GET /api/sessions/4': session({ status: 'failed', error: 'The AI service is busy or unavailable right now (HTTP 429). Press Retry in a minute.' }) });
        mount();
        expect(await screen.findByText(/updating your problems failed/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        const items = within(screen.getByRole('list', { name: /processing progress/i })).getAllByRole('listitem');
        expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['done', 'done', 'failed']);
    });

    it('a failure before any summary still says Something went wrong, with no summary', async () => {
        stub_api({ 'GET /api/sessions/4': session({ status: 'failed', error: 'Nope.', summary: null }) });
        mount();
        expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
    });
});

describe('SessionDetail unfinished recording', () => {
    const recording = (over = {}) => session({ status: 'recording', source: 'recording', title: null, summary: null, ...over });

    it('offers Finish this recording once it is a few minutes old, and finalizes without a chunk count', async () => {
        let status = 'recording';
        const mock = stub_api({
            'GET /api/sessions/4': () => (status === 'recording' ? recording({ created_at: minutes_ago(45) }) : recording({ status: 'uploaded' })),
            'POST /api/sessions/4/finalize': () => {
                status = 'uploaded';
                return recording({ status: 'uploaded' });
            },
        });
        mount();
        expect(await screen.findByText(/audio that reached the server is safe/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Finish this recording' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Finish this recording' })).not.toBeInTheDocument());
        const call = mock.mock.calls.findIndex((c) => String(c[0]).endsWith('/finalize'));
        expect(sent_body(mock, call)).toEqual({});
        expect(await screen.findByText(/This usually takes a minute or two/)).toBeInTheDocument();
    });

    it('does not offer it for a recording that just started (it may still be live)', async () => {
        stub_api({ 'GET /api/sessions/4': recording({ created_at: new Date().toISOString() }) });
        mount();
        expect(await screen.findByText('This recording has not been finished yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Finish this recording' })).not.toBeInTheDocument();
    });
});
