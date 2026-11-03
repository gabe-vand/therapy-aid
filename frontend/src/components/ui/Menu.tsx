import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';
import { IconButton } from './Button';
import './ui.css';

/* A small popover menu for overflow actions ("Delete entry", …) behind a "⋯" IconButton. The
   trigger carries aria-haspopup/aria-expanded; the popover is role="menu" with menuitem
   buttons. Opening focuses the first item; ArrowUp/ArrowDown move between items; Escape closes
   and returns focus to the trigger; a click outside closes. Choosing an item closes first, then
   runs it — so a confirm dialog it opens isn't fighting the menu for focus. */

export type MenuItem = { label: string; on_select: () => void; tone?: 'danger'; icon?: ReactNode; disabled?: boolean };

type Props = { label: string; items: MenuItem[]; icon?: ReactNode; align?: 'start' | 'end'; size?: 'sm' | 'md' };

export const Menu = ({ label, items, icon, align = 'end', size = 'md' }: Props) => {
    const [open, set_open] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu_id = useId();

    const item_buttons = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

    // Focus the first item on open; close on a pointer press anywhere outside the menu.
    useEffect(() => {
        if (!open) return;
        item_buttons()[0]?.focus();
        const on_down = (e: PointerEvent | MouseEvent) => {
            if (root.current && !root.current.contains(e.target as Node)) set_open(false);
        };
        document.addEventListener('mousedown', on_down);
        document.addEventListener('touchstart', on_down as EventListener);
        return () => {
            document.removeEventListener('mousedown', on_down);
            document.removeEventListener('touchstart', on_down as EventListener);
        };
    }, [open]);

    const close = () => {
        set_open(false);
        trigger.current?.focus();
    };

    const on_key = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
            return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const buttons = item_buttons();
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === 'ArrowDown' ? 1 : -1;
        buttons[(at + step + buttons.length) % buttons.length]?.focus();
    };

    const select = (item: MenuItem) => {
        close();
        item.on_select();
    };

    return (
        <div ref={root} className="ta-menu" onKeyDown={open ? on_key : undefined}>
            <IconButton ref={trigger} aria-label={label} size={size} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menu_id : undefined} onClick={() => set_open((o) => !o)}>
                {icon ?? <Ellipsis aria-hidden />}
            </IconButton>
            {open && (
                <div id={menu_id} role="menu" aria-label={label} className={`ta-menu__pop${align === 'start' ? ' ta-menu__pop--start' : ''}`}>
                    {items.map((item) => (
                        <button key={item.label} type="button" role="menuitem" disabled={item.disabled} className={`ta-menu__item${item.tone === 'danger' ? ' ta-menu__item--danger' : ''}`} onClick={() => select(item)}>
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
