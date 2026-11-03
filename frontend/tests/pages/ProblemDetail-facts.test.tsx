import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProblemDetail from '@/pages/ProblemDetail';
import { MENTIONS_SHOWN } from '@/components/problems/JournalMentions';
import { stub_api } from '../helpers/hlp-fetch';
import { problem_detail, update } from '../helpers/hlp-problems-journal';

/* ProblemDetail's facts strip and its "In your journal" section. */

const show = () =>
    render(
        <MemoryRouter initialEntries={['/problems/1']}>
            <Routes>
                <Route path="/problems/:id" element={<ProblemDetail />} />
            </Routes>
        </MemoryRouter>,
    );

const mention = (entry_id: number, day: number) => ({ entry_id, occurred_at: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`, excerpt: `Excerpt ${entry_id}`, confidence: 0.9 });

describe('ProblemDetail facts strip', () => {
    it('names the session it came from, the notes and the journal mentions', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail({ origin_session_id: 4, created_at: '2026-08-06T12:00:00.000Z', update_count: 3, updates: [update({ session_id: 4, session_title: 'First session' })], journal_mentions: [mention(7, 2)] }) });
        show();
        const facts = await screen.findByRole('list', { name: 'About this problem' });
        expect(facts).toHaveTextContent('Opened Aug 6 from First session');
        expect(within(facts).getByRole('link', { name: 'First session' })).toHaveAttribute('href', '/sessions/4');
        expect(facts).toHaveTextContent('3 notes');
        expect(facts).toHaveTextContent('1 journal mention');
        expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('says when it has not been discussed and leaves out zero mentions', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail({ origin_session_id: null, last_discussed_at: null, update_count: 1, journal_mentions: [] }) });
        show();
        const facts = await screen.findByRole('list', { name: 'About this problem' });
        expect(facts).toHaveTextContent('Not discussed yet');
        expect(facts).toHaveTextContent('1 note');
        expect(facts).not.toHaveTextContent('journal');
        expect(within(facts).queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'In your journal' })).not.toBeInTheDocument();
    });
});

describe('ProblemDetail journal mentions', () => {
    it('lists them newest first, linking each entry, six at a time with Show all', async () => {
        const mentions = Array.from({ length: MENTIONS_SHOWN + 2 }, (_, i) => mention(i + 1, i + 1));
        stub_api({ 'GET /api/problems/1': problem_detail({ journal_mentions: mentions }) });
        show();
        const list = await screen.findByRole('list', { name: 'Journal mentions' });
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(MENTIONS_SHOWN);
        expect(items[0]).toHaveTextContent('Excerpt 8');
        expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/journal/8');
        fireEvent.click(screen.getByRole('button', { name: `Show all ${MENTIONS_SHOWN + 2}` }));
        expect(within(list).getAllByRole('listitem')).toHaveLength(MENTIONS_SHOWN + 2);
        expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    });
});
