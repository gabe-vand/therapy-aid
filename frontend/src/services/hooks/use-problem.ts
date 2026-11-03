import { useCallback, useEffect, useState } from 'react';
import type { ProblemDetail, ProblemStatus } from '@therapy-aid/shared';
import { getAPI, isOk, patchAPI, postAPI } from '@/services/api';

/* One problem and its timeline. Edits (title / description), status changes (resolve, reopen,
   discard), Keep, and manual notes all go through here; after every successful mutation the
   detail is refetched quietly so the timeline and derived fields never drift from the server.
   Each mutation resolves to true/false and parks a human message in `action_error` on failure. */
export const useProblem = (id: number | null) => {
    const [problem, set_problem] = useState<ProblemDetail | null>(null);
    const [loading, set_loading] = useState(id !== null);
    const [error, set_error] = useState<string | null>(null);
    const [busy, set_busy] = useState(false);
    const [action_error, set_action_error] = useState<string | null>(null);

    const load = useCallback(
        async (signal: { cancelled: boolean }, quiet = false) => {
            if (id === null) return;
            if (!quiet) set_loading(true);
            const res = await getAPI<ProblemDetail>(`problems/${id}`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                set_problem(res.data);
                set_error(null);
            } else {
                set_error(res.status_code === 404 ? 'This problem no longer exists.' : res.message);
            }
            set_loading(false);
        },
        [id],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        set_problem(null);
        if (id === null) {
            set_loading(false);
            set_error('Problem not found.');
        } else {
            void load(signal);
        }
        return () => {
            signal.cancelled = true;
        };
    }, [id, load]);

    const reload = useCallback(() => load({ cancelled: false }), [load]);

    const mutate = useCallback(
        async (call: () => Promise<{ ok: boolean; message: string }>) => {
            set_busy(true);
            set_action_error(null);
            const result = await call();
            if (result.ok) await load({ cancelled: false }, true);
            else set_action_error(result.message);
            set_busy(false);
            return result.ok;
        },
        [load],
    );

    const patch = useCallback(
        (fields: { title?: string; description?: string; status?: ProblemStatus }) =>
            mutate(async () => {
                const res = await patchAPI(`problems/${id}`, fields);
                return { ok: res.status_code === 200, message: res.message };
            }),
        [mutate, id],
    );

    const keep = useCallback(
        () =>
            mutate(async () => {
                const res = await postAPI(`problems/${id}/keep`);
                return { ok: res.status_code === 200, message: res.message };
            }),
        [mutate, id],
    );

    const add_note = useCallback(
        (body: string) =>
            mutate(async () => {
                const res = await postAPI(`problems/${id}/updates`, { body });
                return { ok: res.status_code === 200, message: res.message };
            }),
        [mutate, id],
    );

    return { problem, loading, error, reload, busy, action_error, patch, keep, add_note };
};
