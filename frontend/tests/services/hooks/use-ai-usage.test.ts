import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAiUsage } from '@/services/hooks/use-ai-usage';
import { envelope, stub_api } from '../../helpers/hlp-fetch';
import { usage } from '../../helpers/hlp-usage';

describe('useAiUsage', () => {
    it('loads GET /api/ai/usage on mount', async () => {
        const mock = stub_api({ 'GET /api/ai/usage': usage() });
        const { result } = renderHook(() => useAiUsage());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.usage?.rows).toHaveLength(3);
        expect(result.current.usage?.total_usd).toBe(0.0425);
        expect(result.current.error).toBeNull();
        expect(mock.mock.calls[0]![0]).toBe('/api/ai/usage');
    });

    it('surfaces a failure, and reload picks up fresh numbers', async () => {
        stub_api({ '/api/ai/usage': envelope(null, 500, 'Usage is unavailable.') });
        const { result } = renderHook(() => useAiUsage());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Usage is unavailable.');
        expect(result.current.usage).toBeNull();

        stub_api({ '/api/ai/usage': usage({ total_usd: 1.5 }) });
        await act(() => result.current.reload());
        expect(result.current.error).toBeNull();
        expect(result.current.usage?.total_usd).toBe(1.5);
    });
});
