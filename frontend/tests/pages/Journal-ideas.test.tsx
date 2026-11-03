import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { requests, show, tick, type } from '../helpers/hlp-journal-page';
import { entry, insight } from '../helpers/hlp-problems-journal';

/* The Journal page: the idea button rules and the insight panel under the document. The editor is the textarea stub (hlp-rich-editor.tsx). Timers are faked but advance with
   real time, so findBy* still works; autosave waits are explicit advances inside act(). */
vi.mock('@/components/journal/RichEditor', () => import('../helpers/hlp-rich-editor'));

const IDEA_PAUSE = 4000;
const LONG = 'Today was hard and my head would not stop going round and round about the thing with Nicole and work. '.repeat(2);

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
    vi.useRealTimers();
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
