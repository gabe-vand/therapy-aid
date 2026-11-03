import { useCallback, useEffect, useState } from 'react';
import type { Problem } from '@therapy-aid/shared';
import { getAPI, isOk, patchAPI, postAPI } from '@/services/api';

/* The "still relevant?" prompts on Home: active problems the API flags is_stale (untouched for
   30 days). Keep (POST /problems/:id/keep) and Discard (PATCH status discarded) both take the
   problem off the list on success; busy_id lets the card disable itself while its call runs. */
export const useStaleProblems = () => {
    const [problems, set_problems] = useState<Problem[]>([]);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [busy_id, set_busy_id] = useState<number | null>(null);
    const [action_error, set_action_error] = useState<string | null>(null);

    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<Problem[]>('problems');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_problems(res.data.filter((p) => p.is_stale && p.status === 'active'));
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

    // Shared by keep/discard: run the call, drop the problem from the list only when it succeeded.
    const resolve_prompt = useCallback(async (id: number, call: () => Promise<{ status_code: number; message: string }>): Promise<boolean> => {
        set_busy_id(id);
        set_action_error(null);
        const res = await call();
        set_busy_id(null);
        if (res.status_code !== 200) {
            set_action_error(res.message);
            return false;
        }
        set_problems((prev) => prev.filter((p) => p.id !== id));
        return true;
    }, []);

    const keep = useCallback((id: number) => resolve_prompt(id, () => postAPI(`problems/${id}/keep`)), [resolve_prompt]);
    const discard = useCallback((id: number) => resolve_prompt(id, () => patchAPI(`problems/${id}`, { status: 'discarded' })), [resolve_prompt]);

    return { problems, loading, error, reload, keep, discard, busy_id, action_error };
};
