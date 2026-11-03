/* The theme preference: 'light' | 'dark' | 'system' (default 'light'), stored in
   localStorage['ta-theme'] and applied as <html data-theme="light|dark">, which tokens.css keys on.
   public/theme.js runs the same logic before first paint — KEEP THE TWO IN SYNC (key, values,
   default). Storage can throw (private mode, blocked site data): every access is guarded and a
   failure just means the preference isn't remembered. */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'ta-theme';
export const DEFAULT_PREFERENCE: ThemePreference = 'light';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/* The browser chrome colour per theme — mirrors --paper in tokens.css and the metas in index.html. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#101012' };

const is_preference = (value: unknown): value is ThemePreference => value === 'light' || value === 'dark' || value === 'system';

export const read_preference = (): ThemePreference => {
    try {
        const stored = window.localStorage.getItem(THEME_KEY);
        return is_preference(stored) ? stored : DEFAULT_PREFERENCE;
    } catch {
        return DEFAULT_PREFERENCE;
    }
};

/* Remembers the choice; returns false when storage refused it (the theme still applies). */
export const write_preference = (pref: ThemePreference): boolean => {
    try {
        window.localStorage.setItem(THEME_KEY, pref);
        return true;
    } catch {
        return false;
    }
};

export const system_prefers_dark = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;

export const resolve = (pref: ThemePreference): ResolvedTheme => {
    if (pref === 'system') return system_prefers_dark() ? 'dark' : 'light';
    return pref;
};

/* Puts the resolved theme on <html> and points the browser chrome colour at it. */
export const apply_theme = (pref: ThemePreference): ResolvedTheme => {
    const resolved = resolve(pref);
    document.documentElement.dataset.theme = resolved;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', THEME_COLOR[resolved]));
    return resolved;
};
