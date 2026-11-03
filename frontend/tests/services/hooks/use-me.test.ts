import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useMe } from '@/services/hooks/use-me';
import { envelope, stub_api, stub_unreachable } from '../../helpers/hlp-fetch';

describe('useMe', () => {
    it('loads GET /api/me on mount', async () => {
        const mock = stub_api({ 'GET /api/me': { login: 'gabe@example.com' } });
        const { result } = renderHook(() => useMe());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.me).toEqual({ login: 'gabe@example.com' });
        expect(result.current.error).toBeNull();
        expect(mock.mock.calls[0]![0]).toBe('/api/me');
    });

    it('explains a 401 in plain words', async () => {
        stub_api({ '/api/me': envelope({}, 401, 'UNAUTHORIZED') });
        const { result } = renderHook(() => useMe());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.me).toBeNull();
        expect(result.current.error).toMatch(/not signed in/);
    });

    it('surfaces an unreachable server, and reload recovers', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useMe());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);

        stub_api({ '/api/me': { login: 'dev@local' } });
        await act(() => result.current.reload());
        expect(result.current.me?.login).toBe('dev@local');
        expect(result.current.error).toBeNull();
    });
});
