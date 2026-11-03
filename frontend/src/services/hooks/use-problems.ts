import { useCallback, useEffect, useState } from 'react';
import type { Problem } from '@therapy-aid/shared';
import { getAPI, isOk, patchAPI, postAPI } from '@/services/api';

/* The Problems list: active + resolved problems (discarded are hidden by the API), plus what the
   list can do — create one, Keep a stale one (bump last_reviewed_at), Discard one. Every mutation
   reloads quietly afterwards so derived fields (is_stale, update_count) always come from the
   server, and reports failure through `action_error` instead of throwing. */
export const useProblems = () => {
    const [problems, set_problems] = useState<Problem[]>([]);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [busy_id, set_busy_id] = useState<number | null>(null);
    const [creating, set_creating] = useState(false);
    const [action_error, set_action_error] = useState<string | null>(null);

    // `quiet` reloads keep the list on screen (no skeleton flash) after a mutation.
    const load = useCallback(async (signal: { cancelled: boolean }, quiet = false) => {
        if (!quiet) set_loading(true);
        const res = await getAPI<Problem[]>('problems');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_problems(res.data);
            set_error(null);
        } else {
            set_error(res.message);
        }
        set_loading(false);
    }, []);

    useEffect(() => {
        const signal = { cancelled: false };
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [load]);

    const reload = useCallback(() => load({ cancelled: false }), [load]);

    // One mutation at a time per problem: busy_id disables that card's buttons.
    const mutate = useCallback(
        async (id: number, call: () => Promise<{ ok: boolean; message: string }>) => {
            set_busy_id(id);
            set_action_error(null);
            const result = await call();
            if (result.ok) await load({ cancelled: false }, true);
            else set_action_error(result.message);
            set_busy_id(null);
            return result.ok;
        },
        [load],
    );

    const keep = useCallback(
        (id: number) =>
            mutate(id, async () => {
                const res = await postAPI(`problems/${id}/keep`);
                return { ok: res.status_code === 200, message: res.message };
            }),
        [mutate],
    );

    const discard = useCallback(
        (id: number) =>
            mutate(id, async () => {
                const res = await patchAPI(`problems/${id}`, { status: 'discarded' });
                return { ok: res.status_code === 200, message: res.message };
            }),
        [mutate],
    );

    const create = useCallback(
        async (title: string, description: string) => {
            set_creating(true);
            set_action_error(null);
            const res = await postAPI<Problem>('problems', { title, description });
            const ok = res.status_code === 200;
            if (ok) await load({ cancelled: false }, true);
            else set_action_error(res.message);
            set_creating(false);
            return ok;
        },
        [load],
    );

    return { problems, loading, error, reload, keep, discard, create, creating, busy_id, action_error };
};
