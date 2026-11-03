import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { JournalInsight } from '@therapy-aid/shared';
import { MarginColumn, MarginList, NotePill } from '@/components/journal/MarginNotes';
import { useMarginView } from '@/components/journal/use-margin-view';
import { margin_note } from '../../helpers/hlp-problems-journal';

/* Margin notes in the inline layout (happy-dom has no matchMedia, so the pane counts as narrow):
   each card names its kind, quotes its paragraph, links its problem, and can be dismissed; a
   note that arrives later offers a jump pill. */

const Harness = ({ notes, on_dismiss }: { notes: JournalInsight[]; on_dismiss: (id: number) => void }) => {
    const view = useMarginView(notes, null);
    return (
        <>
            <MarginColumn view={view} on_dismiss={on_dismiss} />
            <MarginList view={view} on_dismiss={on_dismiss} />
            <NotePill view={view} />
        </>
    );
};

const mount = (notes = [margin_note()], on_dismiss = vi.fn()) =>
    render(
        <MemoryRouter>
            <Harness notes={notes} on_dismiss={on_dismiss} />
        </MemoryRouter>,
    );

describe('MarginNotes', () => {
    it('lists nothing without notes', () => {
        mount([]);
        expect(screen.queryByRole('region', { name: 'Margin notes list' })).not.toBeInTheDocument();
    });

    it('lists each note under the document with its kind, quote, body and problem link', () => {
        mount([margin_note(), margin_note({ id: 3, kind: 'question', body: 'What would it take?', anchor: 'Checked the phone the moment I woke up' })]);
        const list = screen.getByRole('region', { name: 'Margin notes list' });
        const advice = within(list).getByRole('article', { name: 'Margin note: What David suggested' });
        expect(advice).toHaveTextContent('Lay awake again, thoughts going a mile a minute');
        expect(advice).toHaveTextContent('On Sep 11 David suggested the worry list.');
        expect(within(advice).getByRole('link', { name: 'Racing mind at night' })).toHaveAttribute('href', '/problems/3');
        expect(within(list).getByRole('article', { name: 'Margin note: A question for you' })).toHaveTextContent('What would it take?');
    });

    it('dismisses through the callback', () => {
        const on_dismiss = vi.fn();
        mount([margin_note({ id: 7 })], on_dismiss);
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss note' }));
        expect(on_dismiss).toHaveBeenCalledWith(7);
    });

    it('offers a jump pill when a new note arrives on the narrow layout', () => {
        const { rerender } = mount([margin_note({ id: 1 })]);
        expect(screen.queryByRole('button', { name: /New margin note/ })).not.toBeInTheDocument();
        rerender(
            <MemoryRouter>
                <Harness notes={[margin_note({ id: 1 }), margin_note({ id: 2, anchor: 'Another paragraph' })]} on_dismiss={vi.fn()} />
            </MemoryRouter>,
        );
        const pill = screen.getByRole('button', { name: /New margin note/ });
        fireEvent.click(pill);
        expect(screen.queryByRole('button', { name: /New margin note/ })).not.toBeInTheDocument();
    });
});
