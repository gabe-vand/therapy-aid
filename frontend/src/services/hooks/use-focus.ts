import { useCallback, useEffect, useState } from 'react';
import type { FocusSnapshot } from '@therapy-aid/shared';
import { getAPI, isOk, postAPI, putAPI } from '@/services/api';

/* Home's focus banner: the latest snapshot (GET /focus — null before the first session, which is
   a normal empty state, not an error), an on-demand regenerate (POST /focus/regenerate, which
   calls the AI and can take a while), and the per-day check-ins against each item's action
   (PUT /focus/checkins — applied optimistically, rolled back on failure). A failed regenerate
   keeps the snapshot already on screen. */
export const useFocus = () => {
    const [focus, set_focus] = useState<FocusSnapshot | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [regenerating, set_regenerating] = useState(false);
    const [regenerate_error, set_regenerate_error] = useState<string | null>(null);
    const [checkin_error, set_checkin_error] = useState<string | null>(null);

    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<FocusSnapshot>('focus');
        if (signal.cancelled) return;
        if (res.status_code === 200) {
            set_focus(res.data);
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

    // Explicit trigger only — never fires on its own.
    const regenerate = useCallback(async () => {
        set_regenerating(true);
        set_regenerate_error(null);
        const res = await postAPI<FocusSnapshot>('focus/regenerate');
        if (isOk(res)) {
            set_focus(res.data);
            set_error(null);
        } else {
            set_regenerate_error(res.message);
        }
        set_regenerating(false);
    }, []);

    /* Toggles item `item_index` for `day` (YYYY-MM-DD, local). The dot flips at once; the
       server's answer replaces the snapshot, or the flip is undone and the error kept. */
    const toggle_checkin = useCallback(
        async (item_index: number, day: string) => {
            if (!focus) return;
            const was_done = focus.checkins.some((c) => c.item_index === item_index && c.day === day);
            const optimistic = { ...focus, checkins: was_done ? focus.checkins.filter((c) => !(c.item_index === item_index && c.day === day)) : [...focus.checkins, { item_index, day }] };
            set_focus(optimistic);
            set_checkin_error(null);
            const res = await putAPI<FocusSnapshot>('focus/checkins', { item_index, day, done: !was_done });
            if (isOk(res)) set_focus(res.data);
            else {
                set_focus(focus);
                set_checkin_error(res.message);
            }
        },
        [focus],
    );

    return { focus, loading, error, reload, regenerate, regenerating, regenerate_error, toggle_checkin, checkin_error };
};
