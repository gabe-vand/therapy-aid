import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import AppShell from '@/components/shell/AppShell';
import { snippet_parts } from '@/components/palette/palette-actions';
import { stub_api } from '../../helpers/hlp-fetch';
import { reset_theme } from '../../helpers/hlp-theme';

/* The command palette, through the shell that owns it: the shortcuts (and not while typing), the
   Search buttons, filtering the actions, search results with highlighted matches, and keyboard
   selection that navigates. A location readout in the outlet shows where a choice went. */

const Where = () => (
    <div>
        <p data-testid="where">{useLocation().pathname}</p>
        <input aria-label="A page field" />
    </div>
);

const mount = (path = '/') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="*" element={<Where />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

const RESULTS = [
    { kind: 'session', ref_id: 4, occurred_at: '2026-09-11T16:00:00.000Z', title: 'Racing mind', snippet: 'we talked about the [racing] mind at night' },
    { kind: 'journal', ref_id: 9, occurred_at: '2026-10-02T08:00:00.000Z', title: 'Thursday morning', snippet: 'my mind was [racing] again' },
];

const palette = () => screen.queryByRole('dialog', { name: 'Command palette' });
const input = () => screen.getByRole('combobox', { name: 'Search or jump to' });

afterEach(() => reset_theme());

describe('CommandPalette', () => {
    it('opens on Ctrl+K and on "/", and closes on Escape', () => {
        mount();
        expect(palette()).not.toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(palette()).toBeInTheDocument();
        expect(input()).toHaveFocus();
        fireEvent.keyDown(input(), { key: 'Escape' });
        expect(palette()).not.toBeInTheDocument();
        fireEvent.keyDown(document.body, { key: '/' });
        expect(palette()).toBeInTheDocument();
    });

    it('does not open on "/" while typing in a field', () => {
        mount();
        const field = screen.getByRole('textbox', { name: 'A page field' });
        field.focus();
        fireEvent.keyDown(field, { key: '/' });
        expect(palette()).not.toBeInTheDocument();
    });

    it('opens from the Search buttons, and a click outside closes it', () => {
        mount();
        const [side] = screen.getAllByRole('button', { name: 'Search' });
        fireEvent.click(side!);
        expect(palette()).toBeInTheDocument();
        fireEvent.click(document.querySelector('.ta-pal-wrap .ta-overlay')!);
        expect(palette()).not.toBeInTheDocument();
    });

    it('lists the actions, filters them by name, and Enter runs the first', () => {
        mount();
        fireEvent.keyDown(window, { key: 'k', metaKey: true });
        const list = within(screen.getByRole('listbox'));
        expect(list.getByRole('option', { name: 'New journal entry' })).toHaveAttribute('aria-selected', 'true');
        expect(list.getByRole('option', { name: 'Toggle theme' })).toBeInTheDocument();
        fireEvent.change(input(), { target: { value: 'go prob' } });
        expect(list.getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual(['Go to Problems']);
        fireEvent.keyDown(input(), { key: 'Enter' });
        expect(palette()).not.toBeInTheDocument();
        expect(screen.getByTestId('where')).toHaveTextContent('/problems');
    });

    it('shows search results grouped by kind with the matches marked, and the arrows pick one', async () => {
        const mock = stub_api({ 'GET /api/search': RESULTS });
        mount();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        fireEvent.change(input(), { target: { value: 'racing' } });
        const journal = await screen.findByRole('group', { name: 'Journal' });
        expect(String(mock.mock.calls[0]![0])).toContain('search?q=racing');
        expect(screen.getByRole('group', { name: 'Sessions' })).toHaveTextContent('Racing mind');
        expect(journal.querySelector('mark')).toHaveTextContent('racing');
        expect(screen.queryByRole('group', { name: 'Actions' })).not.toBeInTheDocument();
        fireEvent.keyDown(input(), { key: 'ArrowDown' });
        expect(within(journal).getByRole('option')).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(input(), { key: 'Enter' });
        expect(screen.getByTestId('where')).toHaveTextContent('/journal/9');
    });

    it('Toggle theme flips the resolved theme', () => {
        mount();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        act(() => fireEvent.click(screen.getByRole('option', { name: 'Toggle theme' })));
        expect(document.documentElement.dataset.theme).toBe('dark');
    });
});

describe('snippet_parts', () => {
    it('splits bracketed matches out of a snippet', () => {
        expect(snippet_parts('a [b] c [d]')).toEqual([
            { text: 'a ', match: false },
            { text: 'b', match: true },
            { text: ' c ', match: false },
            { text: 'd', match: true },
        ]);
    });
});
