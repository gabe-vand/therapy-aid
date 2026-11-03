// Notes intake: pasted or uploaded notes (or a summary written after the fact, or seeded history)
// become a session in status `uploaded`, searchable immediately, and processing is kicked off in
// the background. The caller gets the row back at once; the SPA polls until it is ready.
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import { reindexSession } from '@/services/search/search';
import { processSession } from './pipeline';

/** Creates a notes session and starts processing it. `occurred_at` must be a valid ISO timestamp. */
export const createFromNotes = (input: { occurred_at: string; notes: string; title?: string | null }): SessionRow => {
    const title = input.title?.trim() || null;
    const row = repo_sessions.insertSession({ occurred_at: input.occurred_at, source: 'notes', status: 'uploaded', notes: input.notes.trim(), title });
    reindexSession(row);
    void processSession(row.id);
    return row;
};
