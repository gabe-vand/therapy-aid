import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStaleProblems } from '@/services/hooks/use-stale-problems';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { problem } from '../../helpers/hlp-sessions';

const all = [problem({ id: 1, is_stale: true }), problem({ id: 2, is_stale: false }), problem({ id: 3, is_stale: true, status: 'resolved' })];

describe('useStaleProblems', () => {
    it('keeps only active problems flagged stale', async () => {
        stub_api({ 'GET /api/problems': all });
        const { result } = renderHook(() => useStaleProblems());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.problems.map((p) => p.id)).toEqual([1]);
    });

    it('keep posts to /keep and removes the prompt', async () => {
        const mock = stub_api({ 'GET /api/problems': all, 'POST /api/problems/1/keep': problem({ id: 1 }) });
        const { result } = renderHook(() => useStaleProblems());
        await waitFor(() => expect(result.current.problems).toHaveLength(1));
        await act(async () => void (await result.current.keep(1)));
        expect(result.current.problems).toEqual([]);
        expect((mock.mock.calls[1]![1] as RequestInit).method).toBe('POST');
    });

    it('discard PATCHes status discarded and removes the prompt', async () => {
        const mock = stub_api({ 'GET /api/problems': all, 'PATCH /api/problems/1': problem({ id: 1, status: 'discarded' }) });
        const { result } = renderHook(() => useStaleProblems());
        await waitFor(() => expect(result.current.problems).toHaveLength(1));
        await act(async () => void (await result.current.discard(1)));
        expect(sent_body(mock, 1)).toEqual({ status: 'discarded' });
        expect(result.current.problems).toEqual([]);
    });

    it('a failed action keeps the prompt and explains why', async () => {
        stub_api({ 'GET /api/problems': all, 'POST /api/problems/1/keep': envelope(null, 500, 'Could not save.') });
        const { result } = renderHook(() => useStaleProblems());
        await waitFor(() => expect(result.current.problems).toHaveLength(1));
        await act(async () => void (await result.current.keep(1)));
        expect(result.current.problems).toHaveLength(1);
        expect(result.current.action_error).toBe('Could not save.');
        expect(result.current.busy_id).toBeNull();
    });

    it('reports a load error', async () => {
        stub_api({ 'GET /api/problems': envelope(null, 500, 'Down.') });
        const { result } = renderHook(() => useStaleProblems());
        await waitFor(() => expect(result.current.error).toBe('Down.'));
    });
});
