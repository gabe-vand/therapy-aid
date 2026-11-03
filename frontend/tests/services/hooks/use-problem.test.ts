import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useProblem } from '@/services/hooks/use-problem';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { problem_detail, update } from '../../helpers/hlp-problems-journal';

const calls = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);

describe('useProblem', () => {
    it('loads the detail with its timeline', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail({ updates: [update({ id: 7 })] }) });
        const { result } = renderHook(() => useProblem(1));
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.problem?.updates.map((u) => u.id)).toEqual([7]);
    });

    it('says plainly when the problem does not exist', async () => {
        stub_api({ 'GET /api/problems/9': envelope(null, 404, 'ENTRY_NOT_FOUND') });
        const { result } = renderHook(() => useProblem(9));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('This problem no longer exists.');
        expect(result.current.problem).toBeNull();
    });

    it('a null id never calls the network', () => {
        const mock = stub_api({});
        const { result } = renderHook(() => useProblem(null));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Problem not found.');
        expect(mock).not.toHaveBeenCalled();
    });

    it('patch sends only the changed fields, then refetches without a loading flash', async () => {
        let title = 'Old';
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ title }),
            'PATCH /api/problems/1': (init?: RequestInit) => {
                title = (JSON.parse(String(init?.body)) as { title: string }).title;
                return {};
            },
        });
        const { result } = renderHook(() => useProblem(1));
        await waitFor(() => expect(result.current.problem?.title).toBe('Old'));

        let ok = false;
        await act(async () => {
            ok = await result.current.patch({ title: 'New' });
        });
        expect(ok).toBe(true);
        expect(sent_body(mock, calls(mock).indexOf('PATCH /api/problems/1'))).toEqual({ title: 'New' });
        expect(result.current.problem?.title).toBe('New');
        expect(result.current.loading).toBe(false);
    });

    it('resolve, reopen and discard are status patches', async () => {
        const mock = stub_api({ 'GET /api/problems/1': problem_detail(), 'PATCH /api/problems/1': {} });
        const { result } = renderHook(() => useProblem(1));
        await waitFor(() => expect(result.current.problem).not.toBeNull());
        for (const status of ['resolved', 'active', 'discarded'] as const) {
            await act(async () => {
                await result.current.patch({ status });
            });
        }
        const bodies = calls(mock)
            .map((c, i) => (c === 'PATCH /api/problems/1' ? sent_body(mock, i) : null))
            .filter(Boolean);
        expect(bodies).toEqual([{ status: 'resolved' }, { status: 'active' }, { status: 'discarded' }]);
    });

    it('add_note posts the body and shows the new note after the refetch', async () => {
        let notes = [update({ id: 1 })];
        const mock = stub_api({
            'GET /api/problems/1': () => problem_detail({ updates: notes }),
            'POST /api/problems/1/updates': () => {
                notes = [update({ id: 2, source: 'manual', session_id: null, session_title: null, body: 'Slept better.' }), ...notes];
                return {};
            },
        });
        const { result } = renderHook(() => useProblem(1));
        await waitFor(() => expect(result.current.problem).not.toBeNull());

        await act(async () => {
            await result.current.add_note('Slept better.');
        });
        expect(sent_body(mock, calls(mock).indexOf('POST /api/problems/1/updates'))).toEqual({ body: 'Slept better.' });
        expect(result.current.problem?.updates.map((u) => u.id)).toEqual([2, 1]);
    });

    it('keep posts to /keep; a failure lands in action_error', async () => {
        stub_api({ 'GET /api/problems/1': problem_detail({ is_stale: true }), 'POST /api/problems/1/keep': envelope(null, 500, 'Nope.') });
        const { result } = renderHook(() => useProblem(1));
        await waitFor(() => expect(result.current.problem).not.toBeNull());
        await act(async () => {
            expect(await result.current.keep()).toBe(false);
        });
        expect(result.current.action_error).toBe('Nope.');
        expect(result.current.busy).toBe(false);
    });
});
