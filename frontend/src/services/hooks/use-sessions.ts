import { useCallback, useEffect, useState } from 'react';
import type { SessionListItem } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* The session list (GET /sessions, newest first) for the Sessions page and Home's "last session"
   card. Owns loading and error state; reload() re-fetches without blanking what is already shown. */
export const useSessions = () => {
    const [sessions, set_sessions] = useState<SessionListItem[]>([]);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<SessionListItem[]>('sessions');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_sessions(res.data);
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

    return { sessions, loading, error, reload };
};
