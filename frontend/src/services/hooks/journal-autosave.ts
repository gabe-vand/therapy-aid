import type { ApiEnvelope, JournalEntry } from '@therapy-aid/shared';
import { isOk, patchAPI, postAPI } from '@/services/api';
import { from_date_input, today_input } from '@/services/dates';

/* The journal editor's save transport and its outbox. Lives beside use-journal-entry (its only
   user) because it calls the API; it holds no React state.
   - `Doc` is one entry's draft as a mutable object, so a save always works on the entry it was
     started for. `send_doc` POSTs it (no id yet) or PATCHes it, and keeps its bookkeeping: a date
     changed while the request was in flight — including during the very first POST — is left
     dirty, so the next save PATCHes it instead of silently keeping the old date.
   - The outbox: a save that fails after its entry has left the screen (switched entry, unmounted
     editor) would otherwise drop the text with nobody to show an error to. Such a doc is parked
     here and retried every RETRY_MS, and as soon as the browser reports it is back online, until
     it lands. Reopening that entry takes the parked doc back (`unpark`), so the editor shows the
     unsaved text rather than the stale server copy. */

export const RETRY_MS = 5000;

export type Doc = { id: number | null; body: string; date: string; date_dirty: boolean; dirty: boolean; in_flight: boolean };

export const new_doc = (id: number | null): Doc => ({ id, body: '', date: today_input(), date_dirty: false, dirty: false, in_flight: false });

/* Sends the doc's current text (and date, when it changed). The caller has checked it is dirty and
   not already in flight. Never throws (the API layer never does). */
export const send_doc = async (doc: Doc, keepalive = false): Promise<{ res: ApiEnvelope<JournalEntry | null>; was_new: boolean }> => {
    doc.in_flight = true;
    doc.dirty = false;
    const sent_date = doc.date;
    const occurred_at = from_date_input(doc.date);
    const was_new = doc.id === null;
    const res = was_new
        ? await postAPI<JournalEntry>('journal', { body: doc.body, ...(occurred_at ? { occurred_at } : {}) }, { keepalive })
        : await patchAPI<JournalEntry>(`journal/${doc.id}`, { body: doc.body, ...(doc.date_dirty && occurred_at ? { occurred_at } : {}) }, { keepalive });
    doc.in_flight = false;
    if (!isOk(res)) {
        doc.dirty = true;
        return { res, was_new };
    }
    doc.id = res.data.id;
    if (doc.date === sent_date) {
        doc.date_dirty = false;
    } else {
        doc.date_dirty = true;
        doc.dirty = true;
    }
    return { res, was_new };
};

const outbox = new Set<Doc>();
let retry_timer: ReturnType<typeof setTimeout> | null = null;

const arm = () => {
    if (!retry_timer && outbox.size) retry_timer = setTimeout(() => void flush_outbox(), RETRY_MS);
};

/* Retries every parked doc once; whatever still fails stays parked for the next round. */
export const flush_outbox = async (): Promise<void> => {
    if (retry_timer) clearTimeout(retry_timer);
    retry_timer = null;
    for (const doc of [...outbox]) {
        if (doc.in_flight) continue;
        if (doc.dirty) await send_doc(doc);
        if (!doc.dirty && !doc.in_flight) outbox.delete(doc);
    }
    arm();
};

/* Keeps a doc whose off-screen save failed, and retries it until it lands. */
export const park = (doc: Doc): void => {
    outbox.add(doc);
    arm();
};

/* Takes back the parked doc for entry `id`, if there is one (the editor reopened that entry). */
export const unpark = (id: number): Doc | null => {
    for (const doc of outbox) {
        if (doc.id === id && !doc.in_flight) {
            outbox.delete(doc);
            return doc;
        }
    }
    return null;
};

/* How many docs hold text the server has not got yet (drives the leave-page warning). */
export const parked_count = (): number => outbox.size;

if (typeof window !== 'undefined') window.addEventListener('online', () => void flush_outbox());
