import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useSessions } from '@/services/hooks/use-sessions';
import { envelope, stub_api, stub_unreachable } from '../../helpers/hlp-fetch';
import { list_item } from '../../helpers/hlp-sessions';

describe('useSessions', () => {
    it('loads GET /api/sessions on mount', async () => {
        const mock = stub_api({ 'GET /api/sessions': [list_item({ id: 2 }), list_item({ id: 1 })] });
        const { result } = renderHook(() => useSessions());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.sessions.map((s) => s.id)).toEqual([2, 1]);
        expect(result.current.error).toBeNull();
        expect(mock.mock.calls[0]![0]).toBe('/api/sessions');
    });

    it('treats an empty list as data, not an error', async () => {
        stub_api({ 'GET /api/sessions': [] });
        const { result } = renderHook(() => useSessions());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.sessions).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it('surfaces the server message and recovers on reload', async () => {
        stub_api({ 'GET /api/sessions': envelope(null, 500, 'Database is busy.') });
        const { result } = renderHook(() => useSessions());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Database is busy.');

        stub_api({ 'GET /api/sessions': [list_item()] });
        await act(() => result.current.reload());
        expect(result.current.error).toBeNull();
        expect(result.current.sessions).toHaveLength(1);
    });

    it('reports an unreachable server', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useSessions());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);
    });
});
