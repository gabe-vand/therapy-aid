import { afterEach, describe, expect, it, vi } from 'vitest';
import { stub_dark_os, reset_theme } from '../helpers/hlp-theme';
import { THEME_KEY, apply_theme, read_preference, resolve, write_preference } from '@/services/theme';

/* The theme service: default light, 'system' follows the OS query, the resolved theme lands on
   <html data-theme> and the theme-color metas, and a throwing localStorage never breaks it. */

afterEach(reset_theme);

describe('theme service', () => {
    it('defaults to light and ignores junk in storage', () => {
        expect(read_preference()).toBe('light');
        window.localStorage.setItem(THEME_KEY, 'purple');
        expect(read_preference()).toBe('light');
        window.localStorage.setItem(THEME_KEY, 'dark');
        expect(read_preference()).toBe('dark');
    });

    it('resolves system through the OS colour-scheme query', () => {
        stub_dark_os(true);
        expect(resolve('system')).toBe('dark');
        stub_dark_os(false);
        expect(resolve('system')).toBe('light');
        expect(resolve('dark')).toBe('dark');
    });

    it('applies the resolved theme to <html> and the theme-color metas', () => {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#ffffff';
        document.head.appendChild(meta);
        expect(apply_theme('dark')).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(meta.content).toBe('#101012');
        apply_theme('light');
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(meta.content).toBe('#ffffff');
    });

    it('tolerates storage that throws (private mode)', () => {
        // Blocked site data: even touching window.localStorage throws.
        vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        expect(read_preference()).toBe('light');
        expect(write_preference('dark')).toBe(false);
        expect(apply_theme('dark')).toBe('dark');
    });
});
