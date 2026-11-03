import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTheme } from '@/services/hooks/use-theme';
import { THEME_KEY } from '@/services/theme';
import { reset_theme, stub_dark_os } from '../../helpers/hlp-theme';

/* useTheme: starts from the stored preference (light by default), set_preference stores and
   applies, 'system' follows the OS live, and two mounted toggles stay in sync. */

afterEach(reset_theme);

describe('useTheme', () => {
    it('defaults to light and applies it to <html>', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.preference).toBe('light');
        expect(result.current.resolved).toBe('light');
        expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('stores and applies a new preference', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.set_preference('dark'));
        expect(result.current.preference).toBe('dark');
        expect(result.current.resolved).toBe('dark');
        expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('follows the OS while on system, and stops listening when it leaves system', () => {
        const os = stub_dark_os(false);
        const { result } = renderHook(() => useTheme());
        act(() => result.current.set_preference('system'));
        expect(result.current.resolved).toBe('light');
        act(() => os.flip(true));
        expect(result.current.resolved).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        act(() => result.current.set_preference('light'));
        expect(os.listener_count()).toBe(0);
    });

    it('keeps two mounted instances in sync', () => {
        const a = renderHook(() => useTheme());
        const b = renderHook(() => useTheme());
        act(() => a.result.current.set_preference('dark'));
        expect(b.result.current.preference).toBe('dark');
    });
});
