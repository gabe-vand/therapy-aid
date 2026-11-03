import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from '@/components/ui/Menu';

/* The overflow Menu: the trigger toggles a role="menu" popover, choosing an item closes it and
   runs the item, and Escape / an outside press close it (Escape hands focus back). */

const setup = () => {
    const on_delete = vi.fn();
    const on_copy = vi.fn();
    render(
        <div>
            <p>outside</p>
            <Menu
                label="Entry actions"
                items={[
                    { label: 'Copy', on_select: on_copy },
                    { label: 'Delete entry', on_select: on_delete, tone: 'danger' },
                ]}
            />
        </div>,
    );
    return { on_delete, on_copy, trigger: screen.getByRole('button', { name: 'Entry actions' }) };
};

describe('Menu', () => {
    it('opens on the trigger and focuses the first item', () => {
        const { trigger } = setup();
        expect(screen.queryByRole('menu')).toBeNull();
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menu', { name: 'Entry actions' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    });

    it('runs the selected item and closes', () => {
        const { trigger, on_delete, on_copy } = setup();
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete entry' }));
        expect(on_delete).toHaveBeenCalledOnce();
        expect(on_copy).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('moves with the arrow keys, closes on Escape and returns focus to the trigger', () => {
        const { trigger } = setup();
        fireEvent.click(trigger);
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Copy' }), { key: 'ArrowDown' });
        expect(screen.getByRole('menuitem', { name: 'Delete entry' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it('closes on a press outside', () => {
        const { trigger } = setup();
        fireEvent.click(trigger);
        fireEvent.mouseDown(screen.getByText('outside'));
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
