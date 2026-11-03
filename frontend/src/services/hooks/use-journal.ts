import { useCallback, useEffect, useState } from 'react';
import type { JournalEntry } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* The journal's entry list (newest first). The editor owns saving (use-journal-entry), so this
   hook only loads the list and lets the page patch it locally — `apply_entry` upserts a saved or
   created entry, `drop_entry` removes a deleted one — instead of refetching on every autosave. */

const newest_first = (a: JournalEntry, b: JournalEntry) => (a.occurred_at === b.occurred_at ? b.id - a.id : a.occurred_at < b.occurred_at ? 1 : -1);

export const useJournal = () => {
    const [entries, set_entries] = useState<JournalEntry[]>([]);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);

    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<JournalEntry[]>('journal');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_entries(res.data);
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

    // Upsert by id, then keep the list sorted the way the API returns it.
    const apply_entry = useCallback((entry: JournalEntry) => {
        set_entries((prev) => [...prev.filter((e) => e.id !== entry.id), entry].sort(newest_first));
    }, []);

    const drop_entry = useCallback((id: number) => {
        set_entries((prev) => prev.filter((e) => e.id !== id));
    }, []);

    return { entries, loading, error, reload, apply_entry, drop_entry };
};
