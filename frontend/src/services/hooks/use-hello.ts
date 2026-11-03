import { useCallback, useEffect, useState } from 'react';
import type { HelloStatus } from '@therapy-aid/shared';
import { getAPI, postAPI } from '@/services/api';

/* The hello-world smoke test's data: loads GET /hello on mount and exposes an explicit
   record_visit trigger (mutations never auto-fire). Owns its loading and error state. */
export const useHello = () => {
    const [status, set_status] = useState<HelloStatus | null>(null);
    const [loading, set_loading] = useState(true);
    const [recording, set_recording] = useState(false);
    const [error, set_error] = useState<string | null>(null);

    // Shared by the loader and the mutation: both answer with a full HelloStatus.
    const apply = useCallback((res: { data: HelloStatus | null; status_code: number; message: string }) => {
        if (res.status_code === 200 && res.data) {
            set_status(res.data);
            set_error(null);
        } else {
            set_error(res.message);
        }
    }, []);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(
        async (signal: { cancelled: boolean }) => {
            set_loading(true);
            const res = await getAPI<HelloStatus>('hello');
            if (signal.cancelled) return;
            apply(res);
            set_loading(false);
        },
        [apply],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [load]);

    const record_visit = useCallback(async () => {
        set_recording(true);
        apply(await postAPI<HelloStatus>('hello/visits'));
        set_recording(false);
    }, [apply]);

    return { status, loading, recording, error, record_visit };
};
