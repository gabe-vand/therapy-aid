// Full-text search over sessions and journal entries (SQLite FTS5) — the retrieval half of chat
// grounding. Deterministic and cheap: chat runs it on every message before calling the model,
// and the model can run more through its search_notes tool. One index row per document; every
// write path calls reindexSession / reindexJournalEntry (or removeDocument on delete).
import * as repo_journal from '@/repositories/journal';
import type { JournalEntryRow } from '@/repositories/journal';
import * as repo_search from '@/repositories/search';
import type { SearchDocument, SearchKind, SearchRow } from '@/repositories/search';
import * as repo_sessions from '@/repositories/sessions';
import type { SessionRow } from '@/repositories/sessions';
import { parseSessionSummary } from '@/services/context/session-summary';
import { toMatchQuery } from './sanitize';

export type { SearchDocument, SearchKind } from '@/repositories/search';
export type SearchHit = SearchRow;

/** Writes (or replaces) one document's index row. */
export const reindexDocument = (doc: SearchDocument): void => repo_search.replaceSearchDocument(doc);

/** Drops one document from the index (call on delete). */
export const removeDocument = (kind: SearchKind, ref_id: number): void => repo_search.deleteSearchDocument(kind, ref_id);

/** The index document for a session: its title, then everything searchable — summary,
    therapist advice, notes, transcript. */
export const sessionSearchDocument = (row: SessionRow): SearchDocument => {
    const summary = parseSessionSummary(row.summary_json);
    const parts = [summary?.overview, summary?.key_points.join('\n'), summary?.therapist_advice.join('\n'), row.notes, row.transcript];
    return { kind: 'session', ref_id: row.id, occurred_at: row.occurred_at, title: row.title ?? summary?.title ?? 'Untitled session', body: parts.filter((part): part is string => !!part && part.trim().length > 0).join('\n\n') };
};

/** The index document for a journal entry: titled by its first line. */
export const journalSearchDocument = (row: JournalEntryRow): SearchDocument => ({
    kind: 'journal',
    ref_id: row.id,
    occurred_at: row.occurred_at,
    title: (row.body.split('\n').find((line) => line.trim()) ?? 'Journal entry').trim().slice(0, 80),
    body: row.body,
});

/** Re-indexes one session from its current row (call after any write that changes its text). */
export const reindexSession = (row: SessionRow): void => reindexDocument(sessionSearchDocument(row));

/** Re-indexes one journal entry from its current row. */
export const reindexJournalEntry = (row: JournalEntryRow): void => reindexDocument(journalSearchDocument(row));

/** Best matches for free text, best first. Never throws on odd input — the query is sanitized,
    and text with nothing searchable returns []. */
export const searchDocuments = (query: string, opts: { kind?: SearchKind; limit?: number } = {}): SearchHit[] => {
    const match = toMatchQuery(query);
    if (!match) return [];
    return repo_search.searchIndex(match, opts.kind ?? null, opts.limit ?? 8);
};

/** Refills the whole index from the sessions and journal tables (one transaction). Returns the
    number of documents written. */
export const rebuildSearchIndex = (): number => {
    const docs = [...repo_sessions.selectAllSessions().map(sessionSearchDocument), ...repo_journal.selectAllJournalEntries().map(journalSearchDocument)];
    repo_search.inSearchTransaction(() => {
        repo_search.clearSearchIndex();
        for (const doc of docs) repo_search.replaceSearchDocument(doc);
    });
    return docs.length;
};

/** Boot insurance (after a restore, or the first boot after this feature shipped): rebuilds only
    when the index is empty. Returns the documents written, or null when nothing was needed. */
export const rebuildSearchIndexIfEmpty = (): number | null => {
    if (repo_search.countSearchDocuments() > 0) return null;
    const written = rebuildSearchIndex();
    return written > 0 ? written : null;
};
