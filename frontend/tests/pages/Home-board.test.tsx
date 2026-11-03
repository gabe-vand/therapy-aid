import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/pages/Home';
import { week_of } from '@/components/home/week';
import { envelope, sent_body, stub_api } from '../helpers/hlp-fetch';
import { home_routes } from '../helpers/hlp-home';
import { render_at } from '../helpers/hlp-render';
import { focus_snapshot } from '../helpers/hlp-sessions';

/* The focus card's "This week" board: the seven check-in circles per item (today toggles, a
   future day is disabled, a click PUTs the right local day), the 3/7 count, the Why? disclosure
   and the problem chip. */

const mount = () => render_at(<Home />, { path: '/' });
const ITEM = 'Write the first task the night before';
const board = async () => within(await screen.findByRole('group', { name: `This week: ${ITEM}` }));
const today = () => week_of().find((d) => d.is_today)!;

describe('Home check-in board', () => {
    it('draws Monday to Sunday with today enabled and future days disabled', async () => {
        stub_api(home_routes());
        mount();
        const days = (await board()).getAllByRole('button');
        expect(days).toHaveLength(7);
        expect(days[0]).toHaveAccessibleName(/^Monday, /);
        expect(days[6]).toHaveAccessibleName(/^Sunday, /);
        week_of().forEach((d, i) => (d.is_future ? expect(days[i]).toBeDisabled() : expect(days[i]).toBeEnabled()));
    });

    it('marks the days already checked in and counts them', async () => {
        const day = today().day;
        stub_api(home_routes({ 'GET /api/focus': focus_snapshot({ checkins: [{ item_index: 0, day }] }) }));
        mount();
        const b = await board();
        expect(b.getByRole('button', { name: today().long })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('1 of 7 days done this week')).toBeInTheDocument();
    });

    it('a click on today PUTs that local day as done, and flips at once', async () => {
        const mock = stub_api(home_routes({ 'PUT /api/focus/checkins': () => focus_snapshot({ checkins: [{ item_index: 0, day: today().day }] }) }));
        mount();
        const button = (await board()).getByRole('button', { name: today().long });
        expect(button).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        await waitFor(() => expect(mock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(true));
        const put = mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
        expect(sent_body(mock, put)).toEqual({ item_index: 0, day: today().day, done: true });
    });

    it('a failed check-in is undone and says why', async () => {
        stub_api(home_routes({ 'PUT /api/focus/checkins': envelope(null, 500, 'Could not save that.') }));
        mount();
        const button = (await board()).getByRole('button', { name: today().long });
        fireEvent.click(button);
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that.');
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('keeps the why behind a disclosure', async () => {
        stub_api(home_routes());
        mount();
        await board();
        const why = screen.getByText('David suggested it on Sep 11.');
        expect(why).not.toBeVisible();
        const toggle = screen.getByRole('button', { name: 'Why?' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(why).toBeVisible();
    });

    it('links the related problem by its title from the dashboard', async () => {
        stub_api(home_routes());
        mount();
        const focus = within(await screen.findByRole('region', { name: 'Protect your mornings this week.' }));
        expect(await focus.findByRole('link', { name: 'Sleep and the racing mind' })).toHaveAttribute('href', '/problems/3');
    });
});
