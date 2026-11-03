import { useCallback, useEffect, useState } from 'react';
import type { JournalInsight } from '@therapy-aid/shared';
import { getAPI, isOk, postAPI } from '@/services/api';

/* The notes on one journal entry — margin notes and reflections together, as the server lists
   them (GET /journal/:id/insights, dismissed ones excluded) — plus the two things the editor does
   with them: `generate` writes a reflection on demand (POST /journal/:id/insights with the
   current draft — the server also saves it as the entry body; it can take a minute, so it has
   its own flag and error), and `dismiss` hides one note for good (optimistic; restored on
   failure). `add` is how a margin note that arrived through use-margin-notes joins the list. */

const newest_first = (a: JournalInsight, b: JournalInsight) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1);

export const useInsights = (entry_id: number | null) => {
    const [insights, set_insights] = useState<JournalInsight[]>([]);
    const [loading, set_loading] = useState(false);
    // True once the history has been fetched (at once for a brand-new draft, which has none).
    const [loaded, set_loaded] = useState(entry_id === null);
    const [error, set_error] = useState<string | null>(null);
    const [generating, set_generating] = useState(false);
    const [generate_error, set_generate_error] = useState<string | null>(null);

    const load = useCallback(
        async (signal: { cancelled: boolean }) => {
            if (entry_id === null) return;
            set_loading(true);
            set_loaded(false);
            const res = await getAPI<JournalInsight[]>(`journal/${entry_id}/insights`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                set_insights([...res.data].sort(newest_first));
                set_error(null);
            } else {
                set_error(res.message);
            }
            set_loading(false);
            set_loaded(true);
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
        set_loaded(entry_id === null);
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [load, entry_id]);

    const reload = useCallback(() => load({ cancelled: false }), [load]);

    const add = useCallback((note: JournalInsight) => set_insights((prev) => [...prev.filter((i) => i.id !== note.id), note].sort(newest_first)), []);

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
            add(res.data);
            return res.data;
        },
        [entry_id, add],
    );

    const dismiss = useCallback(
        async (note_id: number): Promise<void> => {
            if (entry_id === null) return;
            let removed: JournalInsight | undefined;
            set_insights((prev) => {
                removed = prev.find((i) => i.id === note_id);
                return prev.filter((i) => i.id !== note_id);
            });
            const res = await postAPI<JournalInsight>(`journal/${entry_id}/insights/${note_id}/dismiss`);
            if (!isOk(res) && removed) {
                const back = removed;
                set_insights((prev) => [...prev, back].sort(newest_first));
                set_error(res.message);
            }
        },
        [entry_id],
    );

    return { insights, loading, loaded, error, reload, generating, generate_error, generate, add, dismiss };
};
