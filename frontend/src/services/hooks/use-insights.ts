import { useCallback, useEffect, useState } from 'react';
import type { JournalInsight } from '@therapy-aid/shared';
import { getAPI, isOk, postAPI } from '@/services/api';

/* The "I have an idea…" insights for one journal entry: the history (GET) and the on-demand
   generation (POST with the current draft — the server also saves it as the entry body). It
   NEVER generates by itself: `generate` runs only when the UI calls it from a click. Generation
   can take a minute, so `generating` is its own flag and its error is separate from the history's. */

const newest_first = (a: JournalInsight, b: JournalInsight) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1);

export const useInsights = (entry_id: number | null) => {
    const [insights, set_insights] = useState<JournalInsight[]>([]);
    const [loading, set_loading] = useState(false);
    const [error, set_error] = useState<string | null>(null);
    const [generating, set_generating] = useState(false);
    const [generate_error, set_generate_error] = useState<string | null>(null);

    const load = useCallback(
        async (signal: { cancelled: boolean }) => {
            if (entry_id === null) return;
            set_loading(true);
            const res = await getAPI<JournalInsight[]>(`journal/${entry_id}/insights`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                set_insights([...res.data].sort(newest_first));
                set_error(null);
            } else {
                set_error(res.message);
            }
            set_loading(false);
        },
        [entry_id],
    );

    // A different entry starts from a clean slate; null (a brand-new draft) has no history.
    useEffect(() => {
        const signal = { cancelled: false };
        set_insights([]);
        set_error(null);
        set_generate_error(null);
        set_generating(false);
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [load]);

    const reload = useCallback(() => load({ cancelled: false }), [load]);

    const generate = useCallback(
        async (draft: string): Promise<JournalInsight | null> => {
            if (entry_id === null) return null;
            set_generating(true);
            set_generate_error(null);
            const res = await postAPI<JournalInsight>(`journal/${entry_id}/insights`, { body: draft });
            set_generating(false);
            if (!isOk(res)) {
                set_generate_error(res.message);
                return null;
            }
            set_insights((prev) => [...prev.filter((i) => i.id !== res.data.id), res.data].sort(newest_first));
            return res.data;
        },
        [entry_id],
    );

    return { insights, loading, error, reload, generating, generate_error, generate };
};
