import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '@/components/ui/Button';
import { Page } from '@/components/ui/Page';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/ui/States';

/* The refresh's new primitives: Page width classes, PageHeader's back link, IconButton's
   required label, and SegmentedControl's pressed state. */

describe('new primitives', () => {
    it('Page carries its width', () => {
        const { container } = render(<Page width="reading">x</Page>);
        expect(container.firstElementChild?.className).toBe('ta-page ta-page--reading');
    });

    it('PageHeader renders the back link above the title', () => {
        render(
            <MemoryRouter>
                <PageHeader back={{ to: '/sessions', label: 'Sessions' }} title="Record a session" />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: 'Sessions' })).toHaveAttribute('href', '/sessions');
        expect(screen.getByRole('heading', { level: 1, name: 'Record a session' })).toBeInTheDocument();
    });

    it('IconButton is named by its aria-label', () => {
        render(<IconButton aria-label="New entry">+</IconButton>);
        expect(screen.getByRole('button', { name: 'New entry' })).toHaveAttribute('type', 'button');
    });

    it('SegmentedControl marks the chosen option and reports changes', () => {
        const on_change = vi.fn();
        const options = [
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
        ];
        render(<SegmentedControl label="Pick" options={options} value="a" on_change={on_change} />);
        expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
        expect(on_change).toHaveBeenCalledWith('b');
    });
});
