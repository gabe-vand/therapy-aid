import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProblemTimeline } from '@/components/problems/ProblemTimeline';
import { update } from '../../helpers/hlp-problems-journal';

/* The timeline on its own: the empty explanation, and a session note with no stored title. */
const show = (updates: ReturnType<typeof update>[]) =>
    render(
        <MemoryRouter>
            <ProblemTimeline updates={updates} />
        </MemoryRouter>,
    );

describe('ProblemTimeline', () => {
    it('explains an empty timeline', () => {
        show([]);
        expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
    });

    it('still links to a session whose title is missing', () => {
        show([update({ session_id: 12, session_title: null })]);
        expect(screen.getByRole('link', { name: 'Session' })).toHaveAttribute('href', '/sessions/12');
    });

    it('renders a note typed by hand with the manual tag and no link', () => {
        show([update({ source: 'manual', session_id: null, session_title: null, body: 'My own note' })]);
        expect(screen.getByText('manual')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
