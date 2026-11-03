import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useJournal } from '@/services/hooks/use-journal';
import { envelope, stub_api } from '../../helpers/hlp-fetch';
import { entry } from '../../helpers/hlp-problems-journal';

describe('useJournal', () => {
    it('loads the entry list', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 2 }), entry({ id: 1 })] });
        const { result } = renderHook(() => useJournal());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.entries.map((e) => e.id)).toEqual([2, 1]);
    });

    it('shows the server message on failure', async () => {
        stub_api({ 'GET /api/journal': envelope(null, 500, 'The journal is unavailable.') });
        const { result } = renderHook(() => useJournal());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('The journal is unavailable.');
    });

    it('apply_entry upserts and keeps newest-first order; drop_entry removes', async () => {
        stub_api({ 'GET /api/journal': [entry({ id: 1, occurred_at: '2026-10-01T12:00:00.000Z' })] });
        const { result } = renderHook(() => useJournal());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.apply_entry(entry({ id: 2, occurred_at: '2026-10-10T12:00:00.000Z', body: 'newer' })));
        expect(result.current.entries.map((e) => e.id)).toEqual([2, 1]);

        act(() => result.current.apply_entry(entry({ id: 2, occurred_at: '2026-10-10T12:00:00.000Z', body: 'edited' })));
        expect(result.current.entries).toHaveLength(2);
        expect(result.current.entries[0]?.body).toBe('edited');

        act(() => result.current.drop_entry(2));
        expect(result.current.entries.map((e) => e.id)).toEqual([1]);
    });
});
