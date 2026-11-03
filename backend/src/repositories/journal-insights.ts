// Queries on journal_insights — the notes written on journal entries (margin notes and
// reflections) — and on journal_problem_links, the classifier's "this paragraph is about that
// problem" rows. One narrow function per query: params in, rows out.
import { and, count, desc, eq, getTableColumns, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { JournalNoteKind, JournalNoteSource } from '@therapy-aid/shared';
import { journal_entries } from '@/db/schema/journal-entries';
import { journal_insights, journal_problem_links } from '@/db/schema/journal-insights';
import { problems } from '@/db/schema/problems';
import { db } from '@/services/common/svc-db';

export type JournalInsightRow = typeof journal_insights.$inferSelect;
export type JournalInsightWithProblem = JournalInsightRow & { problem_title: string | null };
export type JournalProblemLinkRow = typeof journal_problem_links.$inferSelect;

export interface NewJournalInsight {
    entry_id: number;
    body: string;
    kind: JournalNoteKind;
    source: JournalNoteSource;
    problem_id?: number | null;
    session_id?: number | null;
    anchor?: string | null;
}

const visible = (entry_id: number) => and(eq(journal_insights.entry_id, entry_id), isNull(journal_insights.dismissed_at));
const insight_columns = getTableColumns(journal_insights);
const link_columns = getTableColumns(journal_problem_links);

/** Stores one note and returns it. */
export const insertJournalInsight = (values: NewJournalInsight): JournalInsightRow =>
    db
        .insert(journal_insights)
        .values({ problem_id: null, session_id: null, anchor: null, ...values, created_at: new Date().toISOString() })
        .returning()
        .get();

/** One note by id, with its problem's title. */
export const selectInsightById = (id: number): JournalInsightWithProblem | null =>
    db
        .select({ ...insight_columns, problem_title: problems.title })
        .from(journal_insights)
        .leftJoin(problems, eq(problems.id, journal_insights.problem_id))
        .where(eq(journal_insights.id, id))
        .get() ?? null;

/** An entry's notes that are not dismissed, newest first (ties: newest id), with problem titles. */
export const selectInsightsForEntry = (entry_id: number): JournalInsightWithProblem[] =>
    db
        .select({ ...insight_columns, problem_title: problems.title })
        .from(journal_insights)
        .leftJoin(problems, eq(problems.id, journal_insights.problem_id))
        .where(visible(entry_id))
        .orderBy(desc(journal_insights.created_at), desc(journal_insights.id))
        .all();

/** Marks a note dismissed (idempotent); null when there is no such note on that entry. */
export const dismissInsight = (entry_id: number, id: number): JournalInsightRow | null =>
    db
        .update(journal_insights)
        .set({ dismissed_at: new Date().toISOString() })
        .where(and(eq(journal_insights.id, id), eq(journal_insights.entry_id, entry_id)))
        .returning()
        .get() ?? null;

/** Whether the entry already has a live margin note about this problem. */
export const hasMarginNoteFor = (entry_id: number, problem_id: number): boolean =>
    (db
        .select({ n: count() })
        .from(journal_insights)
        .where(and(visible(entry_id), eq(journal_insights.source, 'margin'), eq(journal_insights.problem_id, problem_id)))
        .get()?.n ?? 0) > 0;

/** How many live margin notes an entry has. */
export const countMarginNotes = (entry_id: number): number =>
    db
        .select({ n: count() })
        .from(journal_insights)
        .where(and(visible(entry_id), eq(journal_insights.source, 'margin')))
        .get()?.n ?? 0;

/** How many live notes each entry has; entries with none are absent from the result. */
export const selectInsightCounts = (): { entry_id: number; insight_count: number }[] =>
    db.select({ entry_id: journal_insights.entry_id, insight_count: count() }).from(journal_insights).where(isNull(journal_insights.dismissed_at)).groupBy(journal_insights.entry_id).all();

/** How many live notes one entry has. */
export const selectInsightCount = (entry_id: number): number => db.select({ n: count() }).from(journal_insights).where(visible(entry_id)).get()?.n ?? 0;

/** Margin notes written since `since` (ISO), any entry. */
export const countMarginNotesSince = (since: string): number =>
    db
        .select({ n: count() })
        .from(journal_insights)
        .where(and(eq(journal_insights.source, 'margin'), gte(journal_insights.created_at, since)))
        .get()?.n ?? 0;

/** Records (entry, problem) with the strongest confidence seen so far; the excerpt follows it. */
export const upsertJournalProblemLink = (values: { entry_id: number; problem_id: number; confidence: number; excerpt: string }): JournalProblemLinkRow =>
    db
        .insert(journal_problem_links)
        .values({ ...values, created_at: new Date().toISOString() })
        .onConflictDoUpdate({
            target: [journal_problem_links.entry_id, journal_problem_links.problem_id],
            set: { confidence: sql`max(${journal_problem_links.confidence}, excluded.confidence)`, excerpt: sql`case when excluded.confidence >= ${journal_problem_links.confidence} then excluded.excerpt else ${journal_problem_links.excerpt} end` },
        })
        .returning()
        .get();

/** A problem's journal mentions, newest entry first, with each entry's date. */
export const selectLinksForProblem = (problem_id: number): (JournalProblemLinkRow & { occurred_at: string })[] =>
    db
        .select({ ...link_columns, occurred_at: journal_entries.occurred_at })
        .from(journal_problem_links)
        .innerJoin(journal_entries, eq(journal_entries.id, journal_problem_links.entry_id))
        .where(eq(journal_problem_links.problem_id, problem_id))
        .orderBy(desc(journal_entries.occurred_at), desc(journal_problem_links.id))
        .all();

/** Per problem: how many entries dated on/after `since` link to it (only the given problems). */
export const selectLinkCountsSince = (since: string, problem_ids: number[]): { problem_id: number; mentions: number }[] =>
    problem_ids.length === 0
        ? []
        : db
              .select({ problem_id: journal_problem_links.problem_id, mentions: count() })
              .from(journal_problem_links)
              .innerJoin(journal_entries, eq(journal_entries.id, journal_problem_links.entry_id))
              .where(and(gte(journal_entries.occurred_at, since), inArray(journal_problem_links.problem_id, problem_ids)))
              .groupBy(journal_problem_links.problem_id)
              .all();
