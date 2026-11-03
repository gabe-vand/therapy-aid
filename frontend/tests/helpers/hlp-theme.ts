import { vi } from 'vitest';

/* Theme test fixtures: a controllable prefers-color-scheme query (flip() fires its listeners like
   the OS switching at sunset) and a reset that clears what the theme code leaves on <html>. */

export const stub_dark_os = (dark: boolean) => {
    const listeners = new Set<() => void>();
    const query = { matches: dark, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
    vi.spyOn(window, 'matchMedia').mockImplementation(() => query as unknown as MediaQueryList);
    return {
        flip: (next: boolean) => {
            query.matches = next;
            listeners.forEach((fn) => fn());
        },
        listener_count: () => listeners.size,
    };
};

export const reset_theme = () => {
    vi.restoreAllMocks(); // first: a test may have made localStorage itself throw
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
};
