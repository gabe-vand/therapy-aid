import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocus } from '@/services/hooks/use-focus';
import { envelope, stub_api } from '../../helpers/hlp-fetch';
import { focus_snapshot } from '../../helpers/hlp-sessions';

describe('useFocus', () => {
    it('loads the latest snapshot', async () => {
        stub_api({ 'GET /api/focus': focus_snapshot() });
        const { result } = renderHook(() => useFocus());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.focus?.headline).toBe('Protect your mornings this week.');
    });

    it('treats a null snapshot (no session yet) as empty, not an error', async () => {
        stub_api({ 'GET /api/focus': envelope(null, 200) });
        const { result } = renderHook(() => useFocus());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.focus).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('reports a load failure and recovers on reload', async () => {
        stub_api({ 'GET /api/focus': envelope(null, 500, 'Nope.') });
        const { result } = renderHook(() => useFocus());
        await waitFor(() => expect(result.current.error).toBe('Nope.'));
        stub_api({ 'GET /api/focus': focus_snapshot() });
        await act(() => result.current.reload());
        expect(result.current.error).toBeNull();
        expect(result.current.focus).not.toBeNull();
    });

    it('regenerate replaces the snapshot', async () => {
        const mock = stub_api({ 'GET /api/focus': focus_snapshot(), 'POST /api/focus/regenerate': focus_snapshot({ id: 2, headline: 'Fresh headline.' }) });
        const { result } = renderHook(() => useFocus());
        await waitFor(() => expect(result.current.focus).not.toBeNull());
        await act(() => result.current.regenerate());
        expect(result.current.focus?.headline).toBe('Fresh headline.');
        expect((mock.mock.calls[1]![1] as RequestInit).method).toBe('POST');
    });

    it('a failed regenerate keeps the old snapshot and shows the reason', async () => {
        stub_api({ 'GET /api/focus': focus_snapshot(), 'POST /api/focus/regenerate': envelope(null, 500, 'ANTHROPIC_API_KEY is not set.') });
        const { result } = renderHook(() => useFocus());
        await waitFor(() => expect(result.current.focus).not.toBeNull());
        await act(() => result.current.regenerate());
        expect(result.current.focus?.headline).toBe('Protect your mornings this week.');
        expect(result.current.regenerate_error).toBe('ANTHROPIC_API_KEY is not set.');
        expect(result.current.regenerating).toBe(false);
    });
});
