import { useCallback, useEffect, useState } from 'react';
import type { AiUsage } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* What the AI has cost since the API booted: GET /ai/usage on mount, `reload` to re-read it.
   The counters live in the server's memory, so they restart from zero with every deploy. */
export const useAiUsage = () => {
    const [usage, set_usage] = useState<AiUsage | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<AiUsage>('ai/usage');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_usage(res.data);
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

    return { usage, loading, error, reload };
};
