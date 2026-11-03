import { useCallback, useState } from 'react';
import type { Session } from '@therapy-aid/shared';
import { isOk, postAPI } from '@/services/api';
import { from_date_input } from '@/services/dates';

/* Submits pasted notes as a new session (POST /sessions/notes). The server stores them and starts
   summarising in the background, so this resolves with the new session id as soon as it is saved;
   the page then navigates to the session, which polls until it is ready. */
export const useNotesUpload = () => {
    const [submitting, set_submitting] = useState(false);
    const [error, set_error] = useState<string | null>(null);

    // `date` is the <input type="date"> value; it becomes noon local time so it never slips a day.
    const submit = useCallback(async (input: { date: string; title: string; notes: string }): Promise<number | null> => {
        const occurred_at = from_date_input(input.date);
        if (!occurred_at) {
            set_error('Pick the date of the session.');
            return null;
        }
        set_submitting(true);
        set_error(null);
        const title = input.title.trim();
        const res = await postAPI<Session>('sessions/notes', { occurred_at, notes: input.notes.trim(), ...(title ? { title } : {}) });
        set_submitting(false);
        if (!isOk(res)) {
            set_error(res.message);
            return null;
        }
        return res.data.id;
    }, []);

    return { submit, submitting, error };
};
