import type { ReactNode } from 'react';
import './ui.css';

/* A keyboard hint ("⌘K", "Esc") in a small recessed box. Hints are for sighted keyboard users;
   the control they sit in carries its own accessible name, so the hint is aria-hidden. */
export const Kbd = ({ children }: { children: ReactNode }) => (
    <kbd aria-hidden className="ta-kbd">
        {children}
    </kbd>
);

/* "⌘" on Apple keyboards, "Ctrl" elsewhere — for shortcut hints. */
export const mod_key = (): string => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl ');
