import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@therapy-aid/shared';
import { deleteAPI, getAPI, isOk, patchAPI, postAPI } from '@/services/api';

/* One session (GET /sessions/:id) plus everything you can do to it. While the pipeline is still
   working (anything but ready|failed) it polls every 3s — a network blip or 5xx mid-poll keeps
   the last good data on screen and tries again; a 4xx stops the polling and shows the error.
   Mutations are explicit triggers: save (PATCH date/title), retry, remove. */

export const POLL_MS = 3000;
const is_settled = (s: Session) => s.status === 'ready' || s.status === 'failed';

export const useSession = (id: number | null) => {
    const [session, set_session] = useState<Session | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [busy, set_busy] = useState(false);
    const [action_error, set_action_error] = useState<string | null>(null);
    // Bumping the epoch restarts the polling effect (after a retry, or the Retry button on a load error).
    const [epoch, set_epoch] = useState(0);
    // What the poll loop last saw, so a failed tick knows whether there is something to keep.
    const last = useRef<Session | null>(null);

    useEffect(() => {
        if (id === null) return;
        const signal = { cancelled: false };
        let timer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            const res = await getAPI<Session>(`sessions/${id}`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                last.current = res.data;
                set_session(res.data);
                set_error(null);
                if (!is_settled(res.data)) timer = setTimeout(() => void tick(), POLL_MS);
            } else if (last.current && !is_settled(last.current) && (res.status_code === 0 || res.status_code >= 500)) {
                timer = setTimeout(() => void tick(), POLL_MS);
            } else {
                set_error(res.message);
            }
            set_loading(false);
        };

        last.current = null;
        set_loading(true);
        set_error(null);
        void tick();
        return () => {
            signal.cancelled = true;
            clearTimeout(timer);
        };
    }, [id, epoch]);

    const reload = useCallback(() => set_epoch((n) => n + 1), []);

    // Shared by the mutations: run, surface the message on failure, report success.
    const act = useCallback(async (call: () => Promise<{ status_code: number; message: string }>): Promise<boolean> => {
        set_busy(true);
        set_action_error(null);
        const res = await call();
        set_busy(false);
        if (res.status_code !== 200) {
            set_action_error(res.message);
            return false;
        }
        return true;
    }, []);

    const save = useCallback(
        async (patch: { occurred_at?: string; title?: string }) => {
            let returned: Partial<Session> | null = null;
            const ok = await act(async () => {
                const res = await patchAPI<Partial<Session>>(`sessions/${id}`, patch);
                returned = res.data;
                return res;
            });
            if (ok) set_session((s) => (s ? { ...s, ...patch, ...(returned ?? {}) } : s));
            return ok;
        },
        [act, id],
    );

    const retry = useCallback(async () => {
        const ok = await act(() => postAPI(`sessions/${id}/retry`));
        if (ok) set_epoch((n) => n + 1);
        return ok;
    }, [act, id]);

    const remove = useCallback(() => act(() => deleteAPI(`sessions/${id}`)), [act, id]);

    return { session, loading, error, reload, busy, action_error, save, retry, remove };
};
