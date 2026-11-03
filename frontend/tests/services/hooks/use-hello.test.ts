import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useHello } from '@/services/hooks/use-hello';
import { hello_status, stub_hello_api, stub_unreachable } from '../../helpers/hlp-fetch';

describe('useHello', () => {
    it('loads GET /api/hello on mount', async () => {
        const fetch_mock = stub_hello_api(hello_status());
        const { result } = renderHook(() => useHello());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.status?.visit_count).toBe(3);
        expect(result.current.error).toBeNull();
        expect(fetch_mock.mock.calls[0]![0]).toBe('/api/hello');
    });

    it('record_visit POSTs and adopts the returned status', async () => {
        const fetch_mock = stub_hello_api(hello_status(), hello_status({ visit_count: 4 }));
        const { result } = renderHook(() => useHello());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(() => result.current.record_visit());

        expect(result.current.status?.visit_count).toBe(4);
        expect(fetch_mock).toHaveBeenLastCalledWith('/api/hello/visits', expect.objectContaining({ method: 'POST' }));
    });

    it('surfaces an unreachable server as an error, not an endless spinner', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useHello());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.status).toBeNull();
        expect(result.current.error).toBe(UNREACHABLE);
    });
});
