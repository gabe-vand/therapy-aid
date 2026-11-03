import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInsights } from '@/services/hooks/use-insights';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { insight } from '../../helpers/hlp-problems-journal';

describe('useInsights', () => {
    it('loads the history newest first and never generates on its own', async () => {
        const mock = stub_api({ 'GET /api/journal/1/insights': [insight({ id: 1, created_at: '2026-10-01T10:00:00.000Z' }), insight({ id: 2, created_at: '2026-10-02T10:00:00.000Z' })] });
        const { result } = renderHook(() => useInsights(1));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.insights.map((i) => i.id)).toEqual([2, 1]);
        expect(mock.mock.calls.every((c) => ((c[1] as RequestInit | undefined)?.method ?? 'GET') === 'GET')).toBe(true);
    });

    it('without an entry id there is nothing to load and generate is a no-op', async () => {
        const mock = stub_api({});
        const { result } = renderHook(() => useInsights(null));
        let out = 'untouched' as unknown;
        await act(async () => {
            out = await result.current.generate('draft');
        });
        expect(out).toBeNull();
        expect(mock).not.toHaveBeenCalled();
    });

    it('generate posts the current draft and puts the new insight first', async () => {
        const mock = stub_api({ 'GET /api/journal/1/insights': [insight({ id: 1, created_at: '2026-10-01T10:00:00.000Z' })], 'POST /api/journal/1/insights': insight({ id: 2, body: 'Fresh idea', created_at: '2026-10-05T10:00:00.000Z' }) });
        const { result } = renderHook(() => useInsights(1));
        await waitFor(() => expect(result.current.insights).toHaveLength(1));

        await act(async () => {
            await result.current.generate('my whole draft');
        });
        const post = mock.mock.calls.findIndex((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
        expect(sent_body(mock, post)).toEqual({ body: 'my whole draft' });
        expect(result.current.insights.map((i) => i.body)[0]).toBe('Fresh idea');
        expect(result.current.generating).toBe(false);
        expect(result.current.generate_error).toBeNull();
    });

    it('a failed generation keeps the history and reports the message', async () => {
        stub_api({ 'GET /api/journal/1/insights': [insight()], 'POST /api/journal/1/insights': envelope(null, 500, 'The AI model declined to answer this request.') });
        const { result } = renderHook(() => useInsights(1));
        await waitFor(() => expect(result.current.insights).toHaveLength(1));
        await act(async () => {
            await result.current.generate('draft');
        });
        expect(result.current.generate_error).toBe('The AI model declined to answer this request.');
        expect(result.current.insights).toHaveLength(1);
    });

    it('switching entries clears the previous entry’s insights', async () => {
        stub_api({ 'GET /api/journal/1/insights': [insight({ id: 1 })], 'GET /api/journal/2/insights': [] });
        const { result, rerender } = renderHook(({ id }) => useInsights(id), { initialProps: { id: 1 as number | null } });
        await waitFor(() => expect(result.current.insights).toHaveLength(1));
        rerender({ id: 2 });
        await waitFor(() => expect(result.current.insights).toHaveLength(0));
    });
});
