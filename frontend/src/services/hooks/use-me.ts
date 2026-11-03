import { useCallback, useEffect, useState } from 'react';
import type { Me } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* Who is signed in (the Tailscale login the API accepted): GET /me on mount. Settings shows it;
   a 401 here means the tailnet header isn't reaching the API. Owns its loading and error state. */
export const useMe = () => {
    const [me, set_me] = useState<Me | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<Me>('me');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_me(res.data);
            set_error(null);
        } else {
            set_error(res.status_code === 401 ? 'You are not signed in to the tailnet as the allowed user.' : res.message);
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

    return { me, loading, error, reload };
};
