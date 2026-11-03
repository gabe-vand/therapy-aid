import { useCallback, useEffect, useRef, useState } from 'react';
import type { JournalInsight, MarginNoteResult } from '@therapy-aid/shared';
import { SETTLE_MS, new_settled_blocks, split_blocks } from '@/components/journal/paragraphs';
import { isOk, postAPI } from '@/services/api';

/* Margin notes while writing. Watches the draft: SETTLE_MS after the last keystroke it looks for
   paragraphs that have just been finished (paragraphs.ts), sends each to POST /journal/:id/notes
   — the server classifies it against Gabe's problems (cheap) and, when `write` is set, may write
   a short note — and hands any note back through `on_note`. The cadence that keeps the notes
   occasional rather than constant lives here: at most one note request per NOTE_GAP_MS and
   MAX_NOTES_PER_VISIT per editor session; the other finished paragraphs are still classified
   (links only), which is what feeds "In your journal lately". The blocks an entry opens with are
   seeded as seen, so reading never triggers anything; nothing runs at all when `enabled` is off
   or there is no entry yet. Failures are quiet (`error`) — this is a companion, not a feature
   Gabe is waiting on. */

export const NOTE_GAP_MS = 60_000;
export const MAX_NOTES_PER_VISIT = 4;
const MAX_PER_SETTLE = 6;

type Options = { enabled: boolean; on_note: (note: JournalInsight) => void };

export const useMarginNotes = (entry_id: number | null, draft: string, loaded_body: string, options: Options) => {
    const [thinking, set_thinking] = useState(false);
    const [error, set_error] = useState<string | null>(null);
    const seen = useRef<Set<string>>(new Set());
    const seeded_for = useRef<string | null>(null);
    const last_note_at = useRef(0);
    const notes_sent = useRef(0);
    const in_flight = useRef(false);
    const options_ref = useRef(options);
    options_ref.current = options;

    // The paragraphs the entry opened with never fire (seed once per loaded body).
    useEffect(() => {
        if (seeded_for.current === loaded_body) return;
        seeded_for.current = loaded_body;
        seen.current = new Set(split_blocks(loaded_body).map((b) => b.key));
    }, [loaded_body]);

    const send = useCallback(async (id: number, paragraph: string, write: boolean): Promise<void> => {
        const res = await postAPI<MarginNoteResult>(`journal/${id}/notes`, { paragraph, write });
        if (!isOk(res)) {
            set_error(res.message);
            return;
        }
        set_error(null);
        if (res.data.note) {
            last_note_at.current = Date.now();
            notes_sent.current += 1;
            options_ref.current.on_note(res.data.note);
        }
    }, []);

    useEffect(() => {
        if (!options.enabled || entry_id === null) return;
        const timer = setTimeout(async () => {
            if (in_flight.current) return;
            const blocks = new_settled_blocks(draft, seen.current).slice(-MAX_PER_SETTLE);
            if (blocks.length === 0) return;
            for (const b of blocks) seen.current.add(b.key);
            in_flight.current = true;
            set_thinking(true);
            try {
                for (const [i, block] of blocks.entries()) {
                    const last = i === blocks.length - 1;
                    const may_write = last && notes_sent.current < MAX_NOTES_PER_VISIT && Date.now() - last_note_at.current >= NOTE_GAP_MS;
                    await send(entry_id, block.text, may_write);
                }
            } finally {
                in_flight.current = false;
                set_thinking(false);
            }
        }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [draft, entry_id, options.enabled, send]);

    return { thinking, error };
};
