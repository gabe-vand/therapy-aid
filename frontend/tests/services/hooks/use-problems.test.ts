import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useProblems } from '@/services/hooks/use-problems';
import { envelope, sent_body, stub_api, stub_unreachable } from '../../helpers/hlp-fetch';
import { problem } from '../../helpers/hlp-problems-journal';

const calls = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);

describe('useProblems', () => {
    it('loads GET /api/problems on mount', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 1 }), problem({ id: 2, status: 'resolved' })] });
        const { result } = renderHook(() => useProblems());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.problems.map((p) => p.id)).toEqual([1, 2]);
        expect(result.current.error).toBeNull();
    });

    it('surfaces an unreachable server and recovers on reload', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useProblems());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);

        stub_api({ '/api/problems': [problem()] });
        await act(() => result.current.reload());
        expect(result.current.problems).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    it('Keep posts to /keep and reloads the list quietly', async () => {
        let stale = true;
        const mock = stub_api({
            'GET /api/problems': () => [problem({ id: 3, is_stale: stale })],
            'POST /api/problems/3/keep': () => {
                stale = false;
                return {};
            },
        });
        const { result } = renderHook(() => useProblems());
        await waitFor(() => expect(result.current.problems[0]?.is_stale).toBe(true));

        let ok = false;
        await act(async () => {
            ok = await result.current.keep(3);
        });
        expect(ok).toBe(true);
        expect(calls(mock)).toContain('POST /api/problems/3/keep');
        expect(result.current.problems[0]?.is_stale).toBe(false);
        expect(result.current.busy_id).toBeNull();
    });

    it('Discard patches status "discarded" and drops it from the reloaded list', async () => {
        let discarded = false;
        const mock = stub_api({
            'GET /api/problems': () => (discarded ? [] : [problem({ id: 5 })]),
            'PATCH /api/problems/5': () => {
                discarded = true;
                return {};
            },
        });
        const { result } = renderHook(() => useProblems());
        await waitFor(() => expect(result.current.problems).toHaveLength(1));

        await act(async () => {
            await result.current.discard(5);
        });
        const patch_index = calls(mock).indexOf('PATCH /api/problems/5');
        expect(sent_body(mock, patch_index)).toEqual({ status: 'discarded' });
        expect(result.current.problems).toEqual([]);
    });

    it('a failed Keep reports the message and leaves the list alone', async () => {
        stub_api({ 'GET /api/problems': [problem({ id: 3 })], 'POST /api/problems/3/keep': envelope(null, 500, 'Could not save.') });
        const { result } = renderHook(() => useProblems());
        await waitFor(() => expect(result.current.problems).toHaveLength(1));

        let ok = true;
        await act(async () => {
            ok = await result.current.keep(3);
        });
        expect(ok).toBe(false);
        expect(result.current.action_error).toBe('Could not save.');
        expect(result.current.problems).toHaveLength(1);
    });

    it('create posts title and description, then reloads', async () => {
        let created = false;
        const mock = stub_api({
            'GET /api/problems': () => (created ? [problem({ id: 9, title: 'Sleep' })] : []),
            'POST /api/problems': () => {
                created = true;
                return problem({ id: 9, title: 'Sleep' });
            },
        });
        const { result } = renderHook(() => useProblems());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let ok = false;
        await act(async () => {
            ok = await result.current.create('Sleep', 'Not enough of it.');
        });
        expect(ok).toBe(true);
        const post_index = calls(mock).indexOf('POST /api/problems');
        expect(sent_body(mock, post_index)).toEqual({ title: 'Sleep', description: 'Not enough of it.' });
        expect(result.current.problems.map((p) => p.title)).toEqual(['Sleep']);
        expect(result.current.creating).toBe(false);
    });
});
