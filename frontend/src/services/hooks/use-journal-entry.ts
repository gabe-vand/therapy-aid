import { useCallback, useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '@therapy-aid/shared';
import { deleteAPI, getAPI, isOk } from '@/services/api';
import { to_date_input, today_input } from '@/services/dates';
import { type Doc, new_doc, park, parked_count, send_doc, unpark } from '@/services/hooks/journal-autosave';
import { usePageExit } from '@/services/hooks/use-page-exit';

/* One journal entry in the editor, with autosave. The draft lives in a mutable `Doc` (a ref) so a
   save always works on the entry it was started for, even if the user has since switched entries:
   - a NEW draft (id null) is created with POST on the first non-blank keystroke;
   - after that every edit schedules a PATCH 1.5s after the last keystroke (debounce);
   - leaving the entry or unmounting flushes any unsaved text immediately, and so does the page being
     hidden or closed (phone backgrounded, tab closed or refreshed — use-page-exit, sent with
     keepalive so the request outlives the page);
   - a failed save on screen keeps the text, shows the error, and retries on the next edit or
     `save_now`; one that fails after the entry left the screen is parked in the outbox
     (journal-autosave) and retried until it lands, so a flaky connection at the moment of leaving
     does not lose the text either.
   The page learns about saves through `on_change` (keep the list fresh) and `on_created` (move the
   URL to the new entry — the hook then skips re-fetching the entry it just made). */

export const AUTOSAVE_MS = 1500;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Options = { on_change?: (entry: JournalEntry) => void; on_created?: (entry: JournalEntry) => void };

export const useJournalEntry = (id: number | null, options: Options = {}) => {
    const [entry_id, set_entry_id] = useState<number | null>(id);
    const [body, set_body_state] = useState('');
    const [date, set_date_state] = useState(today_input());
    const [loaded_length, set_loaded_length] = useState(0);
    const [loading, set_loading] = useState(id !== null);
    const [error, set_error] = useState<string | null>(null);
    const [save_state, set_save_state] = useState<SaveState>('idle');
    const [save_error, set_save_error] = useState<string | null>(null);
    const [deleting, set_deleting] = useState(false);
    const [attempt, set_attempt] = useState(0);

    const doc_ref = useRef<Doc>(new_doc(id));
    const created_ref = useRef<number | null>(null);
    const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted_ref = useRef(false);
    const options_ref = useRef(options);
    options_ref.current = options;

    const clear_timer = () => {
        if (timer_ref.current) clearTimeout(timer_ref.current);
        timer_ref.current = null;
    };

    const save = useCallback(async (doc: Doc, keepalive = false): Promise<void> => {
        clear_timer();
        if (doc.in_flight || !doc.dirty) return; // an in-flight save reschedules itself if more text arrived
        if (doc.id === null && !doc.body.trim()) return; // nothing worth creating yet
        const live = () => doc_ref.current === doc;
        if (live()) set_save_state('saving');

        const { res, was_new } = await send_doc(doc, keepalive);
        if (!isOk(res)) {
            if (live() && mounted_ref.current) {
                set_save_state('error');
                set_save_error(res.message);
            } else {
                park(doc); // off screen: nobody would see the error, so keep retrying it
            }
            return;
        }
        options_ref.current.on_change?.(res.data);
        if (was_new && live()) {
            created_ref.current = res.data.id;
            set_entry_id(res.data.id);
            options_ref.current.on_created?.(res.data);
        }
        if (doc.dirty) {
            // More text arrived while saving: debounce again if still on screen, else send it now.
            if (live() && mounted_ref.current) timer_ref.current = setTimeout(() => void save(doc), AUTOSAVE_MS);
            else void save(doc);
        } else if (live()) {
            set_save_state('saved');
            set_save_error(null);
        }
    }, []);

    // Load (or reset to a blank draft) whenever the route's entry changes.
    useEffect(() => {
        if (id !== null && id === created_ref.current) return; // we just created it: state is already current
        void save(doc_ref.current); // flush the entry we are leaving
        const parked = id === null ? null : unpark(id); // its last save failed off screen: that text is newer
        const doc = parked ?? new_doc(id);
        doc_ref.current = doc;
        created_ref.current = null;
        const signal = { cancelled: false };
        set_entry_id(id);
        set_body_state('');
        set_date_state(doc.date);
        set_loaded_length(0);
        set_save_state('idle');
        set_save_error(null);
        set_error(null);
        if (id === null || parked) {
            set_body_state(doc.body);
            set_date_state(doc.date);
            set_loaded_length(doc.body.length);
            set_loading(false);
            if (parked) void save(doc);
            return;
        }
        set_loading(true);
        void (async () => {
            const res = await getAPI<JournalEntry>(`journal/${id}`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                doc.body = res.data.body;
                doc.date = to_date_input(res.data.occurred_at);
                set_body_state(doc.body);
                set_date_state(doc.date);
                set_loaded_length(doc.body.length);
            } else {
                set_error(res.status_code === 404 ? 'This entry no longer exists.' : res.message);
            }
            set_loading(false);
        })();
        return () => {
            signal.cancelled = true;
        };
    }, [id, attempt, save]);

    // Unmounting flushes unsaved text; a quick navigation away must not eat the last sentence.
    useEffect(() => {
        mounted_ref.current = true;
        return () => {
            mounted_ref.current = false;
            void save(doc_ref.current);
        };
    }, [save]);

    // The page being hidden or closed never unmounts anything: flush with keepalive right then.
    const unsaved = () => {
        const doc = doc_ref.current;
        return parked_count() > 0 || (doc.dirty && (doc.id !== null || !!doc.body.trim()));
    };
    usePageExit(() => void save(doc_ref.current, true), unsaved);

    const schedule = (doc: Doc) => {
        clear_timer();
        timer_ref.current = setTimeout(() => void save(doc), AUTOSAVE_MS);
    };

    const set_body = useCallback(
        (value: string) => {
            const doc = doc_ref.current;
            doc.body = value;
            doc.dirty = true;
            set_body_state(value);
            if (doc.id === null) {
                if (value.trim()) void save(doc); // first keystroke creates the entry
                return;
            }
            set_save_state('saving');
            schedule(doc);
        },
        [save],
    );

    const set_date = useCallback((value: string) => {
        const doc = doc_ref.current;
        doc.date = value;
        set_date_state(value);
        if (doc.id === null) return; // rides along on create (send_doc re-sends it if it changed mid-create)
        doc.date_dirty = true;
        doc.dirty = true;
        set_save_state('saving');
        schedule(doc);
    }, []);

    const save_now = useCallback(() => save(doc_ref.current), [save]);

    const remove = useCallback(async (): Promise<boolean> => {
        const doc = doc_ref.current;
        if (doc.id === null) return true;
        clear_timer();
        doc.dirty = false;
        set_deleting(true);
        const res = await deleteAPI(`journal/${doc.id}`);
        set_deleting(false);
        if (res.status_code !== 200) {
            set_save_state('error');
            set_save_error(res.message);
            return false;
        }
        return true;
    }, []);

    const retry = useCallback(() => set_attempt((n) => n + 1), []);

    return { entry_id, body, date, loaded_length, loading, error, retry, save_state, save_error, set_body, set_date, save_now, remove, deleting };
};
