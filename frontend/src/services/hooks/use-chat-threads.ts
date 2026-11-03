import { useCallback, useEffect, useState } from 'react';
import type { ChatThread } from '@therapy-aid/shared';
import { deleteAPI, getAPI, isOk, postAPI } from '@/services/api';

/* The chat thread list: load on mount, create a new thread, delete one. Owns the list's loading,
   error and mutation state so the Chat page only renders. `refresh` re-reads quietly (no
   skeleton, a failure keeps the list we have) — the page calls it after a message is sent, since
   that is when the server sets the thread's title and bumps its position. */

// Most recently touched first; id breaks ties so the order is stable.
const newest_first = (threads: ChatThread[]) => [...threads].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : b.id - a.id));

export const useChatThreads = () => {
    const [threads, set_threads] = useState<ChatThread[]>([]);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [creating, set_creating] = useState(false);
    const [deleting, set_deleting] = useState(false);
    const [action_error, set_action_error] = useState<string | null>(null);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(async (signal: { cancelled: boolean }, quiet: boolean) => {
        if (!quiet) set_loading(true);
        const res = await getAPI<ChatThread[]>('chat/threads');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_threads(newest_first(res.data));
            set_error(null);
        } else if (!quiet) {
            set_error(res.message);
        }
        if (!quiet) set_loading(false);
    }, []);

    useEffect(() => {
        const signal = { cancelled: false };
        void load(signal, false);
        return () => {
            signal.cancelled = true;
        };
    }, [load]);

    const reload = useCallback(() => load({ cancelled: false }, false), [load]);
    const refresh = useCallback(() => load({ cancelled: false }, true), [load]);

    /* Creates an empty thread and puts it at the top; resolves to it so the page can open it. */
    const create = useCallback(async (): Promise<ChatThread | null> => {
        set_creating(true);
        set_action_error(null);
        const res = await postAPI<ChatThread>('chat/threads', {});
        set_creating(false);
        if (!isOk(res)) {
            set_action_error(res.message);
            return null;
        }
        set_threads((prev) => newest_first([res.data, ...prev.filter((t) => t.id !== res.data.id)]));
        return res.data;
    }, []);

    /* Resolves true once the server has deleted it (the row leaves the list only then). */
    const remove = useCallback(async (id: number): Promise<boolean> => {
        set_deleting(true);
        set_action_error(null);
        const res = await deleteAPI<unknown>(`chat/threads/${id}`);
        set_deleting(false);
        if (res.status_code !== 200) {
            set_action_error(res.message);
            return false;
        }
        set_threads((prev) => prev.filter((t) => t.id !== id));
        return true;
    }, []);

    const clear_action_error = useCallback(() => set_action_error(null), []);

    return { threads, loading, error, reload, refresh, create, creating, remove, deleting, action_error, clear_action_error };
};
