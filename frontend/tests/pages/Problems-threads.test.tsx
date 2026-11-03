import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Dashboard, DashboardThread } from '@therapy-aid/shared';
import Problems from '@/pages/Problems';
import { problems_sentence } from '@/components/problems/summary';
import { stub_api } from '../helpers/hlp-fetch';
import { render_at } from '../helpers/hlp-render';
import { problem } from '../helpers/hlp-problems-journal';

/* The Problems list's data from the dashboard: session dots and journal mentions joined by id,
   nothing while the dashboard is missing, and the counting subtitle. */

const thread = (over: Partial<DashboardThread> = {}): DashboardThread => ({ id: 1, title: 'Racing mind', status: 'active', is_stale: false, last_discussed_at: null, update_count: 2, marks: [true, false, true, true], journal_mentions: 0, ...over });

const dashboard = (threads: DashboardThread[]): Dashboard => ({
    sessions: { total: 4, axis: [], last: null, typical_gap_days: 14 },
    threads,
    journal: { entries_30d: 0, words_7d: 0, streak_days: 0, last_entry: null, themes: [] },
    since_last_session: null,
});

const show = () => render_at(<Problems />, { path: '/problems' });

describe('Problems: threads from the dashboard', () => {
    it('draws the session dots and the journal mentions for the matching problem only', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1, title: 'Racing mind' }), problem({ id: 2, title: 'Sleep' })], 'GET /api/dashboard': dashboard([thread({ id: 1, journal_mentions: 3 })]) });
        show();
        const dots = await screen.findByRole('img', { name: 'Discussed in 3 of the last 4 sessions' });
        expect(dots.querySelectorAll('[data-hit="true"]')).toHaveLength(3);
        expect(dots.querySelectorAll('.ta-sdots__dot')).toHaveLength(4);
        expect(screen.getByRole('link', { name: /Racing mind/ })).toHaveTextContent('3 in journal');
        const sleep = screen.getByRole('link', { name: /Sleep/ });
        expect(within(sleep).queryByRole('img')).not.toBeInTheDocument();
        expect(sleep).not.toHaveTextContent('in journal');
    });

    it('still lists the problems when the dashboard fails', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1, title: 'Racing mind' })] });
        show();
        expect(await screen.findByRole('link', { name: /Racing mind/ })).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('marks each row with its status tone', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1, title: 'Fresh' }), problem({ id: 2, title: 'Dusty', is_stale: true })] });
        const { container } = show();
        await screen.findByRole('link', { name: /Dusty/ });
        expect([...container.querySelectorAll('.ta-prow')].map((r) => r.getAttribute('data-tone'))).toEqual(['active', 'stale']);
    });

    it('counts the list in the subtitle', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1 }), problem({ id: 2, is_stale: true }), problem({ id: 3, status: 'resolved' })] });
        show();
        expect(await screen.findByText('2 active · 1 going quiet · 1 resolved')).toBeInTheDocument();
    });
});

describe('problems_sentence', () => {
    it('leaves out zero counts and explains an empty list', () => {
        expect(problems_sentence([problem()])).toBe('1 active');
        expect(problems_sentence([])).toBe('The themes that keep coming up, and how they are moving.');
    });
});
