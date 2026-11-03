// Queries on journal_insights: the "I have an idea…" history per journal entry, plus the per-entry
// counts the journal list shows. One narrow function per query: params in, rows out.
import { count, desc, eq } from 'drizzle-orm';
import { journal_insights } from '@/db/schema/journal-insights';
import { db } from '@/services/common/svc-db';

export type JournalInsightRow = typeof journal_insights.$inferSelect;

/** Stores one generated insight for an entry and returns it. */
export const insertJournalInsight = (values: { entry_id: number; body: string }): JournalInsightRow =>
    db
        .insert(journal_insights)
        .values({ ...values, created_at: new Date().toISOString() })
        .returning()
        .get();

/** An entry's insights, newest first (ties: newest id). */
export const selectInsightsForEntry = (entry_id: number): JournalInsightRow[] =>
    db
        .select()
        .from(journal_insights)
        .where(eq(journal_insights.entry_id, entry_id))
        .orderBy(desc(journal_insights.created_at), desc(journal_insights.id))
        .all();

/** How many insights each entry has; entries with none are absent from the result. */
export const selectInsightCounts = (): { entry_id: number; insight_count: number }[] =>
    db
        .select({ entry_id: journal_insights.entry_id, insight_count: count() })
        .from(journal_insights)
        .groupBy(journal_insights.entry_id)
        .all();

/** How many insights one entry has. */
export const selectInsightCount = (entry_id: number): number => db.select({ n: count() }).from(journal_insights).where(eq(journal_insights.entry_id, entry_id)).get()?.n ?? 0;
