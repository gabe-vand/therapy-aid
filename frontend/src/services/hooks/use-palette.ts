import { useCallback, useEffect, useState } from 'react';

/* The command palette's open state and its global shortcuts: Ctrl/⌘+K toggles it from anywhere
   (even inside a text field — that is what the chord is for), and "/" opens it unless the user is
   typing (an input, textarea, select or contenteditable has focus — the journal editor must keep
   its slashes). No network — a hook because it owns state and a window subscription. AppShell
   holds the one instance and hands `show` to its Search buttons. */

/* True when a key press on `target` is someone typing, so a bare "/" must not be stolen. */
export const is_typing_target = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
    return target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
};

export const usePalette = () => {
    const [open, set_open] = useState(false);

    useEffect(() => {
        const on_key = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                set_open((o) => !o);
                return;
            }
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.defaultPrevented && !is_typing_target(e.target)) {
                e.preventDefault();
                set_open(true);
            }
        };
        window.addEventListener('keydown', on_key);
        return () => window.removeEventListener('keydown', on_key);
    }, []);

    const show = useCallback(() => set_open(true), []);
    const close = useCallback(() => set_open(false), []);

    return { open, show, close };
};
