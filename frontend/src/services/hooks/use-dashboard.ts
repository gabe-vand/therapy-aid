import { useCallback, useEffect, useState } from 'react';
import type { Dashboard } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* GET /dashboard — the numbers Home (and the Problems list's thread marks) draw. Cheap on the
   server (rows only, no AI), so it simply loads on mount and on demand. */
export const useDashboard = () => {
    const [dashboard, set_dashboard] = useState<Dashboard | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);

    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<Dashboard>('dashboard');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_dashboard(res.data);
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

    return { dashboard, loading, error, reload };
};
