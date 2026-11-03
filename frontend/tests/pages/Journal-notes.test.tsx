import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTLE_MS } from '@/components/journal/paragraphs';
import { MARGIN_NOTES_KEY } from '@/services/prefs';
import { sent_body, stub_api } from '../helpers/hlp-fetch';
import { requests, show, tick, type } from '../helpers/hlp-journal-page';
import { entry, insight, margin_note } from '../helpers/hlp-problems-journal';

/* The Journal page: margin notes arrive on their own after a paragraph settles; reflections are
   asked for from the menu. The editor is the textarea stub (hlp-rich-editor.tsx). Timers are
   faked but advance with real time, so findBy* still works; waits are explicit advances. */
vi.mock('@/components/journal/RichEditor', () => import('../helpers/hlp-rich-editor'));

const PARAGRAPH = 'Lay awake again, thoughts going a mile a minute, could not switch off until well past two.';
const posts = (mock: ReturnType<typeof stub_api>, path: string) => requests(mock).filter((r) => r === `POST ${path}`);

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(MARGIN_NOTES_KEY);
});

const open_entry = (body: string, extra: Record<string, unknown> = {}) =>
    stub_api({ 'GET /api/journal': [entry({ id: 5 })], 'GET /api/journal/5': entry({ id: 5, body }), 'GET /api/journal/5/insights': [], 'PATCH /api/journal/5': entry({ id: 5 }), ...extra });

describe('Journal page: margin notes', () => {
    it('sends a finished paragraph once it settles, and shows the note that comes back', async () => {
        const mock = open_entry('start', {
            'POST /api/journal/5/notes': { outcome: 'written', link: { problem_id: 3, problem_title: 'Racing mind at night', confidence: 0.9 }, note: margin_note({ id: 9, entry_id: 5, anchor: PARAGRAPH.slice(0, 80) }) },
        });
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type(`start\n\n${PARAGRAPH}`);
        await tick(SETTLE_MS - 200);
        expect(posts(mock, '/api/journal/5/notes')).toHaveLength(0);
        await tick(400);
        await waitFor(() => expect(posts(mock, '/api/journal/5/notes')).toHaveLength(1));
        expect(sent_body(mock, requests(mock).indexOf('POST /api/journal/5/notes'))).toEqual({ paragraph: PARAGRAPH, write: true });
        const list = await screen.findByRole('region', { name: 'Margin notes list' });
        expect(within(list).getByRole('article', { name: 'Margin note: What David suggested' })).toHaveTextContent('worry list');
        // The same paragraph never fires twice.
        type(`start\n\n${PARAGRAPH}\n\nnot done yet`);
        await tick(SETTLE_MS + 100);
        expect(posts(mock, '/api/journal/5/notes')).toHaveLength(1);
    });

    it('never fires for the paragraphs an entry opened with, nor for unfinished text', async () => {
        const mock = open_entry(PARAGRAPH);
        show('/journal/5');
        await screen.findByDisplayValue(PARAGRAPH);
        await tick(SETTLE_MS + 100);
        type(`${PARAGRAPH}\n\nStill writing this one without an end`);
        await tick(SETTLE_MS + 100);
        expect(posts(mock, '/api/journal/5/notes')).toHaveLength(0);
    });

    it('is silent when margin notes are switched off', async () => {
        localStorage.setItem(MARGIN_NOTES_KEY, 'off');
        const mock = open_entry('start');
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type(`start\n\n${PARAGRAPH}`);
        await tick(SETTLE_MS + 100);
        expect(posts(mock, '/api/journal/5/notes')).toHaveLength(0);
    });

    it('lists existing margin notes and dismisses one through the API', async () => {
        const mock = open_entry('start', { 'GET /api/journal/5/insights': [margin_note({ id: 4, entry_id: 5 })], 'POST /api/journal/5/insights/4/dismiss': margin_note({ id: 4, entry_id: 5, dismissed_at: '2026-11-03T10:00:00.000Z' }) });
        show('/journal/5');
        const list = await screen.findByRole('region', { name: 'Margin notes list' });
        fireEvent.click(within(list).getByRole('button', { name: 'Dismiss note' }));
        await waitFor(() => expect(posts(mock, '/api/journal/5/insights/4/dismiss')).toHaveLength(1));
        expect(screen.queryByRole('region', { name: 'Margin notes list' })).not.toBeInTheDocument();
    });
});

describe('Journal page: reflections', () => {
    it('asks for a reflection from the menu with the current draft and renders it', async () => {
        const mock = open_entry('start', { 'POST /api/journal/5/insights': insight({ id: 9, entry_id: 5, body: 'You keep naming **the same loop**.' }) });
        show('/journal/5');
        await screen.findByDisplayValue('start');
        type('start and more');
        fireEvent.click(screen.getByRole('button', { name: 'Entry actions' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Reflect on this entry' }));
        const panel = await screen.findByRole('region', { name: 'Reflection' });
        await waitFor(() => expect(within(panel).getByText('the same loop').tagName).toBe('STRONG'));
        expect(sent_body(mock, requests(mock).indexOf('POST /api/journal/5/insights'))).toEqual({ body: 'start and more' });
    });

    it('shows earlier reflections under the newest one, and keeps margin notes out of that panel', async () => {
        open_entry('start', { 'GET /api/journal/5/insights': [insight({ id: 2, body: 'Newest reflection.', created_at: '2026-10-14T10:00:00.000Z' }), insight({ id: 1, body: 'Older reflection.' }), margin_note({ id: 3, entry_id: 5 })] });
        show('/journal/5');
        const panel = await screen.findByRole('region', { name: 'Reflection' });
        expect(panel).toHaveTextContent('Newest reflection.');
        expect(panel).not.toHaveTextContent('Older reflection.');
        expect(panel).not.toHaveTextContent('worry list');
        fireEvent.click(within(panel).getByRole('button', { name: /Earlier reflections \(1\)/ }));
        expect(panel).toHaveTextContent('Older reflection.');
    });
});

describe('Journal page: history is not an arrival', () => {
    it('shows no jump pill for notes loaded with the entry, but does for one that arrives while writing', async () => {
        open_entry('start', {
            'GET /api/journal/5/insights': [margin_note({ id: 4, entry_id: 5 })],
            'POST /api/journal/5/notes': { outcome: 'written', link: { problem_id: 3, problem_title: 'Racing mind at night', confidence: 0.9 }, note: margin_note({ id: 9, entry_id: 5, anchor: PARAGRAPH.slice(0, 80) }) },
        });
        show('/journal/5');
        await screen.findByRole('region', { name: 'Margin notes list' });
        expect(screen.queryByRole('button', { name: /New margin note/ })).not.toBeInTheDocument();
        type(`start\n\n${PARAGRAPH}`);
        await tick(SETTLE_MS + 100);
        expect(await screen.findByRole('button', { name: /New margin note/ })).toBeInTheDocument();
    });
});
