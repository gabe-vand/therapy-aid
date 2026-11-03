import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '@therapy-aid/shared';
import { getAPI, isOk, putAPI } from '@/services/api';

/* The "About me" profile every prompt includes: GET on mount, PUT to save. The hook keeps the
   last saved copy; the Settings form owns the draft and compares the two to know it is dirty. */
export const useSettings = () => {
    const [profile, set_profile] = useState<Profile | null>(null);
    const [loading, set_loading] = useState(true);
    const [error, set_error] = useState<string | null>(null);
    const [saving, set_saving] = useState(false);
    const [save_error, set_save_error] = useState<string | null>(null);

    // The cancel flag is checked AFTER the await — a superseded response must not paint.
    const load = useCallback(async (signal: { cancelled: boolean }) => {
        set_loading(true);
        const res = await getAPI<Profile>('settings/profile');
        if (signal.cancelled) return;
        if (isOk(res)) {
            set_profile(res.data);
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

    /* Resolves true once the server has stored the text. */
    const save = useCallback(async (text: string): Promise<boolean> => {
        set_saving(true);
        set_save_error(null);
        const res = await putAPI<Profile>('settings/profile', { profile: text });
        set_saving(false);
        if (!isOk(res)) {
            set_save_error(res.message);
            return false;
        }
        set_profile(res.data);
        return true;
    }, []);

    return { profile, loading, error, reload, save, saving, save_error };
};
