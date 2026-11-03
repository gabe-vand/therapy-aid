// Queries on journal_entries. One narrow function per query: params in, rows out.
// FOUNDATION wrote the functions below; BE-JOURNAL-CHAT may add more but does not change these.
// (journal_insights queries belong in repositories/journal-insights.ts.)
import { asc, desc, eq } from 'drizzle-orm';
import { journal_entries } from '@/db/schema/journal-entries';
import { db } from '@/services/common/svc-db';

export type JournalEntryRow = typeof journal_entries.$inferSelect;
export type JournalEntryPatch = Partial<Pick<JournalEntryRow, 'occurred_at' | 'body'>>;

const newest_first = [desc(journal_entries.occurred_at), desc(journal_entries.id)];

/** Inserts one entry (timestamps set here) and returns it. */
export const insertJournalEntry = (values: { occurred_at: string; body: string }): JournalEntryRow => {
    const now = new Date().toISOString();
    return db
        .insert(journal_entries)
        .values({ ...values, created_at: now, updated_at: now })
        .returning()
        .get();
};

/** One entry, or null. */
export const selectJournalEntryById = (id: number): JournalEntryRow | null => db.select().from(journal_entries).where(eq(journal_entries.id, id)).get() ?? null;

/** Entries newest occurred_at first (ties: newest id); `limit` caps the count. */
export const selectJournalEntries = (limit?: number): JournalEntryRow[] => {
    const query = db.select().from(journal_entries).orderBy(...newest_first);
    return limit !== undefined ? query.limit(limit).all() : query.all();
};

/** Every entry, oldest first (search-index rebuild). */
export const selectAllJournalEntries = (): JournalEntryRow[] => db.select().from(journal_entries).orderBy(asc(journal_entries.occurred_at), asc(journal_entries.id)).all();

/** Applies `patch` and bumps updated_at. Returns the updated row, or null if there is none. */
export const updateJournalEntry = (id: number, patch: JournalEntryPatch): JournalEntryRow | null =>
    db
        .update(journal_entries)
        .set({ ...patch, updated_at: new Date().toISOString() })
        .where(eq(journal_entries.id, id))
        .returning()
        .get() ?? null;

/** Deletes one entry (its insights go with it, by FK cascade). */
export const deleteJournalEntry = (id: number): void => {
    db.delete(journal_entries).where(eq(journal_entries.id, id)).run();
};
