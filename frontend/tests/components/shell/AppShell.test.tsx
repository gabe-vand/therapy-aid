import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AppShell from '@/components/shell/AppShell';
import { NAV_ITEMS, is_active } from '@/components/shell/nav';

/* The shell alone, with a marker page in its outlet — independent of the real pages. */
const render_app = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="*" element={<h1>outlet content</h1>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

describe('nav contract', () => {
    it('has six sections, five of them in the mobile tabs (Settings is behind the gear)', () => {
        expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Home', 'Sessions', 'Problems', 'Journal', 'Chat', 'Settings']);
        expect(NAV_ITEMS.filter((i) => i.in_tabs).map((i) => i.label)).toEqual(['Home', 'Sessions', 'Problems', 'Journal', 'Chat']);
    });

    it('marks a section active on its path and below; Home only on "/"', () => {
        const [home, sessions] = NAV_ITEMS;
        expect(is_active(home!, '/')).toBe(true);
        expect(is_active(home!, '/sessions')).toBe(false);
        expect(is_active(sessions!, '/sessions/4')).toBe(true);
        expect(is_active(sessions!, '/sessions/record')).toBe(true);
        expect(is_active(sessions!, '/sessionsx')).toBe(false);
    });
});

describe('AppShell', () => {
    it('renders the brand, the sidebar with every section, and the tab bar with five', () => {
        render_app('/');
        expect(screen.getAllByText('therapy-aid').length).toBeGreaterThan(0);
        const main_nav = screen.getByRole('navigation', { name: 'Main' });
        expect(
            within(main_nav)
                .getAllByRole('link')
                .map((a) => a.textContent),
        ).toEqual(['Home', 'Sessions', 'Problems', 'Journal', 'Chat', 'Settings']);
        expect(within(screen.getByRole('navigation', { name: 'Tabs' })).getAllByRole('link')).toHaveLength(5);
        expect(screen.getByRole('heading', { name: 'outlet content' })).toBeInTheDocument();
    });

    it('highlights the current section in both navs', () => {
        render_app('/sessions/12');
        const side = within(screen.getByRole('navigation', { name: 'Main' }));
        const tabs = within(screen.getByRole('navigation', { name: 'Tabs' }));
        expect(side.getByRole('link', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page');
        expect(tabs.getByRole('link', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page');
        expect(side.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    });

    it('has a Search button in the sidebar and in the mobile top bar, each opening the palette', () => {
        render_app('/');
        const in_top_bar = within(screen.getByRole('banner')).getByRole('button', { name: 'Search' });
        expect(screen.getAllByRole('button', { name: 'Search' })).toHaveLength(2);
        expect(screen.getByText('Search…').closest('button')).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K /');
        fireEvent.click(in_top_bar);
        expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    });

    it('lights the mobile gear on /settings', () => {
        render_app('/settings');
        expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    });
});
