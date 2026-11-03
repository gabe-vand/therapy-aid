import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@therapy-aid/shared';
import { getAPI, isOk } from '@/services/api';

/* GET /search?q= for the command palette: debounced (SEARCH_DEBOUNCE_MS after the last
   keystroke), and a reply for an older query never overwrites a newer one. An empty query clears
   the results without a request. */
export const SEARCH_DEBOUNCE_MS = 180;

export const useSearch = (query: string) => {
    const [results, set_results] = useState<SearchResult[]>([]);
    const [searching, set_searching] = useState(false);
    const [error, set_error] = useState<string | null>(null);
    const latest = useRef(0);

    const run = useCallback(async (q: string) => {
        const id = ++latest.current;
        set_searching(true);
        const res = await getAPI<SearchResult[]>(`search?q=${encodeURIComponent(q)}`);
        if (id !== latest.current) return;
        if (isOk(res)) {
            set_results(res.data);
            set_error(null);
        } else {
            set_error(res.message);
        }
        set_searching(false);
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (!q) {
            latest.current++;
            set_results([]);
            set_searching(false);
            set_error(null);
            return;
        }
        const timer = setTimeout(() => void run(q), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query, run]);

    return { results, searching, error };
};
