// Journal entries: CRUD with the search index kept in step (every write reindexes, delete removes),
// plus the per-entry note history (margin notes and reflections) and dismissing a note. Writing
// notes lives in margin/ (automatic) and insights.ts (on demand).
import type { JournalEntry, JournalInsight } from '@therapy-aid/shared';
import * as repo_journal from '@/repositories/journal';
import * as repo_insights from '@/repositories/journal-insights';
import { reindexJournalEntry, removeDocument } from '@/services/search/search';
import { toInsight } from './margin/margin';

const toEntry = (row: repo_journal.JournalEntryRow, insight_count: number): JournalEntry => ({ ...row, insight_count });

/** Every entry, newest first, each with how many insights it has. */
export const listEntries = (): JournalEntry[] => {
    const counts = new Map(repo_insights.selectInsightCounts().map((c) => [c.entry_id, c.insight_count]));
    return repo_journal.selectJournalEntries().map((row) => toEntry(row, counts.get(row.id) ?? 0));
};

/** One entry, or null. */
export const getEntry = (id: number): JournalEntry | null => {
    const row = repo_journal.selectJournalEntryById(id);
    return row ? toEntry(row, repo_insights.selectInsightCount(id)) : null;
};

/** Creates an entry (occurred_at defaults to now) and indexes it. An empty body is allowed: the
    editor creates the entry first and autosaves into it. */
export const createEntry = (input: { occurred_at?: string; body: string }): JournalEntry => {
    const row = repo_journal.insertJournalEntry({ occurred_at: input.occurred_at ?? new Date().toISOString(), body: input.body });
    reindexJournalEntry(row);
    return toEntry(row, 0);
};

/** Applies the changed fields, reindexes, and returns the entry; null when it doesn't exist. */
export const updateEntry = (id: number, patch: repo_journal.JournalEntryPatch): JournalEntry | null => {
    const row = repo_journal.updateJournalEntry(id, patch);
    if (!row) return null;
    reindexJournalEntry(row);
    return toEntry(row, repo_insights.selectInsightCount(id));
};

/** Deletes an entry (its insights cascade) and drops it from the index. False when it didn't exist. */
export const deleteEntry = (id: number): boolean => {
    if (!repo_journal.selectJournalEntryById(id)) return false;
    repo_journal.deleteJournalEntry(id);
    removeDocument('journal', id);
    return true;
};

/** An entry's live notes (both kinds), newest first; null when the entry doesn't exist. */
export const listInsights = (entry_id: number): JournalInsight[] | null => {
    if (!repo_journal.selectJournalEntryById(entry_id)) return null;
    return repo_insights.selectInsightsForEntry(entry_id).map(toInsight);
};

/** Hides one note for good (it stays in the table for history). Null when entry or note is missing. */
export const dismissInsight = (entry_id: number, note_id: number): JournalInsight | null => {
    if (!repo_insights.dismissInsight(entry_id, note_id)) return null;
    const row = repo_insights.selectInsightById(note_id);
    return row ? toInsight(row) : null;
};
