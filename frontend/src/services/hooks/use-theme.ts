import { useCallback, useEffect, useState } from 'react';
import { DARK_QUERY, apply_theme, read_preference, resolve, write_preference, type ResolvedTheme, type ThemePreference } from '@/services/theme';

/* The theme switch's state: the stored preference, what it resolves to right now, and a setter
   that stores + applies it. While the preference is 'system' it follows the OS live (the
   media-query listener). Several toggles can be mounted at once (sidebar + Settings), so a change
   is broadcast as a window event every instance listens to; other tabs sync via 'storage'.
   No network — a hook because it owns state and subscriptions. */

const CHANGE_EVENT = 'ta-theme-change';

export const useTheme = () => {
    const [preference, set_pref] = useState<ThemePreference>(read_preference);
    const [resolved, set_resolved] = useState<ResolvedTheme>(() => resolve(preference));

    // Apply on mount and on every change (idempotent — theme.js already did the first paint).
    useEffect(() => {
        set_resolved(apply_theme(preference));
        if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(DARK_QUERY);
        const on_change = () => set_resolved(apply_theme('system'));
        query.addEventListener('change', on_change);
        return () => query.removeEventListener('change', on_change);
    }, [preference]);

    // Follow changes made by another toggle in this tab, or in another tab.
    useEffect(() => {
        const on_external = (e: Event) => {
            const detail = (e as CustomEvent<ThemePreference>).detail;
            set_pref(detail ?? read_preference());
        };
        window.addEventListener(CHANGE_EVENT, on_external);
        window.addEventListener('storage', on_external);
        return () => {
            window.removeEventListener(CHANGE_EVENT, on_external);
            window.removeEventListener('storage', on_external);
        };
    }, []);

    const set_preference = useCallback((next: ThemePreference) => {
        write_preference(next);
        set_pref(next);
        window.dispatchEvent(new CustomEvent<ThemePreference>(CHANGE_EVENT, { detail: next }));
    }, []);

    return { preference, resolved, set_preference };
};
